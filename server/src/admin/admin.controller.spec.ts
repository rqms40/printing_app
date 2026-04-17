import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { AdminController } from './admin.controller';
import { OrdersService } from '../orders/orders.service';
import { DriversService } from '../drivers/drivers.service';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { CreditsService } from '../credits/credits.service';
import { In } from 'typeorm';

const mockRepo = () => ({
  find: jest.fn(),
  findOneOrFail: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
});

describe('AdminController analytics', () => {
  let controller: AdminController;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let usersRepo: jest.Mocked<Partial<Repository<User>>>;
  let creditsService: jest.Mocked<Partial<CreditsService>>;

  beforeEach(async () => {
    ordersRepo = mockRepo();
    usersRepo = mockRepo();
    creditsService = { getPendingCount: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: OrdersService, useValue: { updateStatus: jest.fn() } },
        {
          provide: DriversService,
          useValue: { getAllDriversWithUser: jest.fn() },
        },
        { provide: CreditsService, useValue: creditsService },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
      ],
    }).compile();

    controller = module.get(AdminController);
  });

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-31T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds analytics from persisted orders and paper specs instead of returning static arrays', async () => {
    ordersRepo.find.mockResolvedValue([
      {
        id: 1,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 100,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2026-03-31T09:00:00.000Z'),
        paperSpec: { paperSize: 'a4' },
      },
      {
        id: 2,
        category: 'paper',
        paymentStatus: 'pending',
        totalPrice: 80,
        orderStatus: OrderStatus.PRINTING_IN_PROGRESS,
        createdAt: new Date('2026-03-30T09:00:00.000Z'),
        paperSpec: { paperSize: 'a3' },
      },
      {
        id: 3,
        category: '3d',
        paymentStatus: 'paid',
        totalPrice: 200,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2026-03-29T09:00:00.000Z'),
      },
      {
        id: 4,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 150,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2026-03-05T09:00:00.000Z'),
        paperSpec: { paperSize: 'a4' },
      },
      {
        id: 5,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 90,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2026-02-12T09:00:00.000Z'),
        paperSpec: { paperSize: 'a5' },
      },
      {
        id: 6,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 400,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2025-11-10T09:00:00.000Z'),
        paperSpec: { paperSize: 'a2' },
      },
      {
        id: 7,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 50,
        orderStatus: OrderStatus.CANCELLED,
        createdAt: new Date('2026-03-15T09:00:00.000Z'),
        paperSpec: { paperSize: 'a1' },
      },
    ] as Order[]);

    const analytics = await (controller as any).getAnalytics('30D');

    expect(analytics.sales).toEqual(
      expect.arrayContaining([
        { label: 'Mar 31', value: 100 },
        { label: 'Mar 30', value: 0 },
        { label: 'Mar 29', value: 200 },
        { label: 'Mar 05', value: 150 },
      ]),
    );
    expect(analytics.volume).toEqual(
      expect.arrayContaining([
        { label: 'Mar 31', value: 1 },
        { label: 'Mar 30', value: 1 },
        { label: 'Mar 29', value: 1 },
        { label: 'Mar 15', value: 1 },
      ]),
    );
    expect(analytics.paperSizeDemand).toEqual([
      { label: 'A4', value: 2 },
      { label: 'A3', value: 1 },
    ]);
  });

  it('returns six-month sales and volume data from orders for the mobile dashboard endpoints', async () => {
    ordersRepo.find.mockResolvedValue([
      {
        id: 1,
        paymentStatus: 'paid',
        totalPrice: 400,
        createdAt: new Date('2025-11-10T09:00:00.000Z'),
      },
      {
        id: 2,
        paymentStatus: 'paid',
        totalPrice: 90,
        createdAt: new Date('2026-02-12T09:00:00.000Z'),
      },
      {
        id: 3,
        paymentStatus: 'paid',
        totalPrice: 450,
        createdAt: new Date('2026-03-31T09:00:00.000Z'),
      },
      {
        id: 4,
        paymentStatus: 'pending',
        totalPrice: 999,
        createdAt: new Date('2026-03-20T09:00:00.000Z'),
      },
    ] as Order[]);

    await expect(controller.getSales()).resolves.toEqual([
      { month: 'Oct', value: 0 },
      { month: 'Nov', value: 400 },
      { month: 'Dec', value: 0 },
      { month: 'Jan', value: 0 },
      { month: 'Feb', value: 90 },
      { month: 'Mar', value: 450 },
    ]);

    await expect(controller.getVolume()).resolves.toEqual([
      { month: 'Oct', value: 0 },
      { month: 'Nov', value: 1 },
      { month: 'Dec', value: 0 },
      { month: 'Jan', value: 0 },
      { month: 'Feb', value: 1 },
      { month: 'Mar', value: 2 },
    ]);
  });

  describe('getBadgeCounts', () => {
    it('returns correct newOrders and pendingTopUps counts', async () => {
      ordersRepo.count.mockResolvedValue(3);
      (
        creditsService as jest.Mocked<Pick<CreditsService, 'getPendingCount'>>
      ).getPendingCount.mockResolvedValue(2);

      const result = await controller.getBadgeCounts();

      expect(ordersRepo.count).toHaveBeenCalledWith({
        where: {
          orderStatus: In([
            OrderStatus.ORDER_PLACED,
            OrderStatus.FILE_VERIFIED,
          ]),
        },
      });
      expect(result).toEqual({ newOrders: 3, pendingTopUps: 2 });
    });

    it('returns 0 for both when nothing is pending', async () => {
      ordersRepo.count.mockResolvedValue(0);
      (
        creditsService as jest.Mocked<Pick<CreditsService, 'getPendingCount'>>
      ).getPendingCount.mockResolvedValue(0);

      const result = await controller.getBadgeCounts();

      expect(result).toEqual({ newOrders: 0, pendingTopUps: 0 });
    });
  });

  describe('getAllUsers', () => {
    it('includes profiling metadata for admin user management', async () => {
      usersRepo.find.mockResolvedValue([
        {
          id: 1,
          fullName: 'Maria Santos',
          email: 'maria@gridprint.ph',
          phoneNumber: '+639171234567',
          role: 'customer',
          isActive: true,
          isProfileComplete: true,
          profileCategory: 'student',
          profileField: 'architecture',
          course: 'BS Architecture',
          organization: 'Mapua University',
          printingPreferences: ['plotting_blueprints', 'high_res_color'],
          createdAt: new Date('2026-03-01T00:00:00.000Z'),
          updatedAt: new Date('2026-03-15T00:00:00.000Z'),
        } as User,
      ]);

      await expect(controller.getAllUsers()).resolves.toEqual([
        expect.objectContaining({
          profile_category: 'student',
          profile_field: 'architecture',
          course: 'BS Architecture',
          organization: 'Mapua University',
          printing_preferences: [
            'plotting_blueprints',
            'high_res_color',
          ],
        }),
      ]);
    });
  });
});
