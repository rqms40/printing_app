import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { MarketingNotification } from './entities/marketing-notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
    @InjectRepository(MarketingNotification)
    private marketingNotifRepo: Repository<MarketingNotification>,
    private usersService: UsersService,
    private gateway: NotificationsGateway,
  ) {}

  async getByUser(userId: number): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markAsRead(id: number, userId: number): Promise<Notification> {
    const notif = await this.notifRepo.findOne({ where: { id, userId } });
    if (!notif) throw new NotFoundException('Notification not found');
    notif.isRead = true;
    return this.notifRepo.save(notif);
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  async create(data: {
    userId: number;
    title: string;
    message: string;
    type: string;
    orderRef?: string;
    metadata?: Record<string, unknown>;
  }): Promise<Notification> {
    const notif = this.notifRepo.create(data);
    const saved = await this.notifRepo.save(notif);
    // Push real-time to the user's WS room
    try {
      this.gateway.notifyUser(saved.userId, saved);
    } catch (err) {
      // WS emit is best-effort; log but don't fail the save
      console.warn('notifyUser failed:', err);
    }
    return saved;
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }

  triggerCreditsUpdate(userId: number, newCredits: number): void {
    try {
      this.gateway.notifyUserCreditsUpdate(userId, newCredits);
    } catch (err) {
      this.logger.warn(`notifyUserCreditsUpdate failed: ${err}`);
    }
  }

  async createForAllAdmins(data: {
    title: string;
    message: string;
    type: string;
    orderRef?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const admins = await this.usersService.findAllByRole('admin');
    if (admins.length === 0) return;

    const rows = admins.map((admin) =>
      this.notifRepo.create({ userId: admin.id, ...data }),
    );

    const saved = await this.notifRepo.save(rows);
    this.gateway.broadcastToAdmins(saved[0]);
  }

  // --- Marketing Notifications ---

  async getMarketingNotifications(): Promise<MarketingNotification[]> {
    return this.marketingNotifRepo.find({ order: { createdAt: 'DESC' } });
  }

  async createMarketingNotification(
    data: Partial<MarketingNotification>,
  ): Promise<MarketingNotification> {
    const notif = this.marketingNotifRepo.create(data);
    return this.marketingNotifRepo.save(notif);
  }

  async updateMarketingNotification(
    id: number,
    data: Partial<MarketingNotification>,
  ): Promise<MarketingNotification> {
    const notif = await this.marketingNotifRepo.findOne({ where: { id } });
    if (!notif) throw new NotFoundException('Marketing notification not found');
    Object.assign(notif, data);
    return this.marketingNotifRepo.save(notif);
  }

  async deleteMarketingNotification(id: number): Promise<void> {
    const result = await this.marketingNotifRepo.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Marketing notification not found');
    }
  }
}
