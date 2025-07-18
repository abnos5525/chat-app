import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";
import { App, Button, Input } from "antd";
import { getStatusText, iceServers, statuses } from "./utils";

const AppChat = () => {
  const [roomId, setRoomId] = useState("");
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState("");
  const { notification } = App.useApp();
  const peerConnection = useRef(null);
  const dataChannel = useRef(null);
  const socketRef = useRef(null);
  const roomIdRef = useRef("");
  const isInitiatorRef = useRef(false);

  useEffect(() => {
    const newSocket = io(import.meta.env.VITE_SERVER_URL, {
      transports: [import.meta.env.VITE_WEBSOCKET_TRANSPORTS],
      reconnection: import.meta.env.VITE_WEBSOCKET_RECONNECTION === "true",
      reconnectionAttempts:
        parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECTION_ATTEMPTS) ||
        Infinity,
      reconnectionDelay:
        parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECTION_DELAY) || 1000,
    });

    socketRef.current = newSocket;

    const handlers = {
      [statuses.connected]: () => console.log("Connected to server"),
      [statuses.joined]: (data) => {
        isInitiatorRef.current = data.isInitiator;
        setStatus(statuses.waiting);
        setError("");
        notification.info({ message: `Joined room: ${data.roomId}` });
      },
      [statuses.ready]: async () => {
        setError("");
        setStatus(statuses.connecting);
        try {
          await setupPeerConnection();
          if (isInitiatorRef.current) {
            const offer = await peerConnection.current.createOffer();
            await peerConnection.current.setLocalDescription(offer);
            socketRef.current.emit(statuses.offer, {
              roomId: roomIdRef.current,
              offer,
            });
          }
        } catch (err) {
          setError("Failed to create offer: " + err.message);
        }
      },
      [statuses.offer]: async (offer) => {
        setError("");
        setStatus(statuses.connecting);
        try {
          await setupPeerConnection();
          await peerConnection.current.setRemoteDescription(
            new RTCSessionDescription(offer)
          );
          const answer = await peerConnection.current.createAnswer();
          await peerConnection.current.setLocalDescription(answer);
          socketRef.current.emit(statuses.answer, {
            roomId: roomIdRef.current,
            answer,
          });
        } catch (err) {
          setError("Failed to handle offer: " + err.message);
        }
      },
      [statuses.answer]: async (answer) => {
        try {
          if (peerConnection.current) {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
          }
        } catch (e) {
          setError("Failed to handle answer: " + e.message);
        }
      },
      [statuses.ice_candidate]: async (candidate) => {
        if (candidate && peerConnection.current) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      },
      [statuses.room_full]: (room) => {
        setStatus(statuses.disconnected);
        setError(`Room ${room} is full! Try another room ID.`);
      },
      [statuses.peer_disconnected]: () => {
        setStatus(statuses.disconnected);
        setError("Peer disconnected");
        cleanupConnection();
      },
      [statuses.join_error]: (msg) => {
        setError(msg);
        setStatus(statuses.disconnected);
      },
    };

    Object.entries(handlers).forEach(([event, handler]) =>
      newSocket.on(event, handler)
    );

    return () => {
      newSocket.disconnect();
      cleanupConnection();
      Object.entries(handlers).forEach(([event, handler]) =>
        newSocket.off(event, handler)
      );
    };
  }, []);

  const setupPeerConnection = async () => {
    if (peerConnection.current) return true;
    try {
      peerConnection.current = new RTCPeerConnection({ iceServers });
      if (isInitiatorRef.current) {
        dataChannel.current = peerConnection.current.createDataChannel("chat");
        setupDataChannel();
      } else {
        peerConnection.current.ondatachannel = (event) => {
          dataChannel.current = event.channel;
          setupDataChannel();
        };
      }

      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current) {
          socketRef.current.emit(statuses.ice_candidate, {
            roomId: roomIdRef.current,
            candidate,
          });
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        const state = peerConnection.current.connectionState;
        setStatus(state);
        if (state === statuses.connected) setError("");
        else if (state === statuses.failed) {
          setError("Connection failed. Please try again.");
          cleanupConnection();
        }
      };

      return true;
    } catch (err) {
      setError("Peer connection setup failed: " + err.message);
      cleanupConnection();
      return false;
    }
  };

  const setupDataChannel = () => {
    if (!dataChannel.current) return;
    dataChannel.current.onopen = () => {
      setStatus(statuses.connected);
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
      setStatus(statuses.disconnected);
      setError("Data channel closed");
    };
    dataChannel.current.onerror = (e) => {
      setError("Data channel error: " + e.message);
      setStatus(statuses.disconnected);
    };
  };

  const cleanupConnection = () => {
    if (dataChannel.current) {
      dataChannel.current.close();
      dataChannel.current = null;
    }
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    isInitiatorRef.current = false;
  };

  const joinRoom = () => {
    const id = roomId.trim();
    if (!id) {
      setError("Please enter a room ID");
      return;
    }
    roomIdRef.current = id;
    setError("");
    setMessages([]);
    cleanupConnection();
    socketRef.current?.emit("join", id);
    setStatus(statuses.joining);
  };

  const sendMessage = () => {
    const msg = message.trim();
    if (!msg || !dataChannel.current?.readyState === "open") return;
    try {
      dataChannel.current.send(msg);
      setMessages((prev) => [
        ...prev,
        {
          text: msg,
          sender: "local",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      setMessage("");
    } catch (err) {
      setError("Failed to send message: " + err.message);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    error && notification.error({ message: error });
  }, [error]);

  return (
    <div className="container mx-auto max-w-3xl bg-white p-6 rounded-xl shadow-md">
      <h1 className="text-2xl font-bold text-center text-blue-800 mb-6">
        Web App Chat
      </h1>

      {status === "disconnected" && (
        <div className="flex gap-2 mb-6">
          <Input
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            placeholder="Enter room ID"
            className="flex-1 border border-gray-300 rounded px-4 py-2"
          />
          <Button
            onClick={joinRoom}
            type="primary"
            className="bg-blue-500 hover:bg-blue-600"
          >
            Join Room
          </Button>
        </div>
      )}

      <div
        className={`text-center py-2 mb-4 rounded font-bold ${
          status === "disconnected"
            ? "bg-red-500 text-white"
            : status === "waiting"
            ? "bg-yellow-500 text-white"
            : status === "connecting"
            ? "bg-blue-500 text-white"
            : status === "connected"
            ? "bg-green-500 text-white"
            : "bg-gray-300"
        }`}
      >
        Status: {getStatusText(status)}
      </div>

      {error && (
        <div className="p-3 mb-4 bg-red-100 text-red-800 rounded border border-red-300">
          {error}
        </div>
      )}

      {status !== "disconnected" && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="h-96 overflow-y-auto p-4 bg-gray-50 flex flex-col gap-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`max-w-md p-3 rounded-lg ${
                  msg.sender === "local"
                    ? "self-end bg-green-100 rounded-br-none"
                    : "self-start bg-gray-200 rounded-bl-none"
                }`}
              >
                <div>{msg.text}</div>
                <div className="text-xs text-gray-500 text-right mt-1">
                  {msg.timestamp}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 p-4 border-t border-gray-200 bg-white">
            <Input.TextArea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              disabled={status !== "connected"}
              className="flex-1 rounded-full border border-gray-300 p-3 resize-none"
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
            <Button
              onClick={sendMessage}
              disabled={status !== "connected" || !message.trim()}
              className={`rounded-full px-6 py-2 ${
                status === "connected" && message.trim()
                  ? "bg-blue-500 hover:bg-blue-600 text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Send
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppChat;
