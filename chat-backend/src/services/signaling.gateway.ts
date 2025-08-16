import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

// WebRTC type definitions
interface RTCSessionDescription {
  type: 'offer' | 'answer';
  sdp: string;
}

interface RTCIceCandidate {
  candidate: string;
  sdpMLineIndex: number;
  sdpMid: string;
}

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SignalingGateway.name);

  // Store client secret codes and their socket IDs
  private clientSecrets: Map<string, string> = new Map(); // secretCode -> socketId
  private clientSockets: Map<string, string> = new Map(); // socketId -> secretCode
  private pendingConnections: Map<
    string,
    {
      initiatorCode: string;
      targetCode: string;
      initiatorSocketId: string;
      timestamp: number;
    }
  > = new Map(); // requestId -> connection info
  private activeConnections: Map<
    string,
    {
      initiatorSocketId: string;
      targetSocketId: string;
    }
  > = new Map(); // connectionId -> connection info

  afterInit() {
    this.logger.log('Signaling Gateway initialized');
  }

  /**
   * Check if a client is already busy (connected to someone else)
   */
  private isClientBusy(socketId: string): boolean {
    for (const connection of this.activeConnections.values()) {
      if (
        connection.initiatorSocketId === socketId ||
        connection.targetSocketId === socketId
      ) {
        return true;
      }
    }
    return false;
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Get secret code before removing from maps
    const secretCode = this.clientSockets.get(client.id);

    // Remove client from all maps
    if (secretCode) {
      this.clientSecrets.delete(secretCode);
      this.clientSockets.delete(client.id);
      this.logger.log(`Removed secret code: ${secretCode}`);
    }

    // Clean up pending connections
    this.pendingConnections.forEach((connection, requestId) => {
      if (connection.initiatorSocketId === client.id) {
        this.pendingConnections.delete(requestId);
      }
    });

    // Notify peers about disconnection
    this.activeConnections.forEach((connection, connectionId) => {
      if (
        connection.initiatorSocketId === client.id ||
        connection.targetSocketId === client.id
      ) {
        const otherSocketId =
          connection.initiatorSocketId === client.id
            ? connection.targetSocketId
            : connection.initiatorSocketId;

        this.server.to(otherSocketId).emit('peer-disconnected');
        this.activeConnections.delete(connectionId);
      }
    });
  }

  @SubscribeMessage('register-client')
  handleRegisterClient(client: Socket, payload: { secretCode: string }) {
    const { secretCode } = payload;

    // Check if secret code is already taken by another client
    const existingSocketId = this.clientSecrets.get(secretCode);
    if (existingSocketId && existingSocketId !== client.id) {
      client.emit('registration-error', 'Secret code already in use');
      return;
    }

    // Register the client
    this.clientSecrets.set(secretCode, client.id);
    this.clientSockets.set(client.id, secretCode);

    this.logger.log(
      `Registered client ${client.id} with secret code: ${secretCode}`,
    );
    client.emit('registration-success', { secretCode });
  }

  @SubscribeMessage('request-connection')
  handleConnectionRequest(
    client: Socket,
    payload: { targetCode: string; fromCode: string },
  ) {
    const { targetCode, fromCode } = payload;

    // Verify that the requester is registered
    const requesterCode = this.clientSockets.get(client.id);
    if (!requesterCode || requesterCode !== fromCode) {
      client.emit(
        'connection-error',
        'You must register your secret code first',
      );
      return;
    }

    // Check if target exists and is registered
    const targetSocketId = this.clientSecrets.get(targetCode);
    if (!targetSocketId) {
      client.emit('target-not-found');
      return;
    }

    // Check if client is trying to connect to themselves
    if (fromCode === targetCode) {
      client.emit('connection-error', 'Cannot connect to yourself');
      return;
    }

    // Check if target client is already busy (connected to someone else)
    const isTargetBusy = this.isClientBusy(targetSocketId);
    if (isTargetBusy) {
      client.emit('target-busy', { targetCode });
      this.logger.log(`Connection request rejected: ${targetCode} is busy`);
      return;
    }

    // Generate unique request ID
    const requestId = `${client.id}-${targetSocketId}-${Date.now()}`;

    // Store pending connection info
    this.pendingConnections.set(requestId, {
      initiatorCode: fromCode,
      targetCode: targetCode,
      initiatorSocketId: client.id,
      timestamp: Date.now(),
    });

    // Notify target client about connection request
    this.server.to(targetSocketId).emit('incoming-connection-request', {
      fromCode,
      requestId,
    });

    this.logger.log(`Connection request from ${fromCode} to ${targetCode}`);
    client.emit('request-sent', { targetCode });
  }

  @SubscribeMessage('respond-to-request')
  handleConnectionResponse(
    client: Socket,
    payload: { requestId: string; accepted: boolean },
  ) {
    const { requestId, accepted } = payload;
    const pendingConnection = this.pendingConnections.get(requestId);

    if (!pendingConnection) {
      client.emit('connection-error', 'Invalid connection request');
      return;
    }

    const { initiatorCode, targetCode, initiatorSocketId } = pendingConnection;

    // Check if the responder is the target
    const responderCode = this.clientSockets.get(client.id);
    if (responderCode !== targetCode) {
      client.emit('connection-error', 'Unauthorized response');
      this.pendingConnections.delete(requestId);
      return;
    }

    if (accepted) {
      // Generate connection ID
      const connectionId = `conn-${initiatorSocketId}-${client.id}-${Date.now()}`;

      // Store active connection
      this.activeConnections.set(connectionId, {
        initiatorSocketId,
        targetSocketId: client.id,
      });

      // Notify both parties
      this.server.to(initiatorSocketId).emit('connection-accepted', {
        connectionId,
        targetCode,
      });

      this.server.to(client.id).emit('connection-established', {
        connectionId,
        initiatorCode,
      });

      this.logger.log(
        `Connection accepted between ${initiatorCode} and ${targetCode}`,
      );
    } else {
      // Notify initiator that request was rejected
      this.server.to(initiatorSocketId).emit('connection-rejected', {
        targetCode,
      });
      this.logger.log(
        `Connection rejected by ${targetCode} for ${initiatorCode}`,
      );
    }

    // Clean up pending connection
    this.pendingConnections.delete(requestId);
  }

  @SubscribeMessage('offer')
  handleOffer(
    client: Socket,
    payload: { connectionId: string; offer: RTCSessionDescription },
  ) {
    const connection = this.activeConnections.get(payload.connectionId);
    if (!connection) {
      client.emit('connection-error', 'Invalid connection');
      return;
    }

    // Validate offer structure
    if (
      !payload.offer ||
      !payload.offer.type ||
      payload.offer.sdp === undefined
    ) {
      client.emit('connection-error', 'Invalid offer format');
      return;
    }

    const targetSocketId =
      connection.initiatorSocketId === client.id
        ? connection.targetSocketId
        : connection.initiatorSocketId;

    this.server.to(targetSocketId).emit('offer', {
      connectionId: payload.connectionId,
      offer: {
        type: payload.offer.type,
        sdp: payload.offer.sdp,
      },
    });
  }

  @SubscribeMessage('answer')
  handleAnswer(
    client: Socket,
    payload: { connectionId: string; answer: RTCSessionDescription },
  ) {
    const connection = this.activeConnections.get(payload.connectionId);
    if (!connection) {
      client.emit('connection-error', 'Invalid connection');
      return;
    }

    // Validate answer structure
    if (
      !payload.answer ||
      !payload.answer.type ||
      payload.answer.sdp === undefined
    ) {
      client.emit('connection-error', 'Invalid answer format');
      return;
    }

    const targetSocketId =
      connection.initiatorSocketId === client.id
        ? connection.targetSocketId
        : connection.initiatorSocketId;

    this.server.to(targetSocketId).emit('answer', {
      connectionId: payload.connectionId,
      answer: {
        type: payload.answer.type,
        sdp: payload.answer.sdp,
      },
    });
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(
    client: Socket,
    payload: { connectionId: string; candidate: RTCIceCandidate },
  ) {
    const connection = this.activeConnections.get(payload.connectionId);
    if (!connection) {
      return;
    }

    const targetSocketId =
      connection.initiatorSocketId === client.id
        ? connection.targetSocketId
        : connection.initiatorSocketId;

    this.server.to(targetSocketId).emit('ice-candidate', {
      connectionId: payload.connectionId,
      candidate: payload.candidate,
    });
  }
}
