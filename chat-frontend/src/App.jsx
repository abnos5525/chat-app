import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

const App = () => {
  const [socket, setSocket] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState("");
  const [isInitiator, setIsInitiator] = useState(false);

  const peerConnection = useRef(null);
  const dataChannel = useRef(null);
  const socketRef = useRef(null);
  const roomIdRef = useRef("");
  const isInitiatorRef = useRef(false);

  useEffect(() => {
    const newSocket = io("http://localhost:3000", {
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    setSocket(newSocket);
    socketRef.current = newSocket;

    newSocket.on("connect", () => {
      console.log("Connected to signaling server");
    });

    newSocket.on("joined", (data) => {
      console.log(`Joined room: ${data.roomId}`);
      isInitiatorRef.current = data.isInitiator;
      setIsInitiator(data.isInitiator);
      setStatus("waiting");
      setError("");
    });

    newSocket.on("ready", async (room) => {
      console.log("Received READY event for room:", room);
      setError("");
      setStatus("connecting");

      try {
        await setupPeerConnection();

        if (isInitiatorRef.current) {
          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          socketRef.current.emit("offer", { 
            roomId: roomIdRef.current, 
            offer 
          });
        }
      } catch (err) {
        console.error("Ready error:", err);
        setError("Failed to create offer: " + err.message);
      }
    });

    newSocket.on("offer", async (offer) => {
      console.log("Received OFFER event");
      setError("");
      setStatus("connecting");

      try {
        await setupPeerConnection();

        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(offer)
        );

        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        socketRef.current.emit("answer", { 
          roomId: roomIdRef.current, 
          answer 
        });
      } catch (err) {
        console.error("Offer error:", err);
        setError("Failed to handle offer: " + err.message);
      }
    });

    newSocket.on("answer", async (answer) => {
      console.log("Received ANSWER event");
      try {
        if (peerConnection.current) {
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        }
      } catch (err) {
        console.error("Answer error:", err);
        setError("Failed to handle answer: " + err.message);
      }
    });

    newSocket.on("ice-candidate", async (candidate) => {
      try {
        if (candidate && peerConnection.current) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      } catch (e) {
        console.error("ICE candidate error:", e);
      }
    });

    newSocket.on("room-full", (room) => {
      console.log("Room full event received");
      setStatus("disconnected");
      setError(`Room ${room} is full! Try another room ID.`);
    });

    newSocket.on("peer-disconnected", () => {
      console.log("Peer disconnected event received");
      setStatus("disconnected");
      setError("Peer disconnected");
      cleanupConnection();
    });

    newSocket.on("join-error", (message) => {
      setError(message);
      setStatus("disconnected");
    });

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
      cleanupConnection();
    };
  }, []);

  const setupPeerConnection = async () => {
    if (peerConnection.current) {
      return true;
    }

    try {
      console.log("Creating new peer connection");
      peerConnection.current = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
          { urls: "stun:stun2.l.google.com:19302" },
          { urls: "stun:stun3.l.google.com:19302" },
          { urls: "stun:stun4.l.google.com:19302" },
        ],
      });

      // Only initiator creates the data channel
      if (isInitiatorRef.current) {
        console.log("Creating data channel as initiator");
        dataChannel.current = peerConnection.current.createDataChannel("chat");
        setupDataChannel();
      } else {
        // Receiver sets up data channel handler
        peerConnection.current.ondatachannel = (event) => {
          console.log("Data channel received");
          dataChannel.current = event.channel;
          setupDataChannel();
        };
      }

      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            roomId: roomIdRef.current,
            candidate,
          });
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        console.log(
          "Connection state:",
          peerConnection.current.connectionState
        );
        setStatus(peerConnection.current.connectionState);

        if (peerConnection.current.connectionState === "connected") {
          setError("");
        } else if (peerConnection.current.connectionState === "failed") {
          setError("Connection failed. Please try again.");
          cleanupConnection();
        }
      };

      peerConnection.current.oniceconnectionstatechange = () => {
        console.log(
          "ICE connection state:",
          peerConnection.current.iceConnectionState
        );
        if (peerConnection.current.iceConnectionState === "failed") {
          setError("ICE connection failed. Please try again.");
          cleanupConnection();
        }
      };

      return true;
    } catch (err) {
      console.error("Peer connection setup failed:", err);
      setError("Peer connection setup failed: " + err.message);
      cleanupConnection();
      return false;
    }
  };

  const setupDataChannel = () => {
    if (!dataChannel.current) return;

    dataChannel.current.onopen = () => {
      console.log("Data channel opened");
      setStatus("connected");
      setError("");
    };

    dataChannel.current.onmessage = (event) => {
      setMessages((prev) => [
        ...prev,
        {
          text: event.data,
          sender: "remote",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    };

    dataChannel.current.onclose = () => {
      console.log("Data channel closed");
      setStatus("disconnected");
      setError("Data channel closed");
    };

    dataChannel.current.onerror = (error) => {
      console.error("Data channel error:", error);
      setStatus("disconnected");
      setError("Data channel error: " + error.message);
    };
  };

  const cleanupConnection = () => {
    console.log("Cleaning up connection");
    if (dataChannel.current) {
      try {
        dataChannel.current.close();
      } catch (e) {}
      dataChannel.current = null;
    }
    if (peerConnection.current) {
      try {
        peerConnection.current.close();
      } catch (e) {}
      peerConnection.current = null;
    }
    isInitiatorRef.current = false;
    setIsInitiator(false);
  };

  const joinRoom = () => {
    if (!roomId.trim()) {
      setError("Please enter a room ID");
      return;
    }

    // Update roomId ref with current value
    roomIdRef.current = roomId;

    setError("");
    setMessages([]);
    cleanupConnection();

    if (socketRef.current) {
      console.log("Joining room:", roomId);
      setStatus("joining");
      socketRef.current.emit("join", roomId);
    }
  };

  const sendMessage = () => {
    if (!message.trim()) return;

    if (dataChannel.current && dataChannel.current.readyState === "open") {
      try {
        dataChannel.current.send(message);
        setMessages((prev) => [
          ...prev,
          {
            text: message,
            sender: "local",
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        setMessage("");
      } catch (err) {
        setError("Failed to send message: " + err.message);
      }
    } else {
      setError("Connection not ready");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Status display text
  const getStatusText = () => {
    switch (status) {
      case "disconnected":
        return "DISCONNECTED";
      case "joining":
        return "JOINING ROOM";
      case "waiting":
        return "WAITING FOR PEER";
      case "connecting":
        return "CONNECTING...";
      case "connected":
        return "CONNECTED";
      case "closed":
        return "CLOSED";
      default:
        return status.toUpperCase();
    }
  };

  return (
    <div className="container">
      <h1 className="title">WebRTC Chat</h1>

      {/* Room Join Section */}
      {status === "disconnected" && (
        <div className="join-section">
          <input
            type="text"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID"
            className="room-input"
          />
          <button onClick={joinRoom} className="join-btn">
            Join Room
          </button>
        </div>
      )}

      {/* Status Display */}
      <div className={`status ${status.replace(/\s+/g, "-")}`}>
        Status: {getStatusText()}
      </div>

      {/* Error Display */}
      {error && <div className="error">{error}</div>}

      {/* Chat Container */}
      {status !== "disconnected" && (
        <div className="chat-container">
          <div className="messages">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div className="text">{msg.text}</div>
                <div className="timestamp">{msg.timestamp}</div>
              </div>
            ))}
          </div>

          <div className="message-input">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={status !== "connected"}
            />
            <button
              onClick={sendMessage}
              disabled={status !== "connected" || !message.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;