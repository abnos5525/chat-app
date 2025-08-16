import { Injectable, Logger } from '@nestjs/common';
import { Server } from 'socket.io';
import { PendingConnection, ActiveConnection } from '../types/connection.types';

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);
  private server: Server | null = null;

  // Store client secret codes and their socket IDs
  private clientSecrets: Map<string, string> = new Map(); // secretCode -> socketId
  private clientSockets: Map<string, string> = new Map(); // socketId -> secretCode
  private pendingConnections: Map<string, PendingConnection> = new Map();
  private activeConnections: Map<string, ActiveConnection> = new Map();

  /**
   * Set the server reference (called after gateway initialization)
   */
  setServer(server: Server): void {
    this.server = server;
  }

  /**
   * Register a client with their secret code
   */
  registerClient(socketId: string, secretCode: string): boolean {
    // Check if secret code is already taken by another client
    const existingSocketId = this.clientSecrets.get(secretCode);
    if (existingSocketId && existingSocketId !== socketId) {
      return false; // Secret code already in use
    }

    // Register the client
    this.clientSecrets.set(secretCode, socketId);
    this.clientSockets.set(socketId, secretCode);

    this.logger.log(
      `Registered client ${socketId} with secret code: ${secretCode}`,
    );
    return true;
  }

  /**
   * Unregister a client
   */
  unregisterClient(socketId: string): string | null {
    const secretCode = this.clientSockets.get(socketId);

    if (secretCode) {
      this.clientSecrets.delete(secretCode);
      this.clientSockets.delete(socketId);
      this.logger.log(
        `Unregistered client ${socketId} with secret code: ${secretCode}`,
      );
      return secretCode;
    }

    return null;
  }

  /**
   * Check if a client is already busy (connected to someone else)
   */
  isClientBusy(socketId: string): boolean {
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

  /**
   * Find existing pending request from client to target
   */
  findExistingRequest(clientId: string, targetCode: string): boolean {
    for (const [, connection] of this.pendingConnections.entries()) {
      if (
        connection.initiatorSocketId === clientId &&
        connection.targetCode === targetCode
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a new connection request
   */
  createConnectionRequest(
    initiatorCode: string,
    targetCode: string,
    initiatorSocketId: string,
  ): string {
    const requestId = `${initiatorSocketId}-${this.clientSecrets.get(targetCode)}-${Date.now()}`;

    this.pendingConnections.set(requestId, {
      initiatorCode,
      targetCode,
      initiatorSocketId,
      timestamp: Date.now(),
    });

    return requestId;
  }

  /**
   * Get target socket ID by secret code
   */
  getTargetSocketId(targetCode: string): string | undefined {
    return this.clientSecrets.get(targetCode);
  }

  /**
   * Get client secret code by socket ID
   */
  getClientSecretCode(socketId: string): string | undefined {
    return this.clientSockets.get(socketId);
  }

  /**
   * Get pending connection by request ID
   */
  getPendingConnection(requestId: string): PendingConnection | undefined {
    return this.pendingConnections.get(requestId);
  }

  /**
   * Remove pending connection
   */
  removePendingConnection(requestId: string): boolean {
    return this.pendingConnections.delete(requestId);
  }

  /**
   * Create active connection
   */
  createActiveConnection(
    initiatorSocketId: string,
    targetSocketId: string,
  ): string {
    const connectionId = `conn-${initiatorSocketId}-${targetSocketId}-${Date.now()}`;

    this.activeConnections.set(connectionId, {
      initiatorSocketId,
      targetSocketId,
    });

    return connectionId;
  }

  /**
   * Remove active connection
   */
  removeActiveConnection(connectionId: string): boolean {
    return this.activeConnections.delete(connectionId);
  }

  /**
   * Get active connection by ID
   */
  getActiveConnection(connectionId: string): ActiveConnection | undefined {
    return this.activeConnections.get(connectionId);
  }

  /**
   * Clean up connections for a specific client
   */
  cleanupClientConnections(clientId: string): void {
    // Clean up pending connections
    this.pendingConnections.forEach((connection, requestId) => {
      if (connection.initiatorSocketId === clientId) {
        this.pendingConnections.delete(requestId);
      }
    });

    // Clean up active connections and notify peers
    this.activeConnections.forEach((connection, connectionId) => {
      if (
        connection.initiatorSocketId === clientId ||
        connection.targetSocketId === clientId
      ) {
        const otherSocketId =
          connection.initiatorSocketId === clientId
            ? connection.targetSocketId
            : connection.initiatorSocketId;

        if (this.server) {
          this.server.to(otherSocketId).emit('peer-disconnected');
        }
        this.activeConnections.delete(connectionId);
      }
    });
  }

  /**
   * Get all active connections
   */
  getAllActiveConnections(): Map<string, ActiveConnection> {
    return this.activeConnections;
  }

  /**
   * Get all pending connections
   */
  getAllPendingConnections(): Map<string, PendingConnection> {
    return this.pendingConnections;
  }
}
