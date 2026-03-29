import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
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
      this.app = initializeApp({
        credential: cert(keyPath),
      });
      this.messaging = getMessaging(this.app);
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
  ): Promise<string | null> {
    if (!this.messaging) {
      this.logger.warn('FCM not available — skipping notification');
      return null;
    }

    try {
      const response = await this.messaging.send({
        token,
        notification: { title, body },
        data: data ?? {},
        android: {
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
  ): Promise<void> {
    if (!this.messaging || tokens.length === 0) return;

    try {
      await this.messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: data ?? {},
      });
    } catch (error) {
      this.logger.error(`Multicast push failed: ${error}`);
    }
  }
}
