import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';

import { AdminController } from './admin.controller';
import { OrdersService } from '../orders/orders.service';
import { RidersService } from '../riders/riders.service';
import { OrdersGateway } from '../orders/orders.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
  PricingStatus,
} from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { CreditsService } from '../credits/credits.service';
import { TamSurvey } from '../tam-surveys/entities/tam-survey.entity';
import { TamSurveySettings } from '../tam-surveys/entities/tam-survey-settings.entity';
import { RiderProfile } from '../riders/entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../riders/entities/delivery-assignment.entity';
import { SuppliersService } from '../suppliers/suppliers.service';
import { SupplierAssignment } from '../matching/entities/supplier-assignment.entity';
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
  let riderProfilesRepo: jest.Mocked<Partial<Repository<RiderProfile>>>;
  let assignmentsRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let creditsService: jest.Mocked<Partial<CreditsService>>;
  let ordersService: jest.Mocked<
    Pick<OrdersService, 'updateStatus' | 'attachCatalogSnapshots'>
  >;
  let ridersService: {
    getAllRidersWithUser: jest.Mock;
    assignOrderToRider: jest.Mock;
  };
  let ordersGateway: jest.Mocked<Partial<OrdersGateway>>;
  let notificationsService: jest.Mocked<Partial<NotificationsService>>;
  let suppliersService: {
    findByUserIdOrNull: jest.Mock;
    toAdminSupplierSnapshot: jest.Mock;
  };

  beforeEach(async () => {
    ordersRepo = mockRepo();
    usersRepo = mockRepo();
    riderProfilesRepo = {
      findOneOrFail: jest.fn(),
    };
    assignmentsRepo = {
      create: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    creditsService = { getPendingCount: jest.fn() };
    ordersService = {
      updateStatus: jest.fn(),
      attachCatalogSnapshots: jest.fn(async (orders) => orders),
    };
    ridersService = {
      getAllRidersWithUser: jest.fn(),
      assignOrderToRider: jest.fn(),
    };
    ordersGateway = {
      notifyOrderUpdate: jest.fn(),
      notifyRiderAssignment: jest.fn(),
    };
    notificationsService = {
      create: jest.fn(),
    };
    suppliersService = {
      findByUserIdOrNull: jest.fn().mockResolvedValue(null),
      toAdminSupplierSnapshot: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: OrdersService, useValue: ordersService },
        {
          provide: RidersService,
          useValue: ridersService,
        },
        { provide: CreditsService, useValue: creditsService },
        { provide: OrdersGateway, useValue: ordersGateway },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: SuppliersService, useValue: suppliersService },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(User), useValue: usersRepo },
        {
          provide: getRepositoryToken(RiderProfile),
          useValue: riderProfilesRepo,
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentsRepo,
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: getRepositoryToken(TamSurvey), useValue: mockRepo() },
        {
          provide: getRepositoryToken(TamSurveySettings),
          useValue: mockRepo(),
        },
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
        items: [
          {
            category: 'paper',
            quantity: 1,
            specValues: [{ specKey: 'paper_size', value: 'a4' }],
          },
        ],
      },
      {
        id: 2,
        category: 'paper',
        paymentStatus: 'pending',
        totalPrice: 80,
        orderStatus: OrderStatus.PRODUCTION,
        createdAt: new Date('2026-03-30T09:00:00.000Z'),
        items: [
          {
            category: 'paper',
            quantity: 1,
            specValues: [{ specKey: 'paper_size', value: 'a3' }],
          },
        ],
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
        items: [
          {
            category: 'paper',
            quantity: 1,
            specValues: [{ specKey: 'paper_size', value: 'a4' }],
          },
        ],
      },
      {
        id: 5,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 90,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2026-02-12T09:00:00.000Z'),
        items: [
          {
            category: 'paper',
            quantity: 1,
            specValues: [{ specKey: 'paper_size', value: 'a5' }],
          },
        ],
      },
      {
        id: 6,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 400,
        orderStatus: OrderStatus.DELIVERED,
        createdAt: new Date('2025-11-10T09:00:00.000Z'),
        items: [
          {
            category: 'paper',
            quantity: 1,
            specValues: [{ specKey: 'paper_size', value: 'a2' }],
          },
        ],
      },
      {
        id: 7,
        category: 'paper',
        paymentStatus: 'paid',
        totalPrice: 50,
        orderStatus: OrderStatus.CANCELLED,
        createdAt: new Date('2026-03-15T09:00:00.000Z'),
        items: [
          {
            category: 'paper',
            quantity: 1,
            specValues: [{ specKey: 'paper_size', value: 'a1' }],
          },
        ],
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
      relations: ['items', 'items.specValues'],
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
            OrderStatus.SUBMITTED,
            OrderStatus.NEEDS_QA,
            OrderStatus.APPROVED_FOR_MATCHING,
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

  describe('mapOrder', () => {
    it('projects an arbitrary pending RFQ leaf without Paper/3D coercion or compatibility zeros', () => {
      const promisedAt = new Date('2026-08-14T09:00:00.000Z');
      const createdAt = new Date('2026-08-10T09:00:00.000Z');
      const order = {
        id: 17,
        orderId: 'ORD-10017',
        userId: 2,
        category: 'business-store-signages',
        quantity: 2,
        totalPrice: 0,
        deliveryFee: 0,
        finalTotalMinor: null,
        deliveryFeeMinor: null,
        quotedTotalMinor: null,
        pricingStatus: PricingStatus.PENDING_QUOTE,
        quotedAt: null,
        quoteAcceptedAt: null,
        quotedByUserId: null,
        promisedCompletionAt: null,
        paymentMethod: 'unselected',
        paymentStatus: 'pending',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
        deliveryOption: 'delivery',
        batchOrder: {
          subtotal: 0,
          deliveryFee: 250,
          totalPrice: 0,
          priorityFee: 0,
          extraDestinationFee: 0,
        },
        currentSupplierAssignment: null,
        matchingOutcome: {
          code: 'no_eligible_supplier',
          message: 'No eligible supplier covers order 17',
        },
        items: [
          {
            id: 21,
            orderId: 17,
            category: 'business-store-signages',
            categoryId: 31,
            categorySlug: 'business-store-signages',
            categoryName: 'Business & Store Signages',
            pricingModel: 'quote_required',
            requiredAt: promisedAt,
            quantity: 2,
            totalPrice: 0,
            catalogProduct: {
              slug: 'business-store-signages',
              name: 'Business & Store Signages',
              groupSlug: 'awards-signages',
              groupName: 'Recognition, Awards & Signage',
              groupDescription: 'Recognition and visible brand spaces.',
              examples: ['Acrylic build-up letters', 'LED neon flex'],
            },
            specValues: [
              {
                specKey: 'material',
                specLabel: 'Material',
                inputType: 'text',
                value: 'acrylic',
                displayValue: 'Premium acrylic',
                optionId: null,
                optionLabel: null,
                fixedFee: 0,
                unitCost: 0,
              },
            ],
          },
        ],
        statusHistory: [],
        createdAt,
        updatedAt: createdAt,
      } as unknown as Order;

      const projected = (controller as any).mapOrder(order);

      expect(projected).toMatchObject({
        category: 'business-store-signages',
        pricing_status: 'pending_quote',
        quoted_total_minor: null,
        quoted_at: null,
        quote_accepted_at: null,
        quoted_by_user_id: null,
        promised_completion_at: null,
        current_supplier_assignment: null,
        matching_outcome: { code: 'no_eligible_supplier' },
        unmet_coverage: true,
        total_price: null,
        delivery_fee: null,
        priority_fee: null,
        extra_destination_fee: null,
      });
      expect(projected.items[0]).toMatchObject({
        category: 'business-store-signages',
        category_slug: 'business-store-signages',
        category_name: 'Business & Store Signages',
        group_slug: 'awards-signages',
        group_name: 'Recognition, Awards & Signage',
        group_description: 'Recognition and visible brand spaces.',
        examples: ['Acrylic build-up letters', 'LED neon flex'],
        required_at: promisedAt,
        total_price: null,
        specs: [
          expect.objectContaining({
            key: 'material',
            label: 'Material',
            value: 'acrylic',
            display_value: 'Premium acrylic',
          }),
        ],
        paper_specs: null,
        three_d_specs: null,
      });
      expect(projected.items[0].specs[0]).not.toHaveProperty('fixed_fee');
      expect(projected.items[0].specs[0]).not.toHaveProperty('unit_cost');
    });

    it('keeps quoted minor-unit money string-safe and exposes the current assignment terms', () => {
      const quotedAt = new Date('2026-08-10T09:00:00.000Z');
      const promisedAt = new Date('2026-08-14T09:00:00.000Z');
      const order = {
        id: 18,
        orderId: 'ORD-10018',
        userId: 2,
        category: 'custom-apparel',
        quantity: 12,
        totalPrice: 0,
        deliveryFee: 0,
        quotedTotalMinor: '9007199254740993',
        pricingStatus: PricingStatus.QUOTED,
        quotedAt,
        quoteAcceptedAt: null,
        quotedByUserId: 77,
        promisedCompletionAt: promisedAt,
        paymentMethod: 'unselected',
        paymentStatus: 'pending',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
        deliveryOption: 'delivery',
        currentSupplierAssignment: {
          id: 91,
          supplierId: 12,
          decision: 'accepted',
          rankPosition: 1,
          acceptanceDeadline: new Date('2026-08-11T09:00:00.000Z'),
          finalPriceMinor: '9007199254740993',
          promisedDate: promisedAt,
          decidedAt: quotedAt,
        },
        items: [],
        statusHistory: [],
        createdAt: quotedAt,
        updatedAt: quotedAt,
      } as unknown as Order;

      const projected = (controller as any).mapOrder(order);

      expect(projected.quoted_total_minor).toBe('9007199254740993');
      expect(projected.current_supplier_assignment).toMatchObject({
        id: 91,
        supplier_id: 12,
        decision: 'accepted',
        final_price_minor: '9007199254740993',
        promised_date: promisedAt,
      });
    });

    it('preserves legacy spec branches only for exact paper and 3d leaves', () => {
      const base = {
        id: 19,
        orderId: 'ORD-10019',
        userId: 2,
        quantity: 1,
        totalPrice: 10,
        deliveryFee: 0,
        quotedTotalMinor: null,
        pricingStatus: PricingStatus.ACCEPTED,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        orderStatus: OrderStatus.COMPLETED,
        deliveryOption: 'pickup',
        statusHistory: [],
        createdAt: new Date('2026-08-01T09:00:00.000Z'),
        updatedAt: new Date('2026-08-01T09:00:00.000Z'),
      };
      const values = [
        {
          specKey: 'file_format',
          specLabel: 'File Format',
          value: 'stl',
          displayValue: 'STL',
          optionId: null,
          optionLabel: null,
        },
      ];

      const unknown = (controller as any).mapOrder({
        ...base,
        category: 'future-model-service',
        items: [{ category: 'future-model-service', specValues: values }],
      } as unknown as Order);
      const legacy = (controller as any).mapOrder({
        ...base,
        category: '3d',
        items: [{ category: '3d', categorySlug: '3d', specValues: values }],
      } as unknown as Order);

      expect(unknown.category).toBe('future-model-service');
      expect(unknown.three_d_specs).toBeNull();
      expect(unknown.items[0].three_d_specs).toBeNull();
      expect(legacy.three_d_specs).toMatchObject({ file_format: 'stl' });
      expect(legacy.items[0].three_d_specs).toMatchObject({
        file_format: 'stl',
      });
    });

    it('includes pinned delivery coordinates and unique multidrop destinations', () => {
      const order = {
        id: 7,
        orderId: 'ORD-10007',
        userId: 1,
        category: 'batch',
        quantity: 2,
        totalPrice: 12,
        deliveryFee: 0,
        paymentMethod: 'gcash',
        paymentStatus: 'pending',
        orderStatus: OrderStatus.SUBMITTED,
        deliveryOption: 'delivery',
        destination: {
          id: 1,
          addressId: null,
          label: 'Drop 1',
          sortOrder: 0,
          fullAddress: 'Drop one',
          barangay: null,
          city: 'Davao City',
          province: null,
          zipCode: null,
          landmark: 'Gate 1',
          latitude: '7.0713113',
          longitude: '125.6123279',
        },
        batchOrder: {
          slotBookingId: 5,
          speedTier: 'scheduled',
          priorityFee: '0.00',
          extraDestinationFee: '20.00',
          deliveryType: 'local',
        },
        items: [
          {
            id: 7,
            orderId: 7,
            category: 'paper',
            quantity: 1,
            totalPrice: 2,
            destinationId: 1,
            destination: {
              id: 1,
              addressId: null,
              label: 'Drop 1',
              sortOrder: 0,
              fullAddress: 'Drop one',
              barangay: null,
              city: 'Davao City',
              province: null,
              zipCode: null,
              landmark: 'Gate 1',
              latitude: '7.0713113',
              longitude: '125.6123279',
            },
            specValues: [],
          },
          {
            id: 8,
            orderId: 7,
            category: 'paper',
            quantity: 1,
            totalPrice: 10,
            destinationId: 2,
            destination: {
              id: 2,
              addressId: null,
              label: 'Drop 2',
              sortOrder: 1,
              fullAddress: 'Drop two',
              barangay: null,
              city: 'Davao City',
              province: null,
              zipCode: null,
              landmark: null,
              latitude: '7.0900000',
              longitude: '125.6200000',
            },
            specValues: [],
          },
        ],
        statusHistory: [],
        createdAt: new Date('2026-05-02T19:00:36.788Z'),
        updatedAt: new Date('2026-05-02T19:00:36.788Z'),
      } as unknown as Order;

      const mapped = (controller as any).mapOrder(order);

      expect(mapped.payment_method).toBe('gcash');
      expect(mapped.delivery_address).toMatchObject({
        label: 'Drop 1',
        full_address: 'Drop one',
        latitude: 7.0713113,
        longitude: 125.6123279,
      });
      expect(mapped.destinations).toEqual([
        expect.objectContaining({
          id: 1,
          label: 'Drop 1',
          latitude: 7.0713113,
          longitude: 125.6123279,
        }),
        expect.objectContaining({
          id: 2,
          label: 'Drop 2',
          latitude: 7.09,
          longitude: 125.62,
        }),
      ]);
      expect(mapped.delivery_slot_booking_id).toBe(5);
      expect(mapped.extra_destination_fee).toBe(20);
      // QA mandatory: submitted may only go to needs_qa / file_rejected (cancel filtered).
      expect(mapped.allowed_next_statuses).toEqual([
        OrderStatus.NEEDS_QA,
        OrderStatus.FILE_REJECTED,
      ]);
    });

    it('projects pickup completion but never exposes rider-owned or cancellation transitions', () => {
      const mapOrder = (
        controller as unknown as {
          mapOrder(order: Order): { allowed_next_statuses: OrderStatus[] };
        }
      ).mapOrder.bind(controller);
      const map = (orderStatus: OrderStatus, deliveryOption: string) =>
        mapOrder({
          id: 7,
          orderId: 'ORD-10007',
          userId: 1,
          category: 'paper',
          quantity: 1,
          totalPrice: 12,
          deliveryFee: 0,
          paymentMethod: 'grid_credits',
          paymentStatus: 'paid',
          orderStatus,
          deliveryOption,
          items: [],
          statusHistory: [],
          createdAt: new Date('2026-05-02T19:00:36.788Z'),
          updatedAt: new Date('2026-05-02T19:00:36.788Z'),
        } as unknown as Order).allowed_next_statuses;

      expect(map(OrderStatus.READY_FOR_DISPATCH, 'pickup')).toEqual([
        OrderStatus.COLLECTED_BY_CUSTOMER,
      ]);
      expect(map(OrderStatus.READY_FOR_DISPATCH, 'delivery')).toEqual([]);
      expect(map(OrderStatus.RIDER_ASSIGNED, 'delivery')).toEqual([]);
      // payment_authorized is money-path only (authorize-payment), not status dropdown.
      expect(map(OrderStatus.APPROVED_FOR_MATCHING, 'delivery')).toEqual([
        OrderStatus.SUPPLIER_ASSIGNED,
        OrderStatus.AWAITING_PAYMENT,
      ]);
    });

    it('includes proof of delivery metadata for admin order review', () => {
      const order = {
        id: 7,
        orderId: 'ORD-10007',
        userId: 1,
        category: 'paper',
        quantity: 1,
        totalPrice: 12,
        deliveryFee: 0,
        paymentMethod: 'gcash',
        paymentStatus: 'paid',
        orderStatus: OrderStatus.DELIVERED,
        deliveryOption: 'delivery',
        assignedRiderId: 70,
        assignedRiderContact: {
          deliveryAssignmentId: 99,
          deliveryStatus: DeliveryStatus.DELIVERED,
          proof: {
            type: 'photo',
            fileId: 55,
            objectKey: 'uploads/pod/55.jpg',
            signatureData: null,
            capturedAt: new Date('2026-05-02T19:00:36.788Z'),
            capturedByRiderId: 10,
          },
        },
        statusHistory: [],
        createdAt: new Date('2026-05-02T19:00:36.788Z'),
        updatedAt: new Date('2026-05-02T19:00:36.788Z'),
      } as unknown as Order;

      const mapped = (controller as any).mapOrder(order);

      expect(mapped.delivery_proof).toEqual({
        type: 'photo',
        file_id: 55,
        object_key: 'uploads/pod/55.jpg',
        signature_data: null,
        captured_at: new Date('2026-05-02T19:00:36.788Z'),
        captured_by_rider_id: 10,
      });
    });
  });

  describe('updateOrderStatus', () => {
    it('records an admin-provided status reason without accepting an actor id', async () => {
      const savedOrder = { id: 42 } as Order;
      const dto = {
        status: OrderStatus.FILE_REJECTED,
        notes: 'Customer file is corrupted',
      };
      ordersService.updateStatus.mockResolvedValue(savedOrder);

      await controller.updateOrderStatus(42, dto, { user: { sub: 31 } });

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        42,
        OrderStatus.FILE_REJECTED,
        {},
        {
          actorUserId: 31,
          actorRole: null,
          reason: 'Customer file is corrupted',
        },
      );
    });

    it('uses the authenticated admin as the status history actor', async () => {
      const savedOrder = { id: 42 } as Order;
      ordersService.updateStatus.mockResolvedValue(savedOrder);

      await expect(
        controller.updateOrderStatus(
          42,
          { status: OrderStatus.APPROVED_FOR_MATCHING },
          { user: { sub: 31 } },
        ),
      ).resolves.toBe(savedOrder);

      expect(ordersService.updateStatus).toHaveBeenCalledWith(
        42,
        OrderStatus.APPROVED_FOR_MATCHING,
        {},
        {
          actorUserId: 31,
          actorRole: null,
          reason: 'Admin status update',
        },
      );
    });

    it('rejects rider_assigned without using the rider assignment endpoint', async () => {
      await expect(
        controller.updateOrderStatus(42, {
          status: OrderStatus.RIDER_ASSIGNED,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });

    it('rejects cancellation in favor of the complete cancellation workflow', async () => {
      await expect(
        controller.updateOrderStatus(42, {
          status: OrderStatus.CANCELLED,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });
  });

  describe('assignRider', () => {
    it('delegates transactional assignment with the authenticated admin actor', async () => {
      const riderProfile = { id: 7, userId: 70 } as RiderProfile;
      const assignment = { id: 99 } as DeliveryAssignment;
      const order = {
        id: 42,
        orderId: 'ORD-10042',
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      ridersService.assignOrderToRider.mockResolvedValue({
        order,
        assignment,
        riderProfile,
      });

      await expect(
        controller.assignRider(42, 7, { user: { sub: 31 } }),
      ).resolves.toBe(order);

      expect(ridersService.assignOrderToRider).toHaveBeenCalledWith(
        42,
        7,
        31,
        null,
      );
      expect(assignmentsRepo.save).not.toHaveBeenCalled();
      expect(ordersService.updateStatus).not.toHaveBeenCalled();
    });

    it('creates an active delivery assignment, notifies the rider, and emits realtime updates', async () => {
      const riderProfile = {
        id: 7,
        userId: 70,
      } as RiderProfile;
      const assignment = {
        id: 99,
        orderId: 42,
        riderId: 7,
        status: DeliveryStatus.ASSIGNED,
      } as DeliveryAssignment;
      const savedOrder = {
        id: 42,
        orderId: 'ORD-10042',
        assignedRiderId: 70,
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;

      ridersService.assignOrderToRider.mockResolvedValue({
        order: savedOrder,
        assignment,
        riderProfile,
      });

      await expect(
        controller.assignRider(42, 7, { user: { sub: 31 } }),
      ).resolves.toBe(savedOrder);

      expect(ridersService.assignOrderToRider).toHaveBeenCalledWith(
        42,
        7,
        31,
        null,
      );
      expect(ordersRepo.update).not.toHaveBeenCalled();
      expect(ordersGateway.notifyOrderUpdate).not.toHaveBeenCalled();
      expect(ordersGateway.notifyRiderAssignment).toHaveBeenCalledWith(70, {
        assignmentId: 99,
        orderId: 42,
        orderRef: 'ORD-10042',
        status: DeliveryStatus.ASSIGNED,
        change: 'assigned',
      });
      expect(notificationsService.create).toHaveBeenCalledWith({
        userId: 70,
        title: 'New delivery assignment',
        message: "You've been assigned to order ORD-10042.",
        type: 'rider_assigned',
        orderRef: 'ORD-10042',
        metadata: {
          assignmentId: 99,
          orderId: 42,
          orderRef: 'ORD-10042',
        },
      });
    });

    it('returns the committed order when rider post-commit effects fail independently', async () => {
      const riderProfile = { id: 7, userId: 70 } as RiderProfile;
      const assignment = { id: 99 } as DeliveryAssignment;
      const order = {
        id: 42,
        orderId: 'ORD-10042',
        orderStatus: OrderStatus.RIDER_ASSIGNED,
      } as Order;
      ridersService.assignOrderToRider.mockResolvedValue({
        order,
        assignment,
        riderProfile,
      });
      ordersGateway.notifyRiderAssignment.mockImplementation(() => {
        throw new Error('WS unavailable');
      });
      notificationsService.create.mockRejectedValue(
        new Error('Notification unavailable'),
      );

      await expect(
        controller.assignRider(42, 7, { user: { sub: 31 } }),
      ).resolves.toBe(order);

      expect(ordersGateway.notifyRiderAssignment).toHaveBeenCalledTimes(1);
      expect(notificationsService.create).toHaveBeenCalledTimes(1);
    });

    it('rejects unavailable riders', async () => {
      ridersService.assignOrderToRider.mockRejectedValue(
        new BadRequestException('Rider is not available for assignment'),
      );

      await expect(
        controller.assignRider(42, 7, { user: { sub: 31 } }),
      ).rejects.toThrow(BadRequestException);

      expect(ridersService.assignOrderToRider).toHaveBeenCalledWith(
        42,
        7,
        31,
        null,
      );
      expect(ordersGateway.notifyRiderAssignment).not.toHaveBeenCalled();
    });
  });

  describe('getAllUsers', () => {
    it('includes profiling metadata for admin user management', async () => {
      usersRepo.find.mockResolvedValue([
        {
          id: 1,
          fullName: 'Maria Santos',
          email: 'maria@gridgo.ph',
          phoneNumber: '+639171234567',
          role: 'client',
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
        email: 'maria@gridgo.ph',
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
      expect(suppliersService.findByUserIdOrNull).toHaveBeenCalledWith(42);
      expect(buildDetailSpy).toHaveBeenCalledWith(user, orders, null);
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
