import { useState, useRef, useEffect, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { iceServers } from '../utils';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '../types/chat';

interface State {
  localSecretCode: string;
  targetSecretCode: string;
  message: string;
  messages: Message[];
  status: string;
  error: string;
  incomingRequest: {
    fromCode: string;
    requestId: string;
  } | null;
}

const initialState: State = {
  localSecretCode: '',
  targetSecretCode: '',
  message: '',
  messages: [],
  status: 'disconnected',
  error: '',
  incomingRequest: null,
};

export function useChatConnection({ notification }: { notification: any }) {
  const [state, setState] = useState<State>(initialState);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const dataChannel = useRef<RTCDataChannel | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const connectionIdRef = useRef<string>('');
  const queryClient = useQueryClient();
  const isRegisteredRef = useRef(false);

  // Setters for controlled inputs
  const setLocalSecretCode = (code: string) =>
    setState((s) => ({ ...s, localSecretCode: code }));
  const setTargetSecretCode = (code: string) =>
    setState((s) => ({ ...s, targetSecretCode: code }));
  const setMessage = (message: string) => setState((s) => ({ ...s, message }));

  // Socket and peer connection setup
  useEffect(() => {
    // Parse the transports environment variable
    let transports: string[] = ['websocket', 'polling']; // Default fallback
    if (import.meta.env.VITE_WEBSOCKET_TRANSPORTS) {
      try {
        transports = import.meta.env.VITE_WEBSOCKET_TRANSPORTS.split(',');
      } catch (e) {
        console.warn(
          'Failed to parse VITE_WEBSOCKET_TRANSPORTS, using defaults',
        );
      }
    }

    const newSocket: Socket = io(
      import.meta.env.VITE_SERVER_URL || 'http://localhost:3000',
      {
        transports: transports,
        reconnection: import.meta.env.VITE_WEBSOCKET_RECONNECTION === 'true',
        reconnectionAttempts:
          parseInt(
            import.meta.env.VITE_WEBSOCKET_RECONNECTION_ATTEMPTS || 'Infinity',
          ) || Infinity,
        reconnectionDelay:
          parseInt(import.meta.env.VITE_WEBSOCKET_RECONNECTION_DELAY || '1000') ||
          1000,
      },
    );

    socketRef.current = newSocket;

    // Define event handlers
    const handlers: Record<string, (...args: any[]) => void> = {
      connected: () => {
        console.log('Connected to server');
        // Client registration is now handled in a separate useEffect
      },

      'registration-success': (data: { secretCode: string }) => {
        console.log(
          'Successfully registered with secret code:',
          data.secretCode,
        );
        isRegisteredRef.current = true;
      },

      'registration-error': (data: { message: string }) => {
        setState((s) => ({
          ...s,
          error: `Registration error: ${data.message}`,
        }));
      },

      'incoming-connection-request': (data: {
        fromCode: string;
        requestId: string;
      }) => {
        setState((s) => ({
          ...s,
          incomingRequest: {
            fromCode: data.fromCode,
            requestId: data.requestId,
          },
        }));
        notification.info({
          message: 'Connection Request',
          description: `${data.fromCode} wants to connect with you`,
          duration: 0,
        });
      },

      'request-sent': (data: { targetCode: string }) => {
        notification.info({
          message: `Connection request sent to ${data.targetCode}`,
        });
      },

      'connection-accepted': async (data: {
        connectionId: string;
        targetCode: string;
      }) => {
        connectionIdRef.current = data.connectionId;
        setState((s) => ({
          ...s,
          status: 'waiting',
          error: '',
          incomingRequest: null,
        })); // Use string literal
        notification.success({
          message: `Connection accepted by ${data.targetCode}`,
        });

        try {
          if (!peerConnection.current) {
            await setupPeerConnection(true); // As initiator
          }
          const offer = await peerConnection.current!.createOffer();
          await peerConnection.current!.setLocalDescription(offer);
          socketRef.current!.emit('offer', {
            connectionId: data.connectionId,
            offer: {
              type: offer.type,
              sdp: offer.sdp,
            },
          });
        } catch (err: any) {
          setState((s) => ({
            ...s,
            error: 'Failed to create offer: ' + err.message,
          }));
        }
      },

      'connection-established': async (data: {
        connectionId: string;
        initiatorCode: string;
      }) => {
        connectionIdRef.current = data.connectionId;
        setState((s) => ({
          ...s,
          status: 'waiting',
          error: '',
          incomingRequest: null,
        })); // Use string literal
        notification.success({ message: `Connected to ${data.initiatorCode}` });

        // Setup peer connection for responder
        try {
          if (!peerConnection.current) {
            await setupPeerConnection(false); // As responder
          }
        } catch (err: any) {
          setState((s) => ({
            ...s,
            error: 'Failed to setup connection: ' + err.message,
          }));
        }
      },

      offer: async (data: {
        connectionId: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        setState((s) => ({ ...s, error: '', status: 'connecting' })); // Use string literal
        try {
          if (!peerConnection.current) {
            await setupPeerConnection(false); // As responder
          }

          // Validate offer before setting
          if (!data.offer || !data.offer.type || data.offer.sdp === undefined) {
            throw new Error('Invalid offer received');
          }

          await peerConnection.current!.setRemoteDescription(
            new RTCSessionDescription({
              type: data.offer.type as RTCSdpType,
              sdp: data.offer.sdp,
            }),
          );

          const answer = await peerConnection.current!.createAnswer();
          await peerConnection.current!.setLocalDescription(answer);

          socketRef.current!.emit('answer', {
            connectionId: data.connectionId, // Use connectionId from the received data
            answer: {
              type: answer.type,
              sdp: answer.sdp,
            },
          });
        } catch (err: any) {
          setState((s) => ({
            ...s,
            error: 'Failed to handle offer: ' + err.message,
          }));
        }
      },

      answer: async (data: {
        connectionId: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        try {
          if (peerConnection.current) {
            // Validate answer before setting
            if (
              !data.answer ||
              !data.answer.type ||
              data.answer.sdp === undefined
            ) {
              throw new Error('Invalid answer received');
            }

            await peerConnection.current.setRemoteDescription(
              new RTCSessionDescription({
                type: data.answer.type as RTCSdpType,
                sdp: data.answer.sdp,
              }),
            );
          }
        } catch (e: any) {
          setState((s) => ({
            ...s,
            error: 'Failed to handle answer: ' + e.message,
          }));
        }
      },

      'ice-candidate': async (data: {
        connectionId: string;
        candidate: RTCIceCandidateInit;
      }) => {
        if (data.candidate && peerConnection.current) {
          try {
            await peerConnection.current.addIceCandidate(
              new RTCIceCandidate(data.candidate),
            );
          } catch (err: any) {
            console.warn('Failed to add ICE candidate:', err.message);
          }
        }
      },

      'target-not-found': () => {
        setState((s) => ({
          ...s,
          status: 'disconnected',
          error: 'Target user not found or not available',
        })); // Use string literal
      },

      'target-busy': (data: { targetCode: string }) => {
        setState((s) => ({
          ...s,
          status: 'disconnected',
          error: `${data.targetCode} is currently busy chatting with someone else`,
        })); // Use string literal
        notification.warning({
          message: 'User Busy',
          description: `${data.targetCode} is currently busy chatting with someone else. Please try again later.`,
        });
      },

      'peer-disconnected': () => {
        setState((s) => ({
          ...s,
          status: 'disconnected',
          error: 'Peer disconnected',
          incomingRequest: null,
        })); // Use string literal
        cleanupConnection();
      },

      'connection-rejected': (data: { targetCode: string }) => {
        setState((s) => ({
          ...s,
          status: 'disconnected', // Use string literal
          error: `Connection rejected by ${data.targetCode}`,
          incomingRequest: null,
        }));
      },

      'connection-error': (data: { message: string }) => {
        setState((s) => ({
          ...s,
          status: 'disconnected', // Use string literal
          error: data.message,
          incomingRequest: null,
        }));
      },
    };

    // Attach event handlers
    Object.entries(handlers).forEach(([event, handler]) =>
      newSocket.on(event, handler),
    );

    // Cleanup function
    return () => {
      newSocket.disconnect();
      cleanupConnection();
      Object.entries(handlers).forEach(([event, handler]) =>
        newSocket.off(event, handler),
      );
    };
  }, [state.localSecretCode, notification]); // Added notification to dependencies

  // Register client whenever localSecretCode changes
  useEffect(() => {
    if (socketRef.current && state.localSecretCode) {
      console.log('Registering client with secret code:', state.localSecretCode);
      // Reset registration flag to allow re-registration
      isRegisteredRef.current = false;
      socketRef.current.emit('register-client', {
        secretCode: state.localSecretCode,
      });
      isRegisteredRef.current = true;
    }
  }, [state.localSecretCode]);

  const setupPeerConnection = async (
    isInitiator: boolean,
  ): Promise<boolean> => {
    if (peerConnection.current) return true;
    try {
      peerConnection.current = new RTCPeerConnection({ iceServers });

      if (isInitiator) {
        // Create data channel for chat (initiator)
        dataChannel.current = peerConnection.current.createDataChannel('chat');
        setupDataChannel();
      } else {
        // Wait for data channel (responder)
        peerConnection.current.ondatachannel = (event: RTCDataChannelEvent) => {
          dataChannel.current = event.channel;
          setupDataChannel();
        };
      }

      peerConnection.current.onicecandidate = ({ candidate }) => {
        if (candidate && socketRef.current && connectionIdRef.current) {
          socketRef.current.emit('ice-candidate', {
            connectionId: connectionIdRef.current,
            candidate: {
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
              usernameFragment: candidate.usernameFragment,
            },
          });
        }
      };

      peerConnection.current.onconnectionstatechange = () => {
        const state = peerConnection.current!.connectionState;
        setState((s) => ({
          ...s,
          status: state,
          error: state === 'connected' ? '' : s.error, // Use string literal
        }));
        if (state === 'failed') {
          setState((s) => ({
            ...s,
            error: 'Connection failed. Please try again.',
            status: 'disconnected', // Use string literal
          }));
          cleanupConnection();
        }
      };

      return true;
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: 'Peer connection setup failed: ' + err.message,
      }));
      cleanupConnection();
      return false;
    }
  };

  const setupDataChannel = () => {
    if (!dataChannel.current) return;
    dataChannel.current.onopen = () => {
      setState((s) => ({ ...s, status: 'connected', error: '' })); // Use string literal
    };
    dataChannel.current.onmessage = (event: MessageEvent) => {
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            text: event.data,
            sender: 'remote',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
      }));
    };
    dataChannel.current.onclose = () => {
      setState((s) => ({
        ...s,
        status: 'disconnected', // Use string literal
        error: 'Data channel closed',
      }));
    };
    dataChannel.current.onerror = (e: Event) => {
      setState((s) => ({
        ...s,
        error: 'Data channel error: ' + (e as any).message,
        status: 'disconnected', // Use string literal
      }));
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
    connectionIdRef.current = '';
    setState((s) => ({ ...s, incomingRequest: null }));
    isRegisteredRef.current = false;
  };

  const connectToPeer = useCallback(() => {
    const localCode = state.localSecretCode.trim();
    const targetCode = state.targetSecretCode.trim();

    if (!localCode) {
      setState((s) => ({ ...s, error: 'Please enter your secret code' }));
      return;
    }

    if (!targetCode) {
      setState((s) => ({ ...s, error: 'Please enter target secret code' }));
      return;
    }

    if (localCode === targetCode) {
      setState((s) => ({ ...s, error: 'Cannot connect to yourself' }));
      return;
    }

    setState((s) => ({ ...s, error: '', messages: [] }));
    cleanupConnection();

    // Ensure we're registered
    if (socketRef.current && !isRegisteredRef.current) {
      socketRef.current.emit('register-client', { secretCode: localCode });
      isRegisteredRef.current = true;
    }

    // Request connection to target
    if (socketRef.current) {
      socketRef.current.emit('request-connection', {
        targetCode: targetCode,
        fromCode: localCode,
      });
      setState((s) => ({ ...s, status: 'joining' })); // Use string literal
    }
  }, [state.localSecretCode, state.targetSecretCode]);

  const respondToRequest = useCallback(
    (accepted: boolean) => {
      if (!state.incomingRequest || !socketRef.current) return;

      socketRef.current.emit('respond-to-request', {
        requestId: state.incomingRequest.requestId,
        accepted,
      });

      if (!accepted) {
        setState((s) => ({ ...s, incomingRequest: null }));
      }
    },
    [state.incomingRequest],
  );

  const sendMessage = useCallback(() => {
    const msg = state.message.trim();
    if (
      !msg ||
      !dataChannel.current ||
      dataChannel.current.readyState !== 'open'
    ) {
      if (dataChannel.current && dataChannel.current.readyState !== 'open') {
        setState((s) => ({ ...s, error: 'Data channel is not open yet' }));
      }
      return;
    }
    try {
      dataChannel.current.send(msg);
      setState((s) => ({
        ...s,
        messages: [
          ...s.messages,
          {
            text: msg,
            sender: 'local',
            timestamp: new Date().toLocaleTimeString(),
          },
        ],
        message: '',
      }));
    } catch (err: any) {
      setState((s) => ({
        ...s,
        error: 'Failed to send message: ' + err.message,
      }));
    }
  }, [state.message]); // Removed state.messages from dependencies as it's not directly used

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  useEffect(() => {
    if (state.error) {
      notification.error({ message: state.error });
    }
  }, [state.error, notification]); // Added notification to dependencies

  return {
    state,
    connectToPeer,
    sendMessage,
    handleKeyPress,
    setLocalSecretCode,
    setTargetSecretCode,
    setMessage,
    respondToRequest,
  };
}
