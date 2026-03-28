import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { Notification } from './entities/notification.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<Partial<Repository<Notification>>>;

  const mockNotification = {
    id: 1,
    userId: 1,
    title: 'Order Update',
    message: 'Your order is ready',
    type: 'order',
    isRead: false,
    createdAt: new Date(),
  } as Notification;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
      ],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('getByUser', () => {
    it('should return user notifications sorted by createdAt DESC', async () => {
      const notifications = [mockNotification];
      repo.find.mockResolvedValue(notifications);

      const result = await service.getByUser(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(notifications);
    });
  });

  describe('create', () => {
    it('should save notification', async () => {
      repo.create.mockReturnValue(mockNotification);
      repo.save.mockResolvedValue(mockNotification);

      const data = {
        userId: 1,
        title: 'Order Update',
        message: 'Your order is ready',
        type: 'order',
      };
      const result = await service.create(data);

      expect(repo.create).toHaveBeenCalledWith(data);
      expect(repo.save).toHaveBeenCalledWith(mockNotification);
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markAsRead', () => {
    it('should set isRead to true', async () => {
      const unreadNotif = {
        ...mockNotification,
        isRead: false,
      } as Notification;
      repo.findOne.mockResolvedValue(unreadNotif);
      repo.save.mockImplementation(async (n) => n as Notification);

      const result = await service.markAsRead(1, 1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: 1 },
      });
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if notification not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.markAsRead(999, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markAllAsRead', () => {
    it('should update all user unread notifications', async () => {
      repo.update.mockResolvedValue(undefined as any);

      await service.markAllAsRead(1);

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 1, isRead: false },
        { isRead: true },
      );
    });
  });

  describe('getUnreadCount', () => {
    it('should return count of unread notifications', async () => {
      repo.count.mockResolvedValue(5);

      const result = await service.getUnreadCount(1);

      expect(repo.count).toHaveBeenCalledWith({
        where: { userId: 1, isRead: false },
      });
      expect(result).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      repo.count.mockResolvedValue(0);

      const result = await service.getUnreadCount(1);

      expect(result).toBe(0);
    });
  });
});
