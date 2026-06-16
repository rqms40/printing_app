import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { Notification } from './entities/notification.entity';
import { MarketingNotification } from './entities/marketing-notification.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: jest.Mocked<Partial<Repository<Notification>>>;
  let usersService: jest.Mocked<Partial<UsersService>>;
  let gateway: jest.Mocked<Partial<NotificationsGateway>>;

  const mockNotification = {
    id: 1,
    userId: 1,
    title: 'Order Update',
    message: 'Your order is ready',
    type: 'order',
    isRead: false,
    metadata: null,
    createdAt: new Date(),
  } as Notification;

  const mockAdmin = { id: 10, email: 'admin@gridgo.ph', role: 'admin' } as User;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    usersService = { findAllByRole: jest.fn() };
    gateway = { broadcastToAdmins: jest.fn() };

    const marketingRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getRepositoryToken(Notification), useValue: repo },
        {
          provide: getRepositoryToken(MarketingNotification),
          useValue: marketingRepo,
        },
        { provide: UsersService, useValue: usersService },
        { provide: NotificationsGateway, useValue: gateway },
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

      expect(await service.getUnreadCount(1)).toBe(0);
    });
  });

  describe('createForAllAdmins', () => {
    it('batch-inserts one row per admin and broadcasts', async () => {
      const admins = [
        mockAdmin,
        { id: 11, email: 'admin2@gridgo.ph', role: 'admin' } as User,
      ];
      usersService.findAllByRole.mockResolvedValue(admins);

      const row1 = { ...mockNotification, userId: 10 } as Notification;
      const row2 = { ...mockNotification, userId: 11, id: 2 } as Notification;
      repo.create.mockReturnValueOnce(row1).mockReturnValueOnce(row2);
      repo.save.mockResolvedValue([row1, row2] as any);

      await service.createForAllAdmins({
        title: 'New Order',
        message: 'ORD-10042 placed',
        type: 'order_placed',
        orderRef: 'ORD-10042',
        metadata: { orderId: 42, amount: 450 },
      });

      expect(usersService.findAllByRole).toHaveBeenCalledWith('admin');
      expect(repo.create).toHaveBeenCalledTimes(2);
      expect(repo.save).toHaveBeenCalledWith([row1, row2]);
      expect(gateway.broadcastToAdmins).toHaveBeenCalledWith(row1);
    });

    it('calls broadcastToAdmins with the first saved row', async () => {
      usersService.findAllByRole.mockResolvedValue([mockAdmin]);
      const saved = { ...mockNotification, userId: 10 } as Notification;
      repo.create.mockReturnValue(saved);
      repo.save.mockResolvedValue([saved] as any);

      await service.createForAllAdmins({
        title: 'Test',
        message: 'Test msg',
        type: 'test',
      });

      expect(gateway.broadcastToAdmins).toHaveBeenCalledWith(saved);
    });

    it('no-ops silently when no admin users exist', async () => {
      usersService.findAllByRole.mockResolvedValue([]);

      await service.createForAllAdmins({
        title: 'Test',
        message: 'Test msg',
        type: 'test',
      });

      expect(repo.save).not.toHaveBeenCalled();
      expect(gateway.broadcastToAdmins).not.toHaveBeenCalled();
    });
  });
});
