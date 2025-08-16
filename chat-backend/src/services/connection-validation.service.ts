import { Injectable, Logger } from '@nestjs/common';
import { PendingConnection } from '../types/connection.types';

@Injectable()
export class ConnectionValidationService {
  private readonly logger = new Logger(ConnectionValidationService.name);

  /**
   * Validate connection request parameters
   */
  validateConnectionRequest(
    fromCode: string,
    targetCode: string,
    requesterCode: string | undefined,
  ): { isValid: boolean; error?: string } {
    // Check if requester is registered
    if (!requesterCode || requesterCode !== fromCode) {
      return {
        isValid: false,
        error: 'You must register your secret code first',
      };
    }

    // Check if client is trying to connect to themselves
    if (fromCode === targetCode) {
      return {
        isValid: false,
        error: 'Cannot connect to yourself',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate connection response parameters
   */
  validateConnectionResponse(
    requestId: string,
    pendingConnection: PendingConnection | undefined,
    responderCode: string | undefined,
  ): { isValid: boolean; error?: string; connection?: PendingConnection } {
    if (!pendingConnection) {
      return {
        isValid: false,
        error: 'Invalid connection request',
      };
    }

    const { targetCode } = pendingConnection;

    // Check if the responder is the target
    if (responderCode !== targetCode) {
      return {
        isValid: false,
        error: 'Unauthorized response',
      };
    }

    return { isValid: true, connection: pendingConnection };
  }

  /**
   * Validate WebRTC offer payload
   */
  validateOfferPayload(payload: { offer?: { type?: string; sdp?: any } }): {
    isValid: boolean;
    error?: string;
  } {
    if (
      !payload.offer ||
      !payload.offer.type ||
      payload.offer.sdp === undefined
    ) {
      return {
        isValid: false,
        error: 'Invalid offer format',
      };
    }

    return { isValid: true };
  }

  /**
   * Validate WebRTC answer payload
   */
  validateAnswerPayload(payload: { answer?: { type?: string; sdp?: any } }): {
    isValid: boolean;
    error?: string;
  } {
    if (
      !payload.answer ||
      !payload.answer.type ||
      payload.answer.sdp === undefined
    ) {
      return {
        isValid: false,
        error: 'Invalid answer format',
      };
    }

    return { isValid: true };
  }
}
