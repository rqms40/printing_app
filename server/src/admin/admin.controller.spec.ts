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
import * as userInsights from './user-insights';

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
    jest.restoreAllMocks();
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

    const expectedSales = Array.from({ length: 30 }, (_, index) => {
      const day = index + 2;
      const label = `Mar ${String(day).padStart(2, '0')}`;

      if (day === 5) {
        return { label, value: 150 };
      }

      if (day === 29) {
        return { label, value: 200 };
      }

      if (day === 31) {
        return { label, value: 100 };
      }

      return { label, value: 0 };
    });

    const expectedVolume = Array.from({ length: 30 }, (_, index) => {
      const day = index + 2;
      const label = `Mar ${String(day).padStart(2, '0')}`;

      if ([5, 15, 29, 30, 31].includes(day)) {
        return { label, value: 1 };
      }

      return { label, value: 0 };
    });

    expect(ordersRepo.find).toHaveBeenCalledWith({
      relations: ['paperSpec'],
    });
    expect(analytics.sales).toEqual(expectedSales);
    expect(analytics.volume).toEqual(expectedVolume);
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
          printing_preferences: ['plotting_blueprints', 'high_res_color'],
        }),
      ]);
    });
  });

  describe('getUserDetail', () => {
    it('loads one user and only that user orders for the admin show page', async () => {
      const user = {
        id: 42,
        email: 'maria@gridprint.ph',
        createdAt: new Date('2026-03-01T00:00:00.000Z'),
        updatedAt: new Date('2026-03-15T00:00:00.000Z'),
      } as User;
      const orders = [
        {
          id: 10,
          userId: 42,
          createdAt: new Date('2026-03-31T09:00:00.000Z'),
        },
      ] as Order[];
      const detailPayload = {
        user: { id: 42 },
        metrics: { total_orders: 1 },
        recent_orders: [],
      } as unknown as userInsights.AdminUserDetailPayload;

      usersRepo.findOneOrFail.mockResolvedValue(user);
      ordersRepo.find.mockResolvedValue(orders);
      const buildDetailSpy = jest
        .spyOn(userInsights, 'buildAdminUserDetailPayload')
        .mockReturnValue(detailPayload);

      await expect((controller as any).getUserDetail(42)).resolves.toBe(
        detailPayload,
      );

      expect(usersRepo.findOneOrFail).toHaveBeenCalledWith({
        where: { id: 42 },
      });
      expect(ordersRepo.find).toHaveBeenCalledWith({
        where: { userId: 42 },
        order: { createdAt: 'DESC' },
      });
      expect(buildDetailSpy).toHaveBeenCalledWith(user, orders);
    });
  });

  describe('getUsersAnalytics', () => {
    it('loads users and orders before delegating analytics shaping', async () => {
      const users = [
        { id: 2, createdAt: new Date('2026-03-31T00:00:00.000Z') } as User,
      ];
      const orders = [
        { id: 9, userId: 2, createdAt: new Date('2026-03-30T00:00:00.000Z') },
      ] as Order[];
      const analyticsPayload = {
        summary: {
          total_customers: 1,
          new_customers: 1,
          active_customers: 1,
          dormant_customers: 0,
          profile_completion_rate: 0,
          total_orders: 1,
          paid_orders: 0,
          total_revenue: 0,
          average_order_value: 0,
        },
        signup_trend: [],
        profile_category_mix: [],
        profile_field_mix: [],
        top_segments: [],
        preference_mix: [],
        activity_split: [],
        revenue_by_segment: [],
      } as userInsights.AdminUsersAnalyticsPayload;

      usersRepo.find.mockResolvedValue(users);
      ordersRepo.find.mockResolvedValue(orders);
      const normalizeSpy = jest
        .spyOn(userInsights, 'normalizeUserInsightsPeriod')
        .mockReturnValue('30D');
      const buildAnalyticsSpy = jest
        .spyOn(userInsights, 'buildAdminUsersAnalyticsPayload')
        .mockReturnValue(analyticsPayload);

      await expect(
        (controller as any).getUsersAnalytics('invalid'),
      ).resolves.toBe(analyticsPayload);

      expect(normalizeSpy).toHaveBeenCalledWith('invalid');
      expect(usersRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(ordersRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
      });
      expect(buildAnalyticsSpy).toHaveBeenCalledWith(
        users,
        orders,
        '30D',
        expect.any(Date),
      );
    });
  });
});
