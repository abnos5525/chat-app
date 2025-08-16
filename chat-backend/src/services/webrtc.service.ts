import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  RTCSessionDescription,
  RTCIceCandidate,
  WebRTCOffer,
  WebRTCAnswer,
  WebRTCIceCandidatePayload,
  ActiveConnection,
} from '../types/connection.types';

@Injectable()
export class WebRTCService {
  private readonly logger = new Logger(WebRTCService.name);
  private server: Server | null = null;

  /**
   * Handle WebRTC offer from initiator
   */
  handleOffer(
    clientId: string,
    payload: WebRTCOffer,
    getConnection: (connectionId: string) => ActiveConnection | undefined,
  ): boolean {
    const connection = getConnection(payload.connectionId);
    if (!connection) {
      this.logger.warn(`Invalid connection for offer: ${payload.connectionId}`);
      return false;
    }

    // Validate offer structure
    if (!this.isValidSessionDescription(payload.offer)) {
      this.logger.warn(`Invalid offer format from client: ${clientId}`);
      return false;
    }

    // Forward offer to target client
    const targetSocketId = this.getTargetSocketId(connection, clientId);
    if (targetSocketId && this.server) {
      this.server.to(targetSocketId).emit('offer', {
        connectionId: payload.connectionId,
        offer: payload.offer,
      });
      this.logger.log(`Offer forwarded from ${clientId} to ${targetSocketId}`);
      return true;
    }

    return false;
  }

  /**
   * Handle WebRTC answer from responder
   */
  handleAnswer(
    clientId: string,
    payload: WebRTCAnswer,
    getConnection: (connectionId: string) => ActiveConnection | undefined,
  ): boolean {
    const connection = getConnection(payload.connectionId);
    if (!connection) {
      this.logger.warn(
        `Invalid connection for answer: ${payload.connectionId}`,
      );
      return false;
    }

    // Validate answer structure
    if (!this.isValidSessionDescription(payload.answer)) {
      this.logger.warn(`Invalid answer format from client: ${clientId}`);
      return false;
    }

    // Forward answer to initiator client
    const targetSocketId = this.getTargetSocketId(connection, clientId);
    if (targetSocketId && this.server) {
      this.server.to(targetSocketId).emit('answer', {
        connectionId: payload.connectionId,
        answer: payload.answer,
      });
      this.logger.log(`Answer forwarded from ${clientId} to ${targetSocketId}`);
      return true;
    }

    return false;
  }

  /**
   * Handle ICE candidate exchange
   */
  handleIceCandidate(
    clientId: string,
    payload: WebRTCIceCandidatePayload,
    getConnection: (connectionId: string) => ActiveConnection | undefined,
  ): boolean {
    const connection = getConnection(payload.connectionId);
    if (!connection) {
      // Don't log error for ICE candidates as they can arrive after disconnection
      return false;
    }

    // Forward ICE candidate to peer
    const targetSocketId = this.getTargetSocketId(connection, clientId);
    if (targetSocketId && this.server) {
      this.server.to(targetSocketId).emit('ice-candidate', {
        connectionId: payload.connectionId,
        candidate: payload.candidate,
      });
      return true;
    }

    return false;
  }

  /**
   * Set the server reference (called after gateway initialization)
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Get the target socket ID for a connection
   */
  private getTargetSocketId(
    connection: ActiveConnection,
    clientId: string,
  ): string | null {
    if (connection.initiatorSocketId === clientId) {
      return connection.targetSocketId;
    } else if (connection.targetSocketId === clientId) {
      return connection.initiatorSocketId;
    }
    return null;
  }

  /**
   * Validate RTC session description
   */
  private isValidSessionDescription(desc: RTCSessionDescription): boolean {
    return (
      desc &&
      typeof desc.type === 'string' &&
      (desc.type === 'offer' || desc.type === 'answer') &&
      typeof desc.sdp === 'string' &&
      desc.sdp.length > 0
    );
  }
}
