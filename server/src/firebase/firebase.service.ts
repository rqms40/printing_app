import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private messaging: Messaging | null = null;

  onModuleInit() {
    const keyPath = path.resolve(
      process.cwd(),
      'firebase-service-account.json',
    );
    if (!fs.existsSync(keyPath)) {
      this.logger.warn(
        'Firebase service account key not found. Push notifications disabled.',
      );
      return;
    }

    try {
      this.app = admin.initializeApp({
        credential: admin.credential.cert(keyPath),
      });
      this.messaging = admin.messaging(this.app);
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  get isAvailable(): boolean {
    return this.messaging !== null;
  }

  /**
   * Send a push notification to a specific device token.
   */
  async sendToDevice(
    token: string,
    title: string,
    body: string,
    data?: Record<string, string>,
    opts?: { dataOnly?: boolean },
  ): Promise<string | null> {
    if (!this.messaging) {
      this.logger.warn('FCM not available — skipping notification');
      return null;
    }

    try {
      const response = await this.messaging.send({
        token,
        ...(opts?.dataOnly ? {} : { notification: { title, body } }),
        data: opts?.dataOnly ? { ...(data ?? {}), title, body } : (data ?? {}),
        android: opts?.dataOnly
          ? { priority: 'high' }
          : {
              priority: 'high',
              notification: { sound: 'default' },
            },
      });
      this.logger.log(`Push sent: ${title} → ${token.slice(0, 20)}...`);
      return response;
    } catch (error) {
      this.logger.error(`Push failed: ${error}`);
      return null;
    }
  }

  /**
   * Send to multiple device tokens.
   */
  async sendToMultiple(
    tokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
    imageUrl?: string,
  ): Promise<{ successCount: number; failureCount: number } | null> {
    if (!this.messaging) return null;
    if (tokens.length === 0) return { successCount: 0, failureCount: 0 };

    try {
      const response = await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: {
          ...(data ?? {}),
          ...(imageUrl === undefined ? {} : { imageUrl }),
        },
        ...(imageUrl === undefined
          ? {}
          : { android: { notification: { imageUrl } } }),
      });
      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (error) {
      this.logger.error(`Multicast push failed: ${error}`);
      throw error;
    }
  }
}
