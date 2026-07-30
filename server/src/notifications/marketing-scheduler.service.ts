import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketingNotification } from './entities/marketing-notification.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

export interface MarketingSendResult {
  sentTo: number;
  failed: number;
  fcmAvailable: boolean;
  tokens: number;
}

@Injectable()
export class MarketingSchedulerService {
  private readonly logger = new Logger(MarketingSchedulerService.name);

  constructor(
    @InjectRepository(MarketingNotification)
    private readonly marketingNotifRepo: Repository<MarketingNotification>,
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleCron() {
    this.logger.log('Checking for scheduled marketing notifications...');
    const activeNotifications = await this.marketingNotifRepo.find({
      where: { isActive: true },
    });

    const now = new Date();

    for (const notif of activeNotifications) {
      if (this.shouldSend(notif, now)) {
        try {
          await this.sendNotification(notif);
        } catch (err) {
          this.logger.error(
            `Failed to send marketing notification ${notif.id}: ${err}`,
          );
        }
      }
    }
  }

  private shouldSend(notif: MarketingNotification, now: Date): boolean {
    if (!notif.lastSentAt) return true;

    const lastSent = new Date(notif.lastSentAt).getTime();
    const current = now.getTime();
    const diffHours = (current - lastSent) / (1000 * 60 * 60);
    const intervalHours = this.frequencyToHours(notif.frequency);

    return intervalHours === null ? false : diffHours >= intervalHours;
  }

  private frequencyToHours(frequency: string): number | null {
    switch (frequency) {
      case 'daily':
        return 24;
      case 'monthly':
        return 24 * 30;
      default:
        break;
    }

    const match = frequency.match(/^(\d+)([hdwm])$/);
    if (!match) return null;

    const count = Number(match[1]);
    if (!Number.isFinite(count) || count < 1) return null;

    switch (match[2]) {
      case 'h':
        return count;
      case 'd':
        return count * 24;
      case 'w':
        return count * 24 * 7;
      case 'm':
        return count * 24 * 30;
      default:
        return null;
    }
  }

  async sendNotificationById(id: number): Promise<MarketingSendResult> {
    const notif = await this.marketingNotifRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException('Marketing notification not found');

    return this.sendNotification(notif);
  }

  async sendNotification(
    notif: MarketingNotification,
  ): Promise<MarketingSendResult> {
    this.logger.log(`Sending marketing notification: ${notif.header}`);

    const users = await this.usersService.findAll();
    const tokens = users
      .map((user) => user.fcmToken)
      .filter(
        (token): token is string =>
          typeof token === 'string' && token.trim() !== '',
      );

    if (tokens.length === 0) {
      this.logger.warn('No FCM tokens found for any user. Skipping push.');
      return {
        sentTo: 0,
        failed: 0,
        fcmAvailable: this.firebaseService.isAvailable,
        tokens: 0,
      };
    }

    const imageUrl = notif.imageUrl ?? undefined;
    const result = await this.firebaseService.sendToMultiple(
      tokens,
      notif.header,
      notif.body,
      {
        type: 'marketing',
        ...(imageUrl === undefined ? {} : { imageUrl }),
      },
      imageUrl,
    );

    if (!result) {
      return {
        sentTo: 0,
        failed: 0,
        fcmAvailable: false,
        tokens: tokens.length,
      };
    }

    notif.lastSentAt = new Date();
    await this.marketingNotifRepo.save(notif);

    return {
      sentTo: result.successCount,
      failed: result.failureCount,
      fcmAvailable: true,
      tokens: tokens.length,
    };
  }
}
