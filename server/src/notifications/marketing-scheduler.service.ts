import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MarketingNotification } from './entities/marketing-notification.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

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
        await this.sendNotification(notif);
        notif.lastSentAt = now;
        await this.marketingNotifRepo.save(notif);
      }
    }
  }

  private shouldSend(notif: MarketingNotification, now: Date): boolean {
    if (!notif.lastSentAt) return true;

    const lastSent = new Date(notif.lastSentAt).getTime();
    const current = now.getTime();
    const diffHours = (current - lastSent) / (1000 * 60 * 60);

    switch (notif.frequency) {
      case '6h':
        return diffHours >= 6;
      case 'daily':
        return diffHours >= 24;
      case 'monthly':
        return diffHours >= 24 * 30;
      default:
        return false;
    }
  }

  private async sendNotification(notif: MarketingNotification) {
    this.logger.log(`Sending marketing notification: ${notif.header}`);

    // Fetch all users with device tokens
    const users = await this.usersService.findAll();
    const tokens = users
      .map((u: any) => u.fcmToken)
      .filter((token: any): token is string => !!token && typeof token === 'string' && token.trim() !== '');

    if (tokens.length === 0) {
      this.logger.warn('No FCM tokens found for any user. Skipping push.');
      return;
    }

    try {
      await this.firebaseService.sendToMultiple(
        tokens,
        notif.header,
        notif.body,
        { type: 'marketing' },
      );
      this.logger.log(
        `Successfully sent marketing push to ${tokens.length} devices.`,
      );
    } catch (err) {
      this.logger.error(`Failed to send marketing push: ${err}`);
    }
  }
}
