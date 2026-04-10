import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { UsersService } from '../users/users.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
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
    return this.notifRepo.save(notif);
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
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
}
