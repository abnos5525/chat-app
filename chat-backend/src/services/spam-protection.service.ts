import { Injectable, Logger } from '@nestjs/common';
import { RequestTracking } from '../types/connection.types';

@Injectable()
export class SpamProtectionService {
  private readonly logger = new Logger(SpamProtectionService.name);

  // Spam protection: Track recent connection attempts
  private recentRequests: Map<string, RequestTracking> = new Map();
  private readonly REQUEST_COOLDOWN = 5000; // 5 seconds cooldown between requests
  private readonly REJECTION_COOLDOWN = 30000; // 30 seconds cooldown after rejection
  private readonly MAX_REQUESTS_PER_MINUTE = 10; // Max 10 requests per minute per client

  constructor() {
    // Set up periodic cleanup of old spam protection data
    setInterval(() => {
      this.cleanupOldRequestTracking();
    }, 60000); // Clean up every minute
  }

  /**
   * Check if a connection request is allowed (spam protection)
   */
  isRequestAllowed(clientId: string, targetCode: string): boolean {
    const now = Date.now();
    const key = `${clientId}-${targetCode}`;
    const requestInfo = this.recentRequests.get(key);

    if (!requestInfo) {
      return true; // First request, allow it
    }

    // Check rejection cooldown first (longer cooldown)
    if (
      requestInfo.rejected &&
      now - requestInfo.timestamp < this.REJECTION_COOLDOWN
    ) {
      this.logger.log(
        `Request blocked: ${clientId} still in rejection cooldown for ${targetCode}`,
      );
      return false; // Still in rejection cooldown
    }

    // Check regular cooldown period
    if (now - requestInfo.timestamp < this.REQUEST_COOLDOWN) {
      return false; // Still in cooldown
    }

    // Check rate limit (reset counter if more than 1 minute has passed)
    if (now - requestInfo.timestamp > 60000) {
      return true; // Reset counter after 1 minute
    }

    return requestInfo.count < this.MAX_REQUESTS_PER_MINUTE;
  }

  /**
   * Update request tracking for spam protection
   */
  updateRequestTracking(clientId: string, targetCode: string): void {
    const now = Date.now();
    const key = `${clientId}-${targetCode}`;
    const requestInfo = this.recentRequests.get(key);

    if (!requestInfo || now - requestInfo.timestamp > 60000) {
      // First request or reset after 1 minute
      this.recentRequests.set(key, {
        timestamp: now,
        count: 1,
        rejected: false,
      });
    } else {
      // Increment counter
      this.recentRequests.set(key, {
        timestamp: now,
        count: requestInfo.count + 1,
        rejected: false,
      });
    }
  }

  /**
   * Mark a request as rejected to trigger rejection cooldown
   */
  markRequestRejected(clientId: string, targetCode: string): void {
    const now = Date.now();
    const key = `${clientId}-${targetCode}`;
    const requestInfo = this.recentRequests.get(key);

    if (requestInfo) {
      // Update existing tracking with rejection flag
      this.recentRequests.set(key, {
        timestamp: now,
        count: requestInfo.count,
        rejected: true,
      });
      this.logger.log(
        `Request marked as rejected: ${clientId} -> ${targetCode}, cooldown activated`,
      );
    } else {
      // Create new rejection tracking
      this.recentRequests.set(key, {
        timestamp: now,
        count: 1,
        rejected: true,
      });
      this.logger.log(
        `New rejection tracking created: ${clientId} -> ${targetCode}`,
      );
    }
  }

  /**
   * Clean up spam protection tracking for a specific client
   */
  cleanupRequestTracking(clientId: string): void {
    this.recentRequests.forEach((info, key) => {
      if (key.startsWith(clientId)) {
        this.recentRequests.delete(key);
      }
    });
  }

  /**
   * Clean up old spam protection tracking data
   */
  private cleanupOldRequestTracking(): void {
    const now = Date.now();
    this.recentRequests.forEach((info, key) => {
      if (now - info.timestamp > 120000) {
        // Remove data older than 2 minutes
        this.recentRequests.delete(key);
      }
    });
  }
}
