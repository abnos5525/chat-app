import { useState, useRef, useEffect, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { iceServers, statuses } from "../utils";
import { useQueryClient } from "@tanstack/react-query";
import type { Message } from "../types/chat";

interface State {
  roomId: string;
  message: string;
  messages: Message[];
  status: string;
  error: string;
}

const initialState: State = {
  roomId: "",
  message: "",
  messages: [],
  status: "disconnected",
  error: "",
};

export function useChatConnection({ notification }: { notification: any }) {
  const [state, setState] = useState<State>(initialState);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string>("");
  const isInitiatorRef = useRef<boolean>(false);
  const queryClient = useQueryClient();

  // Setters for controlled inputs
  const setRoomId = (roomId: string) => setState((s) => ({ ...s, roomId }));
  const setMessage = (message: string) => setState((s) => ({ ...s, message }));

  // Socket and peer connection setup
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
        setState((s) => ({ ...s, status: statuses.waiting, error: "" }));
        notification.info({ message: `Joined room: ${data.roomId}` });
      },
      [statuses.ready]: async () => {
        setState((s) => ({ ...s, error: "", status: statuses.connecting }));
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
          setState((s) => ({ ...s, error: "Failed to create offer: " + err.message }));
        }
      },
      [statuses.offer]: async (offer: RTCSessionDescriptionInit) => {
        setState((s) => ({ ...s, error: "", status: statuses.connecting }));
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
          setState((s) => ({ ...s, error: "Failed to handle offer: " + err.message }));
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
          setState((s) => ({ ...s, error: "Failed to handle answer: " + e.message }));
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
        setState((s) => ({ ...s, status: statuses.disconnected, error: `Room ${room} is full! Try another room ID.` }));
      },
      [statuses.peer_disconnected]: () => {
        setState((s) => ({ ...s, status: statuses.disconnected, error: "Peer disconnected" }));
        cleanupConnection();
      },
      [statuses.join_error]: (msg: string) => {
        setState((s) => ({ ...s, error: msg, status: statuses.disconnected }));
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
    // eslint-disable-next-line
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
        setState((s) => ({ ...s, status: state, error: state === statuses.connected ? "" : s.error }));
        if (state === statuses.failed) {
          setState((s) => ({ ...s, error: "Connection failed. Please try again.", status: statuses.disconnected }));
          cleanupConnection();
        }
      };

      return true;
    } catch (err: any) {
      setState((s) => ({ ...s, error: "Peer connection setup failed: " + err.message }));
      cleanupConnection();
      return false;
    }
  };

  const setupDataChannel = () => {
    if (!dataChannel.current) return;
    dataChannel.current.onopen = () => {
      setState((s) => ({ ...s, status: statuses.connected, error: "" }));
    };
    dataChannel.current.onmessage = (event: MessageEvent) => {
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            text: event.data,
            sender: "remote",
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      }));
    };
    dataChannel.current.onclose = () => {
      setState((s) => ({ ...s, status: statuses.disconnected, error: "Data channel closed" }));
    };
    dataChannel.current.onerror = (e: Event) => {
      setState((s) => ({ ...s, error: "Data channel error: " + (e as any).message, status: statuses.disconnected }));
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

  const joinRoom = useCallback(() => {
    const id = state.roomId.trim();
    if (!id) {
      setState((s) => ({ ...s, error: "Please enter a room ID" }));
      return;
    }
    roomIdRef.current = id;
    setState((s) => ({ ...s, error: "", messages: [] }));
    cleanupConnection();
    socketRef.current?.emit("join", id);
    setState((s) => ({ ...s, status: statuses.joining }));
  }, [state.roomId]);

  const sendMessage = useCallback(() => {
    const msg = state.message.trim();
    if (!msg || dataChannel.current?.readyState !== "open") return;
    try {
      dataChannel.current.send(msg);
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            text: msg,
            sender: "local",
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
        message: "",
      }));
    } catch (err: any) {
      setState((s) => ({ ...s, error: "Failed to send message: " + err.message }));
    }
  }, [state.message]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    state.error && notification.error({ message: state.error });
    // eslint-disable-next-line
  }, [state.error]);

  return {
    state,
    joinRoom,
    sendMessage,
    handleKeyPress,
    setRoomId,
    setMessage,
  };
} 