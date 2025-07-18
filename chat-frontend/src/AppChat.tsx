import { useState, useEffect, useRef } from "react";
import io, { Socket } from "socket.io-client";
import { App, Button, Input } from "antd";
import { getStatusText, iceServers, statuses } from "./utils";
import Chat from "./components/chat";
// Message type
interface Message {
  text: string;
  sender: "local" | "remote";
  timestamp: string;
}

const AppChat = () => {
  const [roomId, setRoomId] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<string>("disconnected");
  const [error, setError] = useState<string>("");
  const { notification } = App.useApp();
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string>("");
  const isInitiatorRef = useRef<boolean>(false);

  useEffect(() => {
    const newSocket: Socket = io(import.meta.env.VITE_SERVER_URL, {
      transports: [import.meta.env.VITE_WEBSOCKET_TRANSPORTS],
      reconnection: import.meta.env.VITE_WEBSOCKET_RECONNECTION === "true",
      reconnectionAttempts:
        parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECTION_ATTEMPTS) ||
        Infinity,
      reconnectionDelay:
        parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECTION_DELAY) || 1000,
    });

    socketRef.current = newSocket;

    const handlers: Record<string, (...args: any[]) => void> = {
      [statuses.connected]: () => console.log("Connected to server"),
      [statuses.joined]: (data: { isInitiator: boolean; roomId: string }) => {
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
            const offer = await peerConnection.current!.createOffer();
            await peerConnection.current!.setLocalDescription(offer);
            socketRef.current!.emit(statuses.offer, {
              roomId: roomIdRef.current,
              offer,
            });
          }
        } catch (err: any) {
          setError("Failed to create offer: " + err.message);
        }
      },
      [statuses.offer]: async (offer: RTCSessionDescriptionInit) => {
        setError("");
        setStatus(statuses.connecting);
        try {
          await setupPeerConnection();
          await peerConnection.current!.setRemoteDescription(
            new RTCSessionDescription(offer)
          );
          const answer = await peerConnection.current!.createAnswer();
          await peerConnection.current!.setLocalDescription(answer);
          socketRef.current!.emit(statuses.answer, {
            roomId: roomIdRef.current,
            answer,
          });
        } catch (err: any) {
          setError("Failed to handle offer: " + err.message);
        }
      },
      [statuses.answer]: async (answer: RTCSessionDescriptionInit) => {
        try {
          if (peerConnection.current) {
            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription(answer)
            );
          }
        } catch (e: any) {
          setError("Failed to handle answer: " + e.message);
        }
      },
      [statuses.ice_candidate]: async (candidate: RTCIceCandidateInit) => {
        if (candidate && peerConnection.current) {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(candidate)
          );
        }
      },
      [statuses.room_full]: (room: string) => {
        setStatus(statuses.disconnected);
        setError(`Room ${room} is full! Try another room ID.`);
      },
      [statuses.peer_disconnected]: () => {
        setStatus(statuses.disconnected);
        setError("Peer disconnected");
        cleanupConnection();
      },
      [statuses.join_error]: (msg: string) => {
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

  const setupPeerConnection = async (): Promise<boolean> => {
    if (peerConnection.current) return true;
    try {
      peerConnection.current = new RTCPeerConnection({ iceServers });
      if (isInitiatorRef.current) {
        dataChannel.current = peerConnection.current.createDataChannel("chat");
        setupDataChannel();
      } else {
        peerConnection.current.ondatachannel = (event: RTCDataChannelEvent) => {
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
        const state = peerConnection.current!.connectionState;
        setStatus(state);
        if (state === statuses.connected) setError("");
        else if (state === statuses.failed) {
          setError("Connection failed. Please try again.");
          cleanupConnection();
        }
      };

      return true;
    } catch (err: any) {
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
    dataChannel.current.onmessage = (event: MessageEvent) => {
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
    dataChannel.current.onerror = (e: Event) => {
      setError("Data channel error: " + (e as any).message);
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
    if (!msg || dataChannel.current?.readyState !== "open") return;
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
    } catch (err: any) {
      setError("Failed to send message: " + err.message);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
        <Chat
          messages={messages}
          message={message}
          setMessage={setMessage}
          handleKeyPress={handleKeyPress}
          sendMessage={sendMessage}
          status={status}
        />
      )}
    </div>
  );
};

export default AppChat;
