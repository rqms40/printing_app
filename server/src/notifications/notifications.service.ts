import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private notifRepo: Repository<Notification>,
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
  }): Promise<Notification> {
    const notif = this.notifRepo.create(data);
    return this.notifRepo.save(notif);
  }

  async getUnreadCount(userId: number): Promise<number> {
    return this.notifRepo.count({ where: { userId, isRead: false } });
  }
}
