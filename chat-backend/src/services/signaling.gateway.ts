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
import { ConnectionService } from './connection.service';
import { SpamProtectionService } from './spam-protection.service';
import { WebRTCService } from './webrtc.service';
import { ConnectionValidationService } from './connection-validation.service';
import {
  WebRTCOffer,
  WebRTCAnswer,
  WebRTCIceCandidatePayload,
} from '../types/connection.types';
import { resolveEnvVars } from '../utils/env.utils';

@WebSocketGateway({
  cors: {
    origin: resolveEnvVars(process.env.FRONTEND_URL || 'http://localhost:3000'),
    methods: ['GET', 'POST'],
  },
})
export class SignalingGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(SignalingGateway.name);

  constructor(
    private readonly connectionService: ConnectionService,
    private readonly spamProtectionService: SpamProtectionService,
    private readonly webrtcService: WebRTCService,
    private readonly validationService: ConnectionValidationService,
  ) {}

  afterInit() {
    this.logger.log('Signaling Gateway initialized');
    // Set server references in services
    this.connectionService.setServer(this.server);
    this.webrtcService.setServer(this.server);
  }

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
    client.emit('connected');
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Clean up client data
    const secretCode = this.connectionService.unregisterClient(client.id);
    if (secretCode) {
      this.logger.log(`Removed secret code: ${secretCode}`);
    }

    // Clean up connections and notify peers
    this.connectionService.cleanupClientConnections(client.id);

    // Clean up spam protection tracking
    this.spamProtectionService.cleanupRequestTracking(client.id);
  }

  @SubscribeMessage('register-client')
  handleRegisterClient(client: Socket, payload: { secretCode: string }) {
    const { secretCode } = payload;

    const success = this.connectionService.registerClient(
      client.id,
      secretCode,
    );

    if (success) {
      client.emit('registration-success', { secretCode });
    } else {
      client.emit('registration-error', 'Secret code already in use');
    }
  }

  @SubscribeMessage('request-connection')
  handleConnectionRequest(
    client: Socket,
    payload: { targetCode: string; fromCode: string },
  ) {
    const { targetCode, fromCode } = payload;

    // Get requester's secret code
    const requesterCode = this.connectionService.getClientSecretCode(client.id);

    // Validate connection request
    const validation = this.validationService.validateConnectionRequest(
      fromCode,
      targetCode,
      requesterCode,
    );

    if (!validation.isValid) {
      client.emit('connection-error', validation.error);
      return;
    }

    // Check if target exists and is registered
    const targetSocketId = this.connectionService.getTargetSocketId(targetCode);
    if (!targetSocketId) {
      client.emit('target-not-found');
      return;
    }

    // Check if target client is already busy
    if (this.connectionService.isClientBusy(targetSocketId)) {
      client.emit('target-busy', { targetCode });
      this.logger.log(`Connection request rejected: ${targetCode} is busy`);
      return;
    }

    // Spam protection check
    if (!this.spamProtectionService.isRequestAllowed(client.id, targetCode)) {
      client.emit(
        'connection-error',
        'Too many connection requests. Please wait before trying again.',
      );
      this.logger.log(`Spam protection triggered for client ${client.id}`);
      return;
    }

    // Check for existing pending request
    if (this.connectionService.findExistingRequest(client.id, targetCode)) {
      client.emit(
        'connection-error',
        'You already have a pending connection request to this user. Please wait for a response.',
      );
      this.logger.log(
        `Duplicate request blocked from ${fromCode} to ${targetCode}`,
      );
      return;
    }

    // Create connection request
    const requestId = this.connectionService.createConnectionRequest(
      fromCode,
      targetCode,
      client.id,
    );

    // Update spam protection tracking
    this.spamProtectionService.updateRequestTracking(client.id, targetCode);

    // Notify target client
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

    // Get pending connection and validate response
    const pendingConnection =
      this.connectionService.getPendingConnection(requestId);
    const responderCode = this.connectionService.getClientSecretCode(client.id);

    const validation = this.validationService.validateConnectionResponse(
      requestId,
      pendingConnection,
      responderCode,
    );

    if (!validation.isValid) {
      client.emit('connection-error', validation.error);
      if (validation.error === 'Unauthorized response') {
        this.connectionService.removePendingConnection(requestId);
      }
      return;
    }

    if (!validation.connection) {
      client.emit('connection-error', 'Invalid connection data');
      return;
    }

    const connection = validation.connection;
    const { initiatorCode, targetCode, initiatorSocketId } = connection;

    // Ensure all required fields are present
    if (!initiatorSocketId || !targetCode || !initiatorCode) {
      client.emit('connection-error', 'Invalid connection data');
      return;
    }

    if (accepted) {
      // Create active connection
      const connectionId = this.connectionService.createActiveConnection(
        initiatorSocketId,
        client.id,
      );

      // Remove pending connection
      this.connectionService.removePendingConnection(requestId);

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
      // Mark request as rejected to trigger rejection cooldown
      this.spamProtectionService.markRequestRejected(
        initiatorSocketId,
        targetCode,
      );

      // Notify initiator that request was rejected
      this.server.to(initiatorSocketId).emit('connection-rejected', {
        targetCode,
      });

      // Remove pending connection
      this.connectionService.removePendingConnection(requestId);

      this.logger.log(
        `Connection rejected by ${targetCode} for ${initiatorCode}`,
      );
    }
  }

  @SubscribeMessage('offer')
  handleOffer(client: Socket, payload: WebRTCOffer) {
    // Validate offer payload
    const validation = this.validationService.validateOfferPayload(payload);
    if (!validation.isValid) {
      client.emit('connection-error', validation.error);
      return;
    }

    // Handle offer through WebRTC service
    const success = this.webrtcService.handleOffer(
      client.id,
      payload,
      (connectionId: string) =>
        this.connectionService.getActiveConnection(connectionId),
    );

    if (!success) {
      client.emit('connection-error', 'Invalid connection');
    }
  }

  @SubscribeMessage('answer')
  handleAnswer(client: Socket, payload: WebRTCAnswer) {
    // Validate answer payload
    const validation = this.validationService.validateAnswerPayload(payload);
    if (!validation.isValid) {
      client.emit('connection-error', validation.error);
      return;
    }

    // Handle answer through WebRTC service
    const success = this.webrtcService.handleAnswer(
      client.id,
      payload,
      (connectionId: string) =>
        this.connectionService.getActiveConnection(connectionId),
    );

    if (!success) {
      client.emit('connection-error', 'Invalid connection');
    }
  }

  @SubscribeMessage('ice-candidate')
  handleIceCandidate(client: Socket, payload: WebRTCIceCandidatePayload) {
    // Handle ICE candidate through WebRTC service
    this.webrtcService.handleIceCandidate(
      client.id,
      payload,
      (connectionId: string) =>
        this.connectionService.getActiveConnection(connectionId),
    );
  }
}
