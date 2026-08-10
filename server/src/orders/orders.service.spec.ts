/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FilesService } from '../files/files.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, MoreThanOrEqual, Repository } from 'typeorm';
import { BETA_ORDER_LIMIT_REACHED } from './dto/beta-order-limit.error';
import {
  applyMarketplacePaymentDefaults,
  calculateChargeTotal,
  OrdersService,
} from './orders.service';
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
  PricingStatus,
} from './entities/order.entity';
import { OrderStatusHistory } from './entities/order-status-history.entity';
import { OrderItem } from './entities/order-item.entity';
import { OrderItemSpecValue } from './entities/order-item-spec-value.entity';
import { PaperSpec } from './entities/paper-specs.entity';
import { ThreeDSpec } from './entities/three-d-specs.entity';
import { OrdersGateway } from './orders.gateway';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';
import { CreditsService } from '../credits/credits.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  DeliveryAssignment,
  DeliveryStatus,
} from '../riders/entities/delivery-assignment.entity';
import { SupplierAssignment } from '../matching/entities/supplier-assignment.entity';
import { SupplierAssignmentDecision } from '../matching/entities/supplier-assignment.entity';
import { Address } from '../addresses/entities/address.entity';
import { DeliveryDestination } from './entities/delivery-destination.entity';
import { DeliverySlotsService } from '../delivery-slots/delivery-slots.service';
import { DeliverySettingsService } from '../delivery-slots/delivery-settings.service';
import { DeliverySlotsGateway } from '../delivery-slots/delivery-slots.gateway';
import { DeliverySlotBooking } from '../delivery-slots/entities/delivery-slot-booking.entity';
import {
  CancellationClosedException,
  ServiceAreaMismatchException,
  SlotFullException,
} from '../delivery-slots/exceptions';
import { BatchOrder } from './entities/batch-order.entity';
import { PrinterProfileService } from '../printer-profile/printer-profile.service';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { TamSurveysService } from '../tam-surveys/tam-surveys.service';
import { DeliverySpeedTier } from './enums/delivery-speed-tier.enum';
import { CatalogPricingService } from '../products/catalog-pricing.service';
import { CatalogReadService } from '../products/catalog-read.service';
import { CatalogValidationService } from '../products/catalog-validation.service';
import { ProductCategory } from '../products/entities/product-category.entity';
import {
  InputType,
  PricingModel,
  PricingRole,
  ValueType,
} from '../products/enums/catalog.enums';
import { User } from '../users/entities/user.entity';
import { TamSurveyRequirement } from '../tam-surveys/entities/tam-survey-requirement.entity';
import {
  DispatchPlan,
  DispatchPlanStatus,
} from '../riders/entities/dispatch-plan.entity';
import { DispatchStopStatus } from '../riders/entities/dispatch-plan-stop.entity';
import { BetaModeSettings } from '../beta-mode/entities/beta-mode-settings.entity';
import { AuditService } from '../audit/audit.service';

const specValueRepoProvider = () => ({
  provide: getRepositoryToken(OrderItemSpecValue),
  useValue: {
    create: jest.fn((data) => data),

    save: jest.fn(async (data) => data),
  },
});

const dispatchPlanRepoProvider = () => ({
  provide: getRepositoryToken(DispatchPlan),
  useValue: { find: jest.fn().mockResolvedValue([]) },
});

const catalogPricingProvider = () => ({
  provide: CatalogPricingService,
  useValue: {
    quote: jest.fn(async (dto) => {
      const items = dto.items.map((item: any) => {
        const is3d = item.categorySlug === '3d';
        const printSubtotal = is3d
          ? 300
          : item.categorySlug === 'paper'
            ? 120
            : 250;
        return {
          categoryId: is3d ? 2 : 1,
          categorySlug: item.categorySlug || 'paper',
          categoryName: is3d ? '3D Printing' : 'Paper Printing',
          pricingModel: is3d
            ? 'base_plus_material_estimate'
            : 'per_page_modifiers',
          quantity: item.quantity ?? 1,
          printSubtotal,
          specSnapshots: [],
          pricingBreakdown: [],
        };
      });
      const subtotal = items.reduce(
        (sum: number, item: { printSubtotal: number }) =>
          sum + item.printSubtotal,
        0,
      );
      return {
        items,
        subtotal,
        deliveryFee: 0,
        serviceFee: 0,
        total: subtotal,
      };
    }),
  },
});

describe('calculateChargeTotal', () => {
  it.each([
    ['blank', ''],
    ['whitespace', '   '],
    ['negative', '-0.01'],
  ])('rejects a %s charge component', (_label, totalPrice) => {
    expect(() => calculateChargeTotal({ totalPrice })).toThrow(
      'Invalid totalPrice charge component',
    );
  });

  it('allows an explicit zero charge component', () => {
    expect(calculateChargeTotal({ totalPrice: '0.00' })).toBe(0);
  });

  it('treats an individual order totalPrice as its print subtotal', () => {
    expect(
      calculateChargeTotal({
        totalPrice: '40.00',
        deliveryFee: '20.00',
      }),
    ).toBe(60);
  });

  it('prefers subtotal over an all-in total and adds decimal-string fees once', () => {
    expect(
      calculateChargeTotal({
        subtotal: '40.00',
        totalPrice: '85.00',
        deliveryFee: '20.00',
        priorityFee: '15.00',
        extraDestinationFee: '10.00',
      }),
    ).toBe(85);
  });

  it('rejects non-numeric charge components instead of returning NaN', () => {
    expect(() =>
      calculateChargeTotal({
        totalPrice: 'not-a-number',
        deliveryFee: '20.00',
      }),
    ).toThrow('Invalid totalPrice charge component');
  });
});

describe('applyMarketplacePaymentDefaults', () => {
  it('sets minor totals, none authorization, and empty snapshot', () => {
    const defaults = applyMarketplacePaymentDefaults({
      totalPrice: 100,
      deliveryFee: 25,
      paymentMethod: 'gridCredits',
    });

    expect(defaults.finalTotalMinor).toBe('12500');
    expect(defaults.deliveryFeeMinor).toBe('2500');
    expect(defaults.paymentAuthorizationStatus).toBe(
      PaymentAuthorizationStatus.NONE,
    );
    expect(defaults.codEligible).toBe(false);
    expect(defaults.authorizationSnapshot).toBeNull();
  });

  it('preserves explicitly provided minor / eligibility values', () => {
    const defaults = applyMarketplacePaymentDefaults({
      totalPrice: 100,
      deliveryFee: 25,
      finalTotalMinor: '999',
      deliveryFeeMinor: '100',
      codEligible: true,
      paymentAuthorizationStatus: PaymentAuthorizationStatus.FAILED,
    });

    expect(defaults.finalTotalMinor).toBe('999');
    expect(defaults.deliveryFeeMinor).toBe('100');
    expect(defaults.codEligible).toBe(true);
    expect(defaults.paymentAuthorizationStatus).toBe(
      PaymentAuthorizationStatus.FAILED,
    );
  });
});

describe('OrdersService', () => {
  let service: OrdersService;
  let repo: jest.Mocked<Partial<Repository<Order>>>;
  let orderItemsRepo: jest.Mocked<Partial<Repository<OrderItem>>>;
  let orderItemSpecValueRepo: jest.Mocked<
    Partial<Repository<OrderItemSpecValue>>
  >;
  let batchRepo: jest.Mocked<Partial<Repository<any>>>;
  let paperSpecsRepo: jest.Mocked<Partial<Repository<PaperSpec>>>;
  let threeDSpecsRepo: jest.Mocked<Partial<Repository<ThreeDSpec>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let supplierAssignmentRepo: jest.Mocked<
    Partial<Repository<SupplierAssignment>>
  >;
  let slotBookingRepo: jest.Mocked<Partial<Repository<DeliverySlotBooking>>>;
  let dispatchPlanRepo: jest.Mocked<Partial<Repository<DispatchPlan>>>;
  let historyRepo: jest.Mocked<Partial<Repository<OrderStatusHistory>>>;
  let addressRepo: jest.Mocked<Partial<Repository<Address>>>;
  let dataSource: Partial<DataSource>;
  let gateway: Partial<OrdersGateway>;
  let firebaseService: Partial<FirebaseService>;
  let usersService: Partial<UsersService>;
  let creditsService: Partial<CreditsService>;
  let paymentsService: {
    assertCodEligibleForCheckout: jest.Mock;
    evaluateCodEligibilityForUser: jest.Mock;
    ensurePendingCodCollection: jest.Mock;
  };
  let notificationsService: Partial<NotificationsService>;
  let catalogPricingService: { quote: jest.Mock };
  let catalogReadService: { getPublicCatalog: jest.Mock };
  let fileMetadataRepo: jest.Mocked<Partial<Repository<FileMetadata>>>;
  let auditService: {
    recordOrderStatusTransition: jest.Mock;
    append: jest.Mock;
  };
  let transactionQuery: jest.Mock;
  let transactionBetaSettingsRepo: { findOne: jest.Mock };
  let transactionUserRepo: { findOne: jest.Mock };

  const mockOrder = {
    id: 1,
    orderId: 'ORD-10001',
    userId: 1,
    orderStatus: OrderStatus.SUBMITTED,
    createdAt: new Date(),
  } as Order;
  const statusContext = {
    actorUserId: 99,
    reason: 'Test status update',
  };

  const _specValueRepoProvider = () => ({
    provide: getRepositoryToken(OrderItemSpecValue),
    useValue: {
      create: jest.fn((data) => data),
      save: jest.fn(async (data) => data),
    },
  });

  const catalogPricingProvider = () => ({
    provide: CatalogPricingService,
    useValue: {
      quote: jest.fn(async (dto) => {
        const items = dto.items.map((item: any, _index: number) => {
          const is3d = item.categorySlug === '3d';
          const printSubtotal = is3d
            ? 300
            : item.categorySlug === 'paper'
              ? 120
              : 250;
          return {
            categoryId: is3d ? 2 : 1,
            categorySlug: item.categorySlug || 'paper',
            categoryName: is3d ? '3D Printing' : 'Paper Printing',
            pricingModel: is3d
              ? 'base_plus_material_estimate'
              : 'per_page_modifiers',
            quantity: item.quantity ?? 1,
            printSubtotal,
            specSnapshots: [],
            pricingBreakdown: [],
          };
        });
        const subtotal = items.reduce(
          (sum: number, item: { printSubtotal: number }) =>
            sum + item.printSubtotal,
          0,
        );
        return {
          items,
          subtotal,
          deliveryFee: 0,
          serviceFee: 0,
          total: subtotal,
        };
      }),
    },
  });

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    };
    orderItemsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    orderItemSpecValueRepo = {
      create: jest.fn((data) => data as OrderItemSpecValue),
      save: jest.fn(async (data) => data as OrderItemSpecValue),
    };
    batchRepo = {
      create: jest.fn(),
      save: jest.fn(),
      count: jest.fn(),
      findOne: jest.fn(),
    };
    paperSpecsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    threeDSpecsRepo = {
      create: jest.fn(),
      save: jest.fn(),
    };
    assignmentRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
    };
    supplierAssignmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    slotBookingRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    dispatchPlanRepo = { find: jest.fn().mockResolvedValue([]) };
    historyRepo = {
      insert: jest.fn(),
    };
    addressRepo = {
      findOne: jest.fn(),
    };
    fileMetadataRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: any) => ({
        id: where.id,
        uploadedBy: 1,
        url: `https://files/${where.id}`,
        originalName: `file-${where.id}.pdf`,
        model3dWidthMm: null,
        model3dDepthMm: null,
        model3dHeightMm: null,
      })),
      findOneOrFail: jest.fn().mockResolvedValue({ model3dWidthMm: null }),
    };
    addressRepo.findOne.mockResolvedValue({
      id: 9,
      userId: 1,
      label: 'Home',
      fullAddress: '9 Main Street',
      city: 'Davao City',
      latitude: 7.0731,
      longitude: 125.6128,
    } as Address);
    gateway = {
      notifyOrderUpdate: jest.fn(),
    };
    firebaseService = {
      sendToDevice: jest.fn().mockResolvedValue('msg-id'),
      sendToMultiple: jest.fn().mockResolvedValue(undefined),
      isAvailable: true,
    };
    usersService = {
      getFcmToken: jest.fn().mockResolvedValue(null),
      findById: jest.fn(),
    };
    creditsService = {
      subtractCredits: jest.fn().mockResolvedValue(undefined),
      refundCredits: jest.fn().mockResolvedValue(undefined),
      reserveCredits: jest.fn().mockResolvedValue({
        balance: 25,
        balanceChanged: true,
        userId: 1,
        transaction: { type: 'reserve' },
      }),
      spendCredits: jest.fn().mockResolvedValue({
        balance: 25,
        balanceChanged: false,
        userId: 1,
        transaction: { type: 'spend' },
      }),
      releaseCredits: jest.fn().mockResolvedValue({
        balance: 100,
        balanceChanged: true,
        userId: 1,
        transaction: { type: 'release' },
      }),
      publishCreditMutation: jest.fn(),
    };
    paymentsService = {
      assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
      evaluateCodEligibilityForUser: jest
        .fn()
        .mockResolvedValue({ eligible: false }),
      ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue(undefined),
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };
    catalogPricingService = {
      quote: jest.fn(async (dto) => {
        const items = dto.items.map((item: any, index: number) => {
          const is3d = item.categorySlug === '3d';
          const printSubtotal = is3d
            ? 300
            : item.categorySlug === 'paper'
              ? 120
              : 250;
          return {
            categoryId: is3d ? 2 : 1,
            categorySlug: item.categorySlug || 'paper',
            categoryName: is3d ? '3D Printing' : 'Paper Printing',
            pricingModel: is3d
              ? 'base_plus_material_estimate'
              : 'per_page_modifiers',
            quantity: item.quantity ?? 1,
            printSubtotal,
            specSnapshots: [
              {
                specDefinitionId: index + 1,
                specKey: is3d ? 'material' : 'paper_size',
                specLabel: is3d ? 'Material' : 'Paper Size',
                inputType: 'select',
                value: is3d ? 'pla' : 'a4',
                displayValue: is3d ? 'PLA' : 'A4',
                optionId: index + 10,
                optionLabel: is3d ? 'PLA' : 'A4',
                multiplier: 1,
                fixedFee: 0,
                unitCost: 0,
                estimatedQuantity: null,
              },
            ],
            pricingBreakdown: [],
          };
        });
        const subtotal = items.reduce(
          (sum: number, item: { printSubtotal: number }) =>
            sum + item.printSubtotal,
          0,
        );
        return {
          items,
          subtotal,
          deliveryFee: 0,
          serviceFee: 0,
          total: subtotal,
        };
      }),
    };
    catalogReadService = {
      getPublicCatalog: jest.fn().mockResolvedValue({
        version: '1.10.0',
        groups: [],
        categories: [],
      }),
    };
    auditService = {
      recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
      append: jest.fn().mockResolvedValue({ id: 1 }),
    };
    orderItemsRepo.create.mockImplementation((data) => data as OrderItem);
    orderItemsRepo.save.mockImplementation(
      async (item) =>
        ({
          id: 1,
          ...item,
        }) as OrderItem,
    );
    transactionQuery = jest
      .fn()
      .mockResolvedValue([{ max_batch_ref: 10000, max_order_ref: 10000 }]);
    transactionBetaSettingsRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1, isEnabled: true }),
    };
    transactionUserRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 1 }),
    };
    dataSource = {
      query: jest.fn().mockResolvedValue([{ is_enabled: true }]),
      getRepository: jest.fn().mockReturnValue(slotBookingRepo),
      transaction: jest.fn(async (runInTransaction) =>
        runInTransaction({
          query: transactionQuery,
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return repo;
            if (entity?.name === 'OrderItem') return orderItemsRepo;
            if (entity?.name === 'OrderItemSpecValue')
              return orderItemSpecValueRepo;
            if (entity?.name === 'PaperSpec') return paperSpecsRepo;
            if (entity?.name === 'ThreeDSpec') return threeDSpecsRepo;
            if (entity?.name === 'BatchOrder') return batchRepo;
            if (entity?.name === 'OrderStatusHistory') return historyRepo;
            if (entity?.name === 'SupplierAssignment')
              return supplierAssignmentRepo;
            if (entity?.name === 'User') return transactionUserRepo;
            if (entity?.name === BetaModeSettings.name)
              return transactionBetaSettingsRepo;
            if (entity?.name === 'DeliveryDestination')
              return {
                create: jest.fn((d) => d),
                save: jest.fn(async (d) => ({ id: 1, ...d })),
              };
            throw new Error(`Unexpected repository ${entity?.name}`);
          },
        }),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: repo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        {
          provide: getRepositoryToken(OrderItemSpecValue),
          useValue: orderItemSpecValueRepo,
        },
        { provide: getRepositoryToken(BatchOrder), useValue: batchRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: paperSpecsRepo },
        { provide: getRepositoryToken(ThreeDSpec), useValue: threeDSpecsRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: supplierAssignmentRepo,
        },
        {
          provide: getRepositoryToken(DispatchPlan),
          useValue: dispatchPlanRepo,
        },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: {
            create: jest.fn((d) => d),
            save: jest.fn(async (d) => ({ id: 1, ...d })),
          },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: fileMetadataRepo,
        },
        { provide: OrdersGateway, useValue: gateway },
        { provide: FirebaseService, useValue: firebaseService },
        { provide: UsersService, useValue: usersService },
        { provide: CreditsService, useValue: creditsService },
        { provide: PaymentsService, useValue: paymentsService },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: TamSurveysService,
          useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        {
          provide: DeliverySlotsService,
          useValue: {
            bookSlot: jest.fn().mockResolvedValue({ id: 1 }),
            getAvailability: jest.fn().mockResolvedValue([
              {
                templateId: 1,
                startTime: '00:00:00',
                endTime: '23:59:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
            ]),
          },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              buildVolumeWidthMm: 999,
              buildVolumeDepthMm: 999,
              buildVolumeHeightMm: 999,
              maxFileSizeMb: 999,
            }),
          },
        },
        catalogPricingProvider(),
        { provide: CatalogPricingService, useValue: catalogPricingService },
        { provide: CatalogReadService, useValue: catalogReadService },
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('freezeAuthorizationSnapshot', () => {
    it('freezes commercial snapshot and marks payment authorized', () => {
      const order = {
        id: 9,
        totalPrice: 100,
        deliveryFee: 20,
        paymentMethod: 'pilot_credit',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        authorizationSnapshot: null,
        finalTotalMinor: '12000',
        deliveryFeeMinor: '2000',
        category: 'paper',
        quantity: 1,
        fileMetadataId: 7,
        estimatedCompletionAt: null,
      } as Order;

      const frozen = service.freezeAuthorizationSnapshot(order, {
        frozenAt: '2026-08-04T15:00:00.000Z',
        commissionMinor: 100,
      });

      expect(frozen.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.AUTHORIZED,
      );
      const snap = frozen.authorizationSnapshot as {
        finalTotalMinor: string;
        commissionMinor: string;
        artworkVersion: number;
        priceMinor: string;
      };
      expect(snap.finalTotalMinor).toBe('12000');
      expect(snap.commissionMinor).toBe('100');
      expect(snap.artworkVersion).toBe(7);

      // Second freeze is a no-op (immutable)
      service.freezeAuthorizationSnapshot(order, { priceMinor: 1 });
      expect(
        (order.authorizationSnapshot as { priceMinor: string }).priceMinor,
      ).toBe('10000');
    });
  });

  describe('acceptQuote (RFQ customer gate)', () => {
    function quotedOrder(overrides: Partial<Order> = {}): Order {
      return {
        id: 42,
        orderId: 'ORD-10042',
        userId: 1,
        batchOrderId: null,
        orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
        pricingStatus: PricingStatus.QUOTED,
        quotedTotalMinor: '12500',
        quotedAt: new Date('2026-08-10T10:00:00Z'),
        quoteAcceptedAt: null,
        quotedByUserId: 55,
        promisedCompletionAt: new Date('2026-08-13T10:00:00Z'),
        paymentMethod: 'unselected',
        paymentStatus: 'pending',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        authorizationSnapshot: null,
        totalPrice: 0,
        deliveryFee: 0,
        finalTotalMinor: null,
        deliveryFeeMinor: null,
        category: 'flyers',
        quantity: 100,
        fileMetadataId: 8,
        estimatedCompletionAt: new Date('2026-08-13T10:00:00Z'),
        codEligible: false,
        ...overrides,
      } as Order;
    }

    function acceptedAssignment(
      overrides: Partial<SupplierAssignment> = {},
    ): SupplierAssignment {
      return {
        id: 17,
        orderId: 42,
        supplierId: 5,
        decision: SupplierAssignmentDecision.ACCEPTED,
        finalPriceMinor: '10000',
        promisedDate: new Date('2026-08-13T10:00:00Z'),
        ...overrides,
      } as SupplierAssignment;
    }

    beforeEach(() => {
      const order = quotedOrder();
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (row) => row as Order);
      supplierAssignmentRepo.find!.mockResolvedValue([acceptedAssignment()]);
    });

    it('accepts the current frozen quote without authorizing or debiting payment', async () => {
      const result = await service.acceptQuote(42, 1, {
        supplierAssignmentId: 17,
        paymentMethod: 'pilot_credit',
      });

      expect(result.orderStatus).toBe(OrderStatus.AWAITING_PAYMENT);
      expect(result.pricingStatus).toBe(PricingStatus.ACCEPTED);
      expect(result.quoteAcceptedAt).toEqual(expect.any(Date));
      expect(result.paymentMethod).toBe('pilot_credit');
      expect(result.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.NONE,
      );
      expect(result.authorizationSnapshot).toBeNull();
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
      expect(creditsService.spendCredits).not.toHaveBeenCalled();
      expect(paymentsService.ensurePendingCodCollection).not.toHaveBeenCalled();
      expect(historyRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 42,
          fromStatus: OrderStatus.SUPPLIER_ACCEPTED,
          toStatus: OrderStatus.AWAITING_PAYMENT,
          changedByUserId: 1,
        }),
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'customer_quote_accepted',
          metadata: expect.objectContaining({ supplierAssignmentId: 17 }),
        }),
        expect.anything(),
      );
    });

    it('rejects a non-owner under the transaction lock', async () => {
      await expect(
        service.acceptQuote(42, 99, {
          supplierAssignmentId: 17,
          paymentMethod: 'pilot_credit',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_order_owner' }),
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects a superseded assignment as stale', async () => {
      supplierAssignmentRepo.find!.mockResolvedValue([
        acceptedAssignment({ id: 17 }),
        acceptedAssignment({ id: 18 }),
      ]);

      await expect(
        service.acceptQuote(42, 1, {
          supplierAssignmentId: 17,
          paymentMethod: 'pilot_credit',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'stale_quote' }),
      });
    });

    it('rejects a superseded assignment even when replaying an accepted downstream order', async () => {
      const order = quotedOrder({
        orderStatus: OrderStatus.PRODUCTION,
        pricingStatus: PricingStatus.ACCEPTED,
        quoteAcceptedAt: new Date('2026-08-10T12:00:00Z'),
        paymentMethod: 'pilot_credit',
      });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      supplierAssignmentRepo.find!.mockResolvedValue([
        acceptedAssignment({ id: 17 }),
        acceptedAssignment({ id: 18 }),
      ]);

      await expect(
        service.acceptQuote(42, 1, {
          supplierAssignmentId: 17,
          paymentMethod: 'pilot_credit',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'stale_quote' }),
      });
      expect(repo.save).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
    });

    it.each([
      ['price', { finalPriceMinor: null }],
      ['promised date', { promisedDate: null }],
    ])('rejects a quote missing its %s', async (_label, assignmentOverride) => {
      supplierAssignmentRepo.find!.mockResolvedValue([
        acceptedAssignment(assignmentOverride),
      ]);

      await expect(
        service.acceptQuote(42, 1, {
          supplierAssignmentId: 17,
          paymentMethod: 'pilot_credit',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'quote_terms_missing' }),
      });
    });

    it('is idempotent only for the same accepted assignment and payment rail', async () => {
      const order = quotedOrder({
        orderStatus: OrderStatus.AWAITING_PAYMENT,
        pricingStatus: PricingStatus.ACCEPTED,
        quoteAcceptedAt: new Date('2026-08-10T12:00:00Z'),
        paymentMethod: 'pilot_credit',
      });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);

      await expect(
        service.acceptQuote(42, 1, {
          supplierAssignmentId: 17,
          paymentMethod: 'pilot_credit',
        }),
      ).resolves.toBe(order);
      expect(repo.save).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
    });

    it.each([OrderStatus.PAYMENT_AUTHORIZED, OrderStatus.PRODUCTION])(
      'replays an accepted quote idempotently from downstream status %s',
      async (orderStatus) => {
        const order = quotedOrder({
          orderStatus,
          pricingStatus: PricingStatus.ACCEPTED,
          quoteAcceptedAt: new Date('2026-08-10T12:00:00Z'),
          paymentMethod: 'pilot_credit',
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        });
        repo.findOne.mockResolvedValue(order);
        repo.findOneOrFail.mockResolvedValue(order);

        await expect(
          service.acceptQuote(42, 1, {
            supplierAssignmentId: 17,
            paymentMethod: 'pilot_credit',
          }),
        ).resolves.toBe(order);
        expect(repo.save).not.toHaveBeenCalled();
        expect(historyRepo.insert).not.toHaveBeenCalled();
        expect(auditService.recordOrderStatusTransition).not.toHaveBeenCalled();
        expect(auditService.append).not.toHaveBeenCalled();
        expect(creditsService.reserveCredits).not.toHaveBeenCalled();
        expect(creditsService.spendCredits).not.toHaveBeenCalled();
        expect(
          paymentsService.assertCodEligibleForCheckout,
        ).not.toHaveBeenCalled();
        expect(
          paymentsService.ensurePendingCodCollection,
        ).not.toHaveBeenCalled();
      },
    );

    it('rejects a conflicting payment rail after acceptance', async () => {
      const order = quotedOrder({
        orderStatus: OrderStatus.AWAITING_PAYMENT,
        pricingStatus: PricingStatus.ACCEPTED,
        quoteAcceptedAt: new Date('2026-08-10T12:00:00Z'),
        paymentMethod: 'pilot_credit',
      });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);

      await expect(
        service.acceptQuote(42, 1, {
          supplierAssignmentId: 17,
          paymentMethod: 'cod',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'quote_acceptance_conflict',
        }),
      });
    });

    it('evaluates COD against the frozen quoted total without creating a collection', async () => {
      paymentsService.assertCodEligibleForCheckout.mockResolvedValue({
        eligible: true,
        reasons: [],
        message: 'COD eligible',
        amountMinor: '12500',
        maxAmountMinor: 150000,
      });

      const result = await service.acceptQuote(42, 1, {
        supplierAssignmentId: 17,
        paymentMethod: 'cod',
      });

      expect(paymentsService.assertCodEligibleForCheckout).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          finalTotalMinor: '12500',
          excludeOrderId: 42,
        }),
        expect.anything(),
      );
      expect(result.codEligible).toBe(true);
      expect(paymentsService.ensurePendingCodCollection).not.toHaveBeenCalled();
    });

    it('rejects COD ineligibility before quote acceptance is persisted', async () => {
      paymentsService.assertCodEligibleForCheckout.mockRejectedValue(
        new ForbiddenException({
          code: 'cod_not_eligible',
          reasons: ['active_unpaid_cod_exists'],
        }),
      );

      await expect(
        service.acceptQuote(42, 1, {
          supplierAssignmentId: 17,
          paymentMethod: 'cod',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'cod_not_eligible' }),
      });
      expect(repo.save).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
    });
  });

  describe('authorizePayment (Task 3.3)', () => {
    const authContext = {
      actorUserId: 7,
      actorRole: 'ops_admin',
      reason: 'Ops payment authorization',
    };

    function awaitingPilotCreditOrder(overrides: Partial<Order> = {}): Order {
      return {
        id: 42,
        orderId: 'ORD-10042',
        userId: 1,
        orderStatus: OrderStatus.AWAITING_PAYMENT,
        paymentMethod: 'pilot_credit',
        paymentStatus: 'pending',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        authorizationSnapshot: null,
        totalPrice: 100,
        deliveryFee: 25,
        finalTotalMinor: '12500',
        deliveryFeeMinor: '2500',
        category: 'paper',
        quantity: 1,
        fileMetadataId: null,
        estimatedCompletionAt: null,
        codEligible: false,
        ...overrides,
      } as Order;
    }

    it('reserves+spends pilot credits, freezes snapshot, enters payment_authorized', async () => {
      const order = awaitingPilotCreditOrder();
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (o) => o as Order);
      assignmentRepo.find!.mockResolvedValue([]);

      const result = await service.authorizePayment(42, authContext);

      // Credits always settle against the order owner (userId), not the ops actor.
      expect(creditsService.reserveCredits).toHaveBeenCalledWith(
        1,
        125,
        OrdersService.creditReserveIdempotencyKey(42),
        expect.objectContaining({
          manager: expect.anything(),
          referenceId: 'ORD-10042',
          actorUserId: 7,
        }),
      );
      expect(creditsService.spendCredits).toHaveBeenCalledWith(
        1,
        125,
        OrdersService.creditSpendIdempotencyKey(42),
        expect.objectContaining({
          reserveIdempotencyKey: OrdersService.creditReserveIdempotencyKey(42),
          manager: expect.anything(),
          actorUserId: 7,
        }),
      );
      expect(creditsService.publishCreditMutation).toHaveBeenCalled();
      expect(result.orderStatus).toBe(OrderStatus.PAYMENT_AUTHORIZED);
      expect(result.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.AUTHORIZED,
      );
      expect(result.paymentStatus).toBe('paid');
      expect(result.authorizationSnapshot).toEqual(
        expect.objectContaining({
          finalTotalMinor: '12500',
          paymentMethod: 'pilot_credit',
        }),
      );
      expect(historyRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 42,
          fromStatus: OrderStatus.AWAITING_PAYMENT,
          toStatus: OrderStatus.PAYMENT_AUTHORIZED,
        }),
      );
    });

    it('skips ledger when pilot credits already paid at create (no double spend)', async () => {
      const order = awaitingPilotCreditOrder({ paymentStatus: 'paid' });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (o) => o as Order);
      assignmentRepo.find!.mockResolvedValue([]);

      await service.authorizePayment(42, authContext);

      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
      expect(creditsService.spendCredits).not.toHaveBeenCalled();
      expect(order.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.AUTHORIZED,
      );
    });

    it('authorizes eligible COD without collecting cash', async () => {
      const order = awaitingPilotCreditOrder({
        paymentMethod: 'cod',
        paymentStatus: 'pending',
        finalTotalMinor: '100000',
        totalPrice: 1000,
        deliveryFee: 0,
      });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (o) => o as Order);
      assignmentRepo.find!.mockResolvedValue([]);
      paymentsService.assertCodEligibleForCheckout.mockResolvedValue({
        eligible: true,
        reasons: [],
        message: 'Eligible',
        amountMinor: '100000',
        maxAmountMinor: 150000,
      });

      const result = await service.authorizePayment(42, authContext);

      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
      expect(paymentsService.assertCodEligibleForCheckout).toHaveBeenCalled();
      expect(paymentsService.ensurePendingCodCollection).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 42,
          amountMinor: '100000',
          eligible: true,
        }),
        expect.anything(),
      );
      expect(result.orderStatus).toBe(OrderStatus.PAYMENT_AUTHORIZED);
      expect(result.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.AUTHORIZED,
      );
      expect(result.paymentStatus).toBe('pending');
      expect(result.codEligible).toBe(true);
    });

    it('rejects authorization from submitted (wrong status)', async () => {
      const order = awaitingPilotCreditOrder({
        orderStatus: OrderStatus.SUBMITTED,
      });
      repo.findOne.mockResolvedValue(order);

      await expect(
        service.authorizePayment(42, authContext),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'invalid_status_for_authorization',
        }),
      });
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
    });

    it('rejects client authorization (ops/super only)', async () => {
      const order = awaitingPilotCreditOrder({ userId: 1 });
      repo.findOne.mockResolvedValue(order);

      await expect(
        service.authorizePayment(42, {
          actorUserId: 1,
          actorRole: 'client',
          reason: 'Client attempt',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'ops_only_payment_authorization',
        }),
      });
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
    });

    it('allows super_admin to authorize payment', async () => {
      const order = awaitingPilotCreditOrder();
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (o) => o as Order);
      assignmentRepo.find!.mockResolvedValue([]);

      const result = await service.authorizePayment(42, {
        actorUserId: 99,
        actorRole: 'super_admin',
        reason: 'Super admin auth',
      });

      expect(result.orderStatus).toBe(OrderStatus.PAYMENT_AUTHORIZED);
      expect(result.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.AUTHORIZED,
      );
    });

    it('is idempotent when already payment_authorized', async () => {
      const order = awaitingPilotCreditOrder({
        orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        authorizationSnapshot: { frozenAt: 'x' },
      });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      assignmentRepo.find!.mockResolvedValue([]);

      const result = await service.authorizePayment(42, authContext);

      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
      expect(result.orderStatus).toBe(OrderStatus.PAYMENT_AUTHORIZED);
    });

    it('rejects direct authorization of a newly quoted RFQ from supplier_accepted', async () => {
      const order = awaitingPilotCreditOrder({
        orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
        pricingStatus: PricingStatus.QUOTED,
        quotedTotalMinor: '12500',
      });
      repo.findOne.mockResolvedValue(order);

      await expect(
        service.authorizePayment(42, authContext),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'rfq_quote_not_accepted',
        }),
      });
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
    });

    it('freezes accepted RFQ money from the current supplier assignment and quote', async () => {
      const order = awaitingPilotCreditOrder({
        pricingStatus: PricingStatus.ACCEPTED,
        quotedTotalMinor: '12500',
        finalTotalMinor: null,
        deliveryFeeMinor: null,
        totalPrice: 0,
        deliveryFee: 0,
        promisedCompletionAt: new Date('2026-08-13T10:00:00Z'),
      });
      const supplierAssignment = {
        id: 17,
        orderId: 42,
        decision: SupplierAssignmentDecision.ACCEPTED,
        finalPriceMinor: '10000',
        promisedDate: new Date('2026-08-13T10:00:00Z'),
      } as SupplierAssignment;
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (row) => row as Order);
      supplierAssignmentRepo.find!.mockResolvedValue([supplierAssignment]);

      const result = await service.authorizePayment(42, authContext);

      expect(creditsService.reserveCredits).toHaveBeenCalledWith(
        1,
        125,
        OrdersService.creditReserveIdempotencyKey(42),
        expect.anything(),
      );
      expect(result.authorizationSnapshot).toEqual(
        expect.objectContaining({
          priceMinor: '10000',
          deliveryFeeMinor: '2500',
          finalTotalMinor: '12500',
          promisedDate: '2026-08-13T10:00:00.000Z',
        }),
      );
    });

    it('rejects authorization when the accepted assignment has been superseded', async () => {
      const order = awaitingPilotCreditOrder({
        pricingStatus: PricingStatus.ACCEPTED,
        quotedTotalMinor: '12500',
      });
      repo.findOne.mockResolvedValue(order);
      repo.findOneOrFail.mockResolvedValue(order);
      supplierAssignmentRepo.find!.mockResolvedValue([
        {
          id: 17,
          orderId: 42,
          decision: SupplierAssignmentDecision.ACCEPTED,
          finalPriceMinor: '10000',
          promisedDate: new Date('2026-08-13T10:00:00Z'),
        } as SupplierAssignment,
        {
          id: 18,
          orderId: 42,
          decision: SupplierAssignmentDecision.PENDING,
        } as SupplierAssignment,
      ]);

      await expect(
        service.authorizePayment(42, authContext),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'current_quote_missing' }),
      });
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
    });

    it('rejects when the locked order no longer matches the prechecked commerce owner', async () => {
      const precheck = awaitingPilotCreditOrder({ userId: 1 });
      const changed = awaitingPilotCreditOrder({ userId: 2 });
      repo.findOne.mockResolvedValue(precheck);
      repo.findOneOrFail.mockResolvedValue(changed);

      await expect(
        service.authorizePayment(42, authContext),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'order_changed_during_authorization',
        }),
      });
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus rejects status-only payment_authorized (Task 3.3 stuck-path)', () => {
    it('rejects updateStatus to payment_authorized and points to authorize-payment', async () => {
      const locked = {
        ...mockOrder,
        orderStatus: OrderStatus.AWAITING_PAYMENT,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(locked);

      await expect(
        service.updateStatus(
          1,
          OrderStatus.PAYMENT_AUTHORIZED,
          {},
          {
            actorUserId: 7,
            actorRole: 'ops_admin',
            reason: 'Authorize via status',
          },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'use_authorize_payment',
          message: expect.stringMatching(/authorize-payment/i),
        }),
      });
      expect(repo.update).not.toHaveBeenCalled();
      expect(creditsService.reserveCredits).not.toHaveBeenCalled();
    });

    it('also rejects ops jump from approved_for_matching to payment_authorized', async () => {
      const locked = {
        ...mockOrder,
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(locked);

      await expect(
        service.updateStatus(
          1,
          OrderStatus.PAYMENT_AUTHORIZED,
          {},
          {
            actorUserId: 7,
            actorRole: 'ops_admin',
            reason: 'Skip matching money path',
          },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'use_authorize_payment',
        }),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });
  });

  describe('production requires payment authorization (Task 3.3)', () => {
    it('blocks production when paymentAuthorizationStatus is not authorized', async () => {
      const locked = {
        ...mockOrder,
        orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(locked);

      await expect(
        service.updateStatus(
          1,
          OrderStatus.PRODUCTION,
          {},
          {
            actorUserId: 7,
            actorRole: 'ops_admin',
            reason: 'Start production',
          },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'payment_not_authorized',
        }),
      });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('allows production when authorized from payment_authorized', async () => {
      const locked = {
        ...mockOrder,
        orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
      } as Order;
      const after = {
        ...locked,
        orderStatus: OrderStatus.PRODUCTION,
      } as Order;
      // candidate → locked → publishStatusUpdate reload
      repo.findOneOrFail
        .mockResolvedValueOnce(locked)
        .mockResolvedValueOnce(locked)
        .mockResolvedValueOnce(after);
      repo.findOne.mockResolvedValue(after);
      assignmentRepo.find!.mockResolvedValue([]);

      const result = await service.updateStatus(
        1,
        OrderStatus.PRODUCTION,
        {},
        {
          actorUserId: 7,
          actorRole: 'ops_admin',
          reason: 'Start production',
        },
      );

      expect(repo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: OrderStatus.PAYMENT_AUTHORIZED },
        { orderStatus: OrderStatus.PRODUCTION },
      );
      expect(result.orderStatus).toBe(OrderStatus.PRODUCTION);
    });
  });

  describe('expireStalePaymentAuthorizations (24h timeout)', () => {
    it('expires waiting orders older than 24h and returns to matching', async () => {
      const stale = {
        id: 7,
        orderId: 'ORD-7',
        userId: 1,
        orderStatus: OrderStatus.AWAITING_PAYMENT,
        paymentMethod: 'pilot_credit',
        paymentStatus: 'pending',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        totalPrice: 50,
        deliveryFee: 0,
        updatedAt: new Date('2026-08-01T00:00:00.000Z'),
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      } as Order;
      const fresh = {
        ...stale,
        id: 8,
        orderId: 'ORD-8',
        updatedAt: new Date('2026-08-04T20:00:00.000Z'),
        createdAt: new Date('2026-08-04T20:00:00.000Z'),
      } as Order;

      repo.find.mockResolvedValue([stale, fresh]);
      // History miss → use updatedAt; keep slot booking repo for publish path
      (dataSource.getRepository as jest.Mock).mockImplementation(
        (entity: { name?: string }) => {
          if (entity?.name === 'OrderStatusHistory') {
            return { find: jest.fn().mockResolvedValue([]) };
          }
          return slotBookingRepo;
        },
      );
      repo.findOneOrFail.mockImplementation(async ({ where }: any) => {
        if (where.id === 7) {
          return {
            ...stale,
            paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
          };
        }
        return { ...fresh };
      });
      repo.save.mockImplementation(async (o) => o as Order);
      assignmentRepo.find!.mockResolvedValue([]);

      const now = new Date('2026-08-04T12:00:00.000Z');
      const result = await service.expireStalePaymentAuthorizations(now);

      expect(result.scanned).toBe(2);
      expect(result.expiredOrderIds).toEqual([7]);
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 7,
          orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.EXPIRED,
        }),
      );
    });

    it('expirePaymentWait stubs assignment release and marks expired', async () => {
      const order = {
        id: 9,
        orderId: 'ORD-9',
        userId: 2,
        orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
        paymentMethod: 'cod',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        totalPrice: 10,
        deliveryFee: 0,
      } as Order;
      const expired = {
        ...order,
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.EXPIRED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(order);
      repo.save.mockImplementation(async (o) => o as Order);
      repo.findOne.mockResolvedValue(expired);
      assignmentRepo.find!.mockResolvedValue([]);
      const txQuery = jest.fn().mockResolvedValue(undefined);
      (dataSource as any).transaction = jest.fn(async (run) =>
        run({
          query: txQuery,
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return repo;
            if (entity?.name === 'OrderStatusHistory') return historyRepo;
            throw new Error(`Unexpected repository ${entity?.name}`);
          },
        }),
      );

      const result = await service.expirePaymentWait(
        9,
        new Date('2026-08-04T12:00:00.000Z'),
      );

      expect(result.outcome).toBe('expired');
      expect(result.order.orderStatus).toBe(OrderStatus.APPROVED_FOR_MATCHING);
      expect(result.order.paymentAuthorizationStatus).toBe(
        PaymentAuthorizationStatus.EXPIRED,
      );
      expect(historyRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 9,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
        }),
      );
      expect(txQuery).toHaveBeenCalledWith(
        expect.stringContaining('supplier_assignments'),
        [9, 'payment_timeout'],
      );
    });

    it('keeps a customer-accepted RFQ immutable for Operations resolution on timeout', async () => {
      const order = {
        id: 10,
        orderId: 'ORD-10',
        userId: 2,
        orderStatus: OrderStatus.AWAITING_PAYMENT,
        pricingStatus: PricingStatus.ACCEPTED,
        quoteAcceptedAt: new Date('2026-08-03T12:00:00.000Z'),
        quotedTotalMinor: '12500',
        paymentMethod: 'cod',
        paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(order);
      const txQuery = jest.fn();
      (dataSource as any).transaction = jest.fn(async (run) =>
        run({
          query: txQuery,
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return repo;
            if (entity?.name === 'OrderStatusHistory') return historyRepo;
            throw new Error(`Unexpected repository ${entity?.name}`);
          },
        }),
      );

      const result = await service.expirePaymentWait(
        10,
        new Date('2026-08-04T12:00:00.000Z'),
      );

      expect(result).toEqual({
        outcome: 'operations_resolution_required',
        order,
      });
      expect(order.orderStatus).toBe(OrderStatus.AWAITING_PAYMENT);
      expect(order.pricingStatus).toBe(PricingStatus.ACCEPTED);
      expect(repo.save).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
      expect(auditService.recordOrderStatusTransition).not.toHaveBeenCalled();
      expect(txQuery).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejects quote-required products on the legacy create path', async () => {
      catalogPricingService.quote.mockResolvedValueOnce({
        pricingStatus: 'pending_quote',
        items: [
          {
            categoryId: 10,
            categorySlug: 'flyers',
            categoryName: 'Flyers',
            pricingModel: 'quote_required',
            quantity: 100,
            printSubtotal: null,
            specSnapshots: [],
            pricingBreakdown: [],
          },
        ],
        subtotal: null,
        deliveryFee: null,
        serviceFee: null,
        total: null,
      });

      await expect(
        service.create({
          userId: 1,
          category: 'flyers',
          quantity: 100,
          specs: {},
        } as Partial<Order> & { specs: Record<string, unknown> }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RFQ_ENDPOINT_REQUIRED' }),
      });
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(orderItemsRepo.save).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(creditsService.subtractCredits).not.toHaveBeenCalled();
      expect(
        paymentsService.assertCodEligibleForCheckout,
      ).not.toHaveBeenCalled();
      expect(paymentsService.ensurePendingCodCollection).not.toHaveBeenCalled();
      expect(notificationsService.create).not.toHaveBeenCalled();
      expect(notificationsService.createForAllAdmins).not.toHaveBeenCalled();
    });

    it('should generate orderId, save order', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      const data = { userId: 1, orderStatus: 'pending' } as Partial<Order>;
      const result = await service.create(data);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ORD-10001' }),
      );
      expect(repo.save).toHaveBeenCalledWith(mockOrder);
      expect(result).toEqual(mockOrder);
    });

    it('should generate correct orderId based on count', async () => {
      transactionQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { max_batch_ref: 10000, max_order_ref: 10042 },
        ]);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({ userId: 1 } as Partial<Order>);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ORD-10043' }),
      );
    });

    it('fires createForAllAdmins with order_placed type after saving', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({ userId: 1 } as Partial<Order>);

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order_placed',
          orderRef: mockOrder.orderId,
        }),
      );
    });

    it('sends the order-placed push data-only with initial journey progress', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);
      (usersService.getFcmToken as jest.Mock).mockResolvedValue('token-1');

      await service.create({ userId: 1 } as Partial<Order>);

      expect(firebaseService.sendToDevice).toHaveBeenCalledWith(
        'token-1',
        'Order Placed',
        `Your order ${mockOrder.orderId} has been placed successfully.`,
        {
          orderId: mockOrder.orderId,
          status: 'order_placed',
          type: 'delivery_status',
          progressCurrent: '1',
          progressTotal: '5',
        },
        { dataOnly: true },
      );
    });

    it('deducts GRIDGO Credits using print subtotal plus delivery fee', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({
        userId: 1,
        paymentMethod: 'gridCredits',
        totalPrice: 250,
        deliveryFee: 30,
      } as Partial<Order>);

      expect(creditsService.subtractCredits).toHaveBeenCalledWith(
        1,
        280,
        'ORDER-DEBIT:ORD-10001',
        expect.anything(),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'paid' }),
      );
    });

    it('sets marketplace payment authorization defaults on create', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await service.create({
        userId: 1,
        category: 'paper',
        paymentMethod: 'gcash',
        deliveryFee: 30,
      } as Partial<Order>);

      // catalog mock: paper subtotal 120 + delivery 30 = 150 major → 15000 minor
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          finalTotalMinor: '15000',
          deliveryFeeMinor: '3000',
          paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
          codEligible: false,
          authorizationSnapshot: null,
        }),
      );
    });

    it('does not leave a credit debit when order persistence fails', async () => {
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);
      orderItemsRepo.save.mockRejectedValueOnce(new Error('item save failed'));

      await expect(
        service.create({
          userId: 1,
          paymentMethod: 'gridCredits',
          totalPrice: 250,
          deliveryFee: 30,
        } as Partial<Order>),
      ).rejects.toThrow('item save failed');

      expect(creditsService.subtractCredits).not.toHaveBeenCalled();
      expect(notificationsService.createForAllAdmins).not.toHaveBeenCalled();
    });

    it('rejects non-credit legacy orders for beta customers', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: null,
      });
      (dataSource as any).query = jest
        .fn()
        .mockResolvedValue([{ is_enabled: true }]);

      await expect(
        service.create({
          userId: 1,
          paymentMethod: 'gcash',
        } as Partial<Order>),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'beta_credits_only' }),
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('cannot commit non-credit payment if beta enables before persistence', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: null,
      });
      (dataSource.query as jest.Mock).mockResolvedValue([
        { is_enabled: false },
      ]);
      transactionBetaSettingsRepo.findOne.mockResolvedValue({
        id: 1,
        isEnabled: true,
      });

      await expect(
        service.create({
          userId: 1,
          category: 'paper',
          paymentMethod: 'gcash',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'beta_credits_only' }),
      });

      expect(transactionBetaSettingsRepo.findOne).toHaveBeenCalledWith({
        where: {},
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('cannot commit a second beta order if beta enables before persistence', async () => {
      const enrolledAt = new Date('2026-04-01T00:00:00Z');
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      (dataSource.query as jest.Mock).mockResolvedValue([
        { is_enabled: false },
      ]);
      transactionBetaSettingsRepo.findOne.mockResolvedValue({
        id: 1,
        isEnabled: true,
      });
      repo.count.mockResolvedValue(1);
      repo.create.mockReturnValue(mockOrder);
      repo.save.mockResolvedValue(mockOrder);

      await expect(
        service.create({
          userId: 1,
          category: 'paper',
          paymentMethod: 'gridCredits',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: BETA_ORDER_LIMIT_REACHED,
        }),
      });

      expect(transactionBetaSettingsRepo.findOne).toHaveBeenCalledTimes(1);
      expect(transactionBetaSettingsRepo.findOne).toHaveBeenCalledWith({
        where: {},
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
    });

    it('rejects file metadata that does not belong to the ordering user', async () => {
      fileMetadataRepo.findOne!.mockResolvedValueOnce({
        id: 99,
        uploadedBy: 2,
        url: 'https://files/other.pdf',
      } as FileMetadata);

      await expect(
        service.create({
          userId: 1,
          fileMetadataId: 99,
          fileUrl: 'https://files/other.pdf',
        } as Partial<Order>),
      ).rejects.toThrow(
        new BadRequestException('Invalid uploaded file reference'),
      );

      expect(repo.save).not.toHaveBeenCalled();
    });
  });

  describe('createBatch', () => {
    const batchDto = {
      deliveryFee: 45,
      paymentMethod: 'gridCredits',
      paymentStatus: 'paid',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      items: [
        {
          category: 'paper',
          quantity: 2,
          totalPrice: 120,
          fileName: 'deck.pdf',
          fileUrl: 'https://files/deck.pdf',
          fileMetadataId: 11,
          specialInstructions: 'Trim to the crop marks.',
          paperSpecs: {
            paperSize: 'A4',
            colorMode: 'color',
            mediaType: 'bond',
            printSides: 'single',
          },
        },
        {
          category: '3d',
          quantity: 1,
          totalPrice: 300,
          fileName: 'part.stl',
          fileUrl: 'https://files/part.stl',
          fileMetadataId: 12,
          threeDSpecs: {
            fileFormat: 'stl',
            material: 'pla',
            color: 'black',
            infillPercentage: 20,
            layerHeight: 0.2,
            supports: false,
          },
        },
      ],
    };

    beforeEach(() => {
      repo.count.mockResolvedValue(0);
      batchRepo.count.mockResolvedValue(0);
      batchRepo.create.mockImplementation((data) => ({
        id: 77,
        batchRef: 'BATCH-10001',
        ...data,
      }));
      batchRepo.save.mockImplementation(async (batch) => batch);

      let savedOrderId = 0;
      repo.create.mockImplementation((data) => data as Order);
      repo.save.mockImplementation(async (order) => ({
        id: ++savedOrderId,
        ...order,
      }));
      repo.findOneOrFail.mockImplementation(
        async ({ where }: any) =>
          ({
            id: where.id,
            orderId: 'ORD-10001',
            category: 'batch',
            items: [{ id: 1 }, { id: 2 }],
          }) as Order,
      );
      let savedItemId = 0;
      orderItemsRepo.create.mockImplementation((data) => data as OrderItem);
      orderItemsRepo.save.mockImplementation(
        async (item) =>
          ({
            id: ++savedItemId,
            ...item,
          }) as OrderItem,
      );
      paperSpecsRepo.create.mockImplementation((data) => data as PaperSpec);
      paperSpecsRepo.save.mockResolvedValue({} as PaperSpec);
      threeDSpecsRepo.create.mockImplementation((data) => data as ThreeDSpec);
      threeDSpecsRepo.save.mockResolvedValue({} as ThreeDSpec);
    });

    it('rejects an empty item list', async () => {
      await expect(
        (service as any).createBatch(1, { ...batchDto, items: [] }),
      ).rejects.toThrow('Batch order requires at least one item');
    });

    it('rejects quote-required products on the legacy batch path', async () => {
      catalogPricingService.quote.mockResolvedValueOnce({
        pricingStatus: 'pending_quote',
        items: [
          {
            categoryId: 10,
            categorySlug: 'flyers',
            categoryName: 'Flyers',
            pricingModel: 'quote_required',
            quantity: 100,
            printSubtotal: null,
            specSnapshots: [],
            pricingBreakdown: [],
          },
        ],
        subtotal: null,
        deliveryFee: null,
        serviceFee: null,
        total: null,
      });

      await expect(
        (service as any).createBatch(1, {
          ...batchDto,
          deliveryOption: 'pickup',
          deliveryAddressId: undefined,
          items: [
            {
              ...batchDto.items[0],
              category: 'flyers',
              quantity: 100,
              specs: {},
            },
          ],
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'RFQ_ENDPOINT_REQUIRED' }),
      });
      expect(batchRepo.create).not.toHaveBeenCalled();
      expect(batchRepo.save).not.toHaveBeenCalled();
      expect(repo.create).not.toHaveBeenCalled();
      expect(repo.save).not.toHaveBeenCalled();
      expect(orderItemsRepo.save).not.toHaveBeenCalled();
      expect(dataSource.transaction).not.toHaveBeenCalled();
      expect(creditsService.subtractCredits).not.toHaveBeenCalled();
      expect(
        paymentsService.assertCodEligibleForCheckout,
      ).not.toHaveBeenCalled();
      expect(paymentsService.ensurePendingCodCollection).not.toHaveBeenCalled();
      expect(notificationsService.create).not.toHaveBeenCalled();
      expect(notificationsService.createForAllAdmins).not.toHaveBeenCalled();
    });

    it('rejects delivery addresses that do not belong to the user', async () => {
      addressRepo.findOne.mockResolvedValueOnce(null);

      await expect((service as any).createBatch(1, batchDto)).rejects.toThrow(
        'Invalid delivery address',
      );
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('rejects batch item file metadata that does not belong to the ordering user', async () => {
      fileMetadataRepo.findOne!.mockResolvedValueOnce({
        id: 11,
        uploadedBy: 2,
        url: 'https://files/other.pdf',
      } as FileMetadata);

      await expect((service as any).createBatch(1, batchDto)).rejects.toThrow(
        new BadRequestException('Invalid uploaded file reference'),
      );

      expect(dataSource.transaction).not.toHaveBeenCalled();
    });

    it('saves one BatchOrder, one aggregate Order, and two OrderItem records', async () => {
      const result = await (service as any).createBatch(1, batchDto);

      // Two saves: initial creation, then updating deliveryType/fees fields
      expect(batchRepo.save).toHaveBeenCalledTimes(2);
      expect(batchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 1,
          subtotal: 420,
          deliveryFee: 27,
          totalPrice: 447,
          paymentMethod: 'gridCredits',
          paymentStatus: 'paid',
          deliveryOption: 'delivery',
          deliveryAddressId: 9,
        }),
      );
      expect(repo.save).toHaveBeenCalledTimes(1);
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          batchOrderId: 77,
          category: 'batch',
          userId: 1,
          totalPrice: 420,
          deliveryFee: 27,
        }),
      );
      expect(orderItemsRepo.save).toHaveBeenCalledTimes(2);
      expect(orderItemsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 1,
          category: 'paper',
          specialInstructions: 'Trim to the crop marks.',
        }),
      );
      expect(orderItemsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 1,
          category: '3d',
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          batchId: 'BATCH-10001',
          orders: [expect.objectContaining({ id: 1, category: 'batch' })],
          assignedSlot: expect.objectContaining({
            bookingId: 1,
            slotTemplateId: 1,
          }),
        }),
      );
    });

    it('allocates shared deliveryFee to the aggregate order only', async () => {
      await (service as any).createBatch(1, batchDto);

      expect(repo.create).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ deliveryFee: 27 }),
      );
    });

    it('deducts GRIDGO Credits once for subtotal plus deliveryFee', async () => {
      await (service as any).createBatch(1, batchDto);

      expect(creditsService.subtractCredits).toHaveBeenCalledTimes(1);
      expect(creditsService.subtractCredits).toHaveBeenCalledWith(
        1,
        447,
        'ORDER-DEBIT:ORD-10001',
        expect.anything(),
      );
    });

    it('deducts subtotal, delivery, priority, and extra-destination fees exactly once', async () => {
      await (service as any).createBatch(1, {
        ...batchDto,
        speedTier: DeliverySpeedTier.PRIORITY,
        destinations: [
          { addressId: 9, label: 'First stop' },
          { addressId: 9, label: 'Second stop' },
        ],
      });

      expect(creditsService.subtractCredits).toHaveBeenCalledTimes(1);
      expect(creditsService.subtractCredits).toHaveBeenCalledWith(
        1,
        527,
        'ORDER-DEBIT:ORD-10001',
        expect.anything(),
      );
    });

    it('rejects non-credit payment methods for beta customers while beta mode is enabled', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: null,
      });
      (dataSource as any).query = jest
        .fn()
        .mockResolvedValue([{ is_enabled: true }]);

      await expect(
        (service as any).createBatch(1, {
          ...batchDto,
          paymentMethod: 'gcash',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'beta_credits_only' }),
      });
      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('allows normal payment methods for beta customers after beta mode is disabled', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
      });
      (dataSource as any).query = jest
        .fn()
        .mockResolvedValue([{ is_enabled: false }]);

      await expect(
        (service as any).assertBetaPaymentMethod(1, 'gcash', false),
      ).resolves.toBeUndefined();
    });

    it.each(['rider', 'ops_admin'])(
      'never restricts a %s identity to beta credits',
      async (role) => {
        (usersService.findById as jest.Mock).mockResolvedValue({
          id: 1,
          role,
          isBetaUser: true,
        });
        (dataSource as any).query = jest
          .fn()
          .mockResolvedValue([{ is_enabled: true }]);

        await expect(
          (service as any).assertBetaPaymentMethod(1, 'gcash'),
        ).resolves.toBeUndefined();

        expect(dataSource.query).not.toHaveBeenCalled();
      },
    );

    it('keeps the beta credits restriction for a survey-exempt beta customer', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
        isBetaSurveyExempt: true,
      });
      (dataSource as any).query = jest
        .fn()
        .mockResolvedValue([{ is_enabled: true }]);

      await expect(
        (service as any).assertBetaPaymentMethod(1, 'gcash'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'beta_credits_only' }),
      });
    });

    it('records a successful GRIDGO Credits batch payment as paid', async () => {
      await (service as any).createBatch(1, {
        ...batchDto,
        paymentStatus: undefined,
      });

      expect(batchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'paid' }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'paid' }),
      );
    });

    it('does not trust a client-supplied paid status for non-credit methods', async () => {
      await (service as any).createBatch(1, {
        ...batchDto,
        paymentMethod: 'gcash',
        paymentStatus: 'paid',
      });

      expect(batchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'pending' }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ paymentStatus: 'pending' }),
      );
    });

    it('generates batch and order refs after the greatest stored suffix', async () => {
      transactionQuery
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { max_batch_ref: 10006, max_order_ref: 10009 },
        ]);

      await (service as any).createBatch(1, batchDto);

      expect(batchRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ batchRef: 'BATCH-10007' }),
      );
      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ orderId: 'ORD-10010' }),
      );
    });

    it('rechecks the beta order cap after acquiring the transaction lock', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 1,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: new Date('2026-07-01T00:00:00Z'),
      });
      (dataSource as any).query = jest
        .fn()
        .mockResolvedValue([{ is_enabled: true }]);
      (repo.count as jest.Mock).mockResolvedValueOnce(1);

      await expect(
        (service as any).createBatch(1, batchDto),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: BETA_ORDER_LIMIT_REACHED,
        }),
      });
      expect(batchRepo.save).not.toHaveBeenCalled();
    });

    it('normalizes numeric strings before creating batch order rows', async () => {
      await (service as any).createBatch(1, {
        ...batchDto,
        deliveryFee: '45',
        deliveryAddressId: '9',
        items: [
          {
            ...batchDto.items[1],
            quantity: '2',
            totalPrice: '300.50',
            fileMetadataId: '12',
            threeDSpecs: {
              ...batchDto.items[1].threeDSpecs,
              infillPercentage: '20',
              layerHeight: '0.20',
            },
          },
        ],
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          totalPrice: 300,
          deliveryFee: 27,
          deliveryAddressId: 9,
        }),
      );
      expect(orderItemsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          quantity: 2,
          totalPrice: 300,
          fileMetadataId: 12,
        }),
      );
      expect(catalogPricingService.quote).toHaveBeenCalledWith(
        expect.objectContaining({
          items: [
            expect.objectContaining({
              specs: expect.objectContaining({
                infill_percentage: 20,
                layer_height: 0.2,
              }),
            }),
          ],
        }),
      );
    });
  });

  describe('findByUser', () => {
    it('should return orders for given userId sorted by createdAt DESC', async () => {
      const orders = [mockOrder];
      repo.find.mockResolvedValue(orders);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findByUser(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        relations: [
          'batchOrder',
          'destination',
          'items',
          'items.destination',
          'items.specValues',
          'statusHistory',
        ],
        order: { createdAt: 'DESC' },
      });
      expect(result).toMatchObject(orders);
    });

    it('masks RFQ compatibility money on subsequent customer reads', async () => {
      catalogReadService.getPublicCatalog.mockResolvedValueOnce({
        version: '1.10.0',
        groups: [],
        categories: [
          {
            id: 31,
            slug: 'business-store-signages',
            name: 'Business & Store Signages',
            groupSlug: 'awards-signages',
            groupName: 'Recognition, Awards & Signage',
            groupDescription: 'Recognition and visible brand spaces.',
            examples: ['Acrylic build-up letters', 'LED neon flex'],
            pricingModel: 'quote_required',
          },
        ],
      });
      repo.find.mockResolvedValue([
        {
          ...mockOrder,
          category: 'business-store-signages',
          pricingStatus: PricingStatus.PENDING_QUOTE,
          totalPrice: 0,
          deliveryFee: 0,
          deliveryFeeMinor: null,
          finalTotalMinor: null,
          quotedTotalMinor: null,
          batchOrder: {
            id: 77,
            subtotal: 0,
            deliveryFee: 42,
            totalPrice: 0,
            priorityFee: 0,
            extraDestinationFee: 0,
          },
          items: [
            {
              id: 10,
              category: 'business-store-signages',
              categoryId: 31,
              categorySlug: 'business-store-signages',
              categoryName: 'Business & Store Signages',
              pricingModel: 'quote_required',
              totalPrice: 0,
              specValues: [
                {
                  id: 20,
                  orderItemId: 10,
                  specDefinitionId: 30,
                  specKey: 'size',
                  specLabel: 'Size',
                  inputType: 'text',
                  value: 'A5',
                  displayValue: 'A5',
                  optionId: null,
                  optionLabel: null,
                  multiplier: 1,
                  fixedFee: 0,
                  unitCost: 0,
                  estimatedQuantity: null,
                },
              ],
            },
          ],
        } as Order,
      ]);
      assignmentRepo.find.mockResolvedValue([]);

      const [result] = await service.findByUser(1);

      expect(result).toMatchObject({
        totalPrice: null,
        deliveryFee: null,
        deliveryFeeMinor: null,
        finalTotalMinor: null,
        quotedTotalMinor: null,
        batchOrder: {
          subtotal: null,
          deliveryFee: null,
          totalPrice: null,
          priorityFee: null,
          extraDestinationFee: null,
        },
        items: [{ totalPrice: null }],
      });
      expect(result.items[0]).toMatchObject({
        category: 'business-store-signages',
        categorySlug: 'business-store-signages',
        categoryName: 'Business & Store Signages',
        groupSlug: 'awards-signages',
        groupName: 'Recognition, Awards & Signage',
        groupDescription: 'Recognition and visible brand spaces.',
        examples: ['Acrylic build-up letters', 'LED neon flex'],
        pricingModel: 'quote_required',
        specs: [
          expect.objectContaining({
            key: 'size',
            label: 'Size',
            value: 'A5',
            displayValue: 'A5',
          }),
        ],
      });
      expect(result.items[0].specValues[0]).not.toHaveProperty('fixedFee');
      expect(result.items[0].specValues[0]).not.toHaveProperty('unitCost');
    });

    it('exposes only the accepted quote assignment id to the customer', async () => {
      repo.find.mockResolvedValue([{ ...mockOrder, id: 41 }] as Order[]);
      assignmentRepo.find.mockResolvedValue([]);
      supplierAssignmentRepo.find!.mockResolvedValue([
        {
          id: 901,
          orderId: 41,
          supplierId: 77,
          decision: SupplierAssignmentDecision.ACCEPTED,
          rankPosition: 1,
          acceptanceDeadline: new Date('2026-08-11T00:00:00Z'),
          finalPriceMinor: '10000',
        } as SupplierAssignment,
      ]);

      const [result] = await service.findByUser(1);

      expect(result).toMatchObject({ quoteAssignmentId: 901 });
      expect(result).not.toHaveProperty('currentSupplierAssignment');
      expect(result).not.toHaveProperty('supplierId');
      expect(JSON.stringify(result)).not.toContain('supplierId');
      expect(JSON.stringify(result)).not.toContain('assignmentId');
      expect(JSON.stringify(result)).not.toContain('acceptanceDeadline');
      expect(JSON.stringify(result)).not.toContain('rankPosition');
      expect(JSON.stringify(result)).not.toContain('finalPriceMinor');
    });

    it('advises COD for a newly quoted RFQ that currently passes policy', async () => {
      repo.find.mockResolvedValue([
        {
          ...mockOrder,
          id: 41,
          userId: 1,
          pricingStatus: PricingStatus.QUOTED,
          quotedTotalMinor: '12500',
          codEligible: false,
        },
      ] as Order[]);
      assignmentRepo.find.mockResolvedValue([]);
      supplierAssignmentRepo.find!.mockResolvedValue([
        {
          id: 901,
          orderId: 41,
          decision: SupplierAssignmentDecision.ACCEPTED,
        } as SupplierAssignment,
      ]);
      paymentsService.evaluateCodEligibilityForUser.mockResolvedValueOnce({
        eligible: true,
      });

      const [result] = await service.findByUser(1);

      expect(
        paymentsService.evaluateCodEligibilityForUser,
      ).toHaveBeenCalledWith({
        userId: 1,
        finalTotalMinor: '12500',
        excludeOrderId: 41,
      });
      expect(result).toMatchObject({
        pricingStatus: PricingStatus.QUOTED,
        quoteAssignmentId: 901,
        codEligible: true,
      });
    });

    it('withholds COD when a newly quoted RFQ currently fails policy', async () => {
      repo.find.mockResolvedValue([
        {
          ...mockOrder,
          id: 42,
          userId: 1,
          pricingStatus: PricingStatus.QUOTED,
          quotedTotalMinor: '150100',
          codEligible: true,
        },
      ] as Order[]);
      assignmentRepo.find.mockResolvedValue([]);
      supplierAssignmentRepo.find!.mockResolvedValue([
        {
          id: 902,
          orderId: 42,
          decision: SupplierAssignmentDecision.ACCEPTED,
        } as SupplierAssignment,
      ]);
      paymentsService.evaluateCodEligibilityForUser.mockResolvedValueOnce({
        eligible: false,
      });

      const [result] = await service.findByUser(1);

      expect(result).toMatchObject({
        pricingStatus: PricingStatus.QUOTED,
        quoteAssignmentId: 902,
        codEligible: false,
      });
    });

    it('limits customer supplier contact to public presentation fields', async () => {
      repo.find.mockResolvedValue([{ ...mockOrder, id: 43 }] as Order[]);
      assignmentRepo.find.mockResolvedValue([]);
      supplierAssignmentRepo.find!.mockResolvedValue([
        {
          id: 903,
          orderId: 43,
          supplierId: 79,
          decision: SupplierAssignmentDecision.ACCEPTED,
          selfQcEvidenceFileIds: [501],
          supplier: {
            id: 79,
            businessName: 'Safe Print Co',
            address: '123 Exact Supplier Street, Davao City',
            serviceZones: ['Davao City'],
            logoFileId: 500,
          },
        } as SupplierAssignment,
      ]);
      jest
        .spyOn(service as any, 'signFileId')
        .mockImplementation(async (id: number) => `https://signed/${id}`);

      const [result] = await service.findByUser(1);

      expect((result as any).assignedSupplierContact).toEqual({
        businessName: 'Safe Print Co',
        logoUrl: 'https://signed/500',
        broadAddress: 'Exact Supplier, Davao City',
        selfQcEvidenceUrls: ['https://signed/501'],
      });
      expect(JSON.stringify(result)).not.toContain('123 Exact Supplier Street');
      expect(JSON.stringify(result)).not.toContain('selfQcEvidenceFileIds');
    });

    it('withholds a pending assignment id from the customer', async () => {
      repo.find.mockResolvedValue([{ ...mockOrder, id: 42 }] as Order[]);
      assignmentRepo.find.mockResolvedValue([]);
      supplierAssignmentRepo.find!.mockResolvedValue([
        {
          id: 902,
          orderId: 42,
          supplierId: 78,
          decision: SupplierAssignmentDecision.PENDING,
        } as SupplierAssignment,
      ]);

      const [result] = await service.findByUser(1);

      expect(result).toMatchObject({ quoteAssignmentId: null });
      expect(result).not.toHaveProperty('currentSupplierAssignment');
    });

    it('projects catalog metadata without mutating loaded ORM entities', async () => {
      const item = {
        id: 10,
        category: 'flyers',
        categorySlug: 'flyers',
        specValues: [],
      } as OrderItem;
      const order = { ...mockOrder, items: [item] } as Order;
      catalogReadService.getPublicCatalog.mockResolvedValueOnce({
        version: '1.10.0',
        groups: [],
        categories: [
          {
            id: 1,
            slug: 'flyers',
            name: 'Flyers',
            groupSlug: 'marketing-promo',
            examples: [],
            pricingModel: 'quote_required',
          },
        ],
      });

      const [projected] = await service.attachCatalogSnapshots([order]);

      expect(projected).not.toBe(order);
      expect(projected.items[0]).not.toBe(item);
      expect(order).not.toHaveProperty('catalogProduct');
      expect(item).not.toHaveProperty('groupSlug');
      expect(projected.items[0]).toMatchObject({
        groupSlug: 'marketing-promo',
      });
    });

    it('batch-loads and maps assigned slots across multiple order batches', async () => {
      const orders = [
        { ...mockOrder, id: 11, batchOrderId: 101 },
        { ...mockOrder, id: 12, batchOrderId: 202 },
        { ...mockOrder, id: 13, batchOrderId: 101 },
      ] as Order[];
      repo.find.mockResolvedValue(orders);
      assignmentRepo.find.mockResolvedValue([]);
      slotBookingRepo.find!.mockResolvedValue([
        {
          batchOrderId: 101,
          slotTemplateId: 1,
          date: '2026-07-20',
          slotTemplate: {
            startTime: '09:30:00',
            endTime: '11:00:00',
          },
        } as DeliverySlotBooking,
        {
          batchOrderId: 202,
          slotTemplateId: 2,
          date: '2026-07-21',
          slotTemplate: {
            startTime: '13:00:00',
            endTime: '14:30:00',
          },
        } as DeliverySlotBooking,
      ]);

      const result = await service.findByUser(1);

      expect(slotBookingRepo.find).toHaveBeenCalledTimes(1);
      expect(slotBookingRepo.find).toHaveBeenCalledWith({
        where: { batchOrderId: expect.any(Object) },
        relations: ['slotTemplate'],
      });
      expect((result[0] as any).assignedSlot).toEqual({
        slotTemplateId: 1,
        date: '2026-07-20',
        startTime: '09:30:00',
        endTime: '11:00:00',
      });
      expect((result[1] as any).assignedSlot).toEqual({
        slotTemplateId: 2,
        date: '2026-07-21',
        startTime: '13:00:00',
        endTime: '14:30:00',
      });
      expect((result[2] as any).assignedSlot).toEqual(
        (result[0] as any).assignedSlot,
      );
      expect((result[0] as any).assignedSlot).not.toHaveProperty('bookingId');
    });

    it('leaves assignedSlot undefined when the batch has no active booking', async () => {
      const orders = [{ ...mockOrder, batchOrderId: 101 }] as Order[];
      repo.find.mockResolvedValue(orders);
      assignmentRepo.find.mockResolvedValue([]);
      slotBookingRepo.find!.mockResolvedValue([]);

      const result = await service.findByUser(1);

      expect(slotBookingRepo.find).toHaveBeenCalledTimes(1);
      expect((result[0] as any).assignedSlot).toBeUndefined();
    });

    it('attaches active deliveryAssignmentId for live tracking subscription', async () => {
      const orders = [{ ...mockOrder, id: 12 }] as Order[];
      repo.find.mockResolvedValue(orders);
      const currentAssignment = {
        id: 99,
        orderId: 12,
        riderId: 5,
        status: DeliveryStatus.ON_THE_WAY,
        order: {
          id: 12,
          destination: { latitude: 7.065, longitude: 125.609 },
        },
        rider: {
          id: 5,
          userId: 50,
          lastLatitude: 7.064,
          lastLongitude: 125.608,
          user: { fullName: 'Juan Rider' },
        },
      } as DeliveryAssignment;
      assignmentRepo.find.mockResolvedValueOnce([currentAssignment]);
      dispatchPlanRepo.find!.mockResolvedValueOnce([
        {
          id: 500,
          riderId: 5,
          version: 1,
          status: DispatchPlanStatus.ACTIVE,
          routingDataStale: false,
          stops: [
            {
              assignmentId: 99,
              sequence: 1,
              status: DispatchStopStatus.PENDING,
              legDurationSeconds: 30,
              legDistanceMeters: 100,
              legGeometry: {
                type: 'LineString',
                coordinates: [
                  [125.608, 7.064],
                  [125.609, 7.065],
                ],
              },
            },
          ],
        } as DispatchPlan,
      ]);

      const result = await service.findByUser(1);

      expect(assignmentRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            orderId: expect.any(Object),
            isCurrent: true,
            status: expect.any(Object),
          },
        }),
      );
      expect(result[0]).toEqual(
        expect.objectContaining({
          deliveryAssignmentId: 99,
          deliveryQueuePosition: 1,
          deliveryQueueSize: 1,
          deliveryPlanVersion: 1,
          deliveryRouteGeometry: expect.objectContaining({
            type: 'LineString',
          }),
          canTrackDelivery: true,
        }),
      );
    });

    it('shows queue position but withholds tracking access for a later stop', async () => {
      const orders = [{ ...mockOrder, id: 12 }] as Order[];
      repo.find.mockResolvedValue(orders);
      const rider = {
        id: 5,
        userId: 50,
        lastLatitude: 7.064,
        lastLongitude: 125.608,
        user: { fullName: 'Juan Rider' },
      };
      const laterAssignment = {
        id: 99,
        orderId: 12,
        riderId: 5,
        status: DeliveryStatus.ON_THE_WAY,
        order: {
          id: 12,
          destination: { latitude: 7.22, longitude: 125.72 },
        },
        rider,
      } as DeliveryAssignment;
      assignmentRepo.find.mockResolvedValueOnce([laterAssignment]);
      dispatchPlanRepo.find!.mockResolvedValueOnce([
        {
          id: 500,
          riderId: 5,
          version: 1,
          status: DispatchPlanStatus.ACTIVE,
          routingDataStale: false,
          stops: [
            {
              assignmentId: 98,
              sequence: 1,
              status: DispatchStopStatus.PENDING,
              legDurationSeconds: 30,
              legDistanceMeters: 100,
              legGeometry: {
                type: 'LineString',
                coordinates: [
                  [125.608, 7.064],
                  [125.609, 7.065],
                ],
              },
            },
            {
              assignmentId: 99,
              sequence: 2,
              status: DispatchStopStatus.PENDING,
              legDurationSeconds: 300,
              legDistanceMeters: 1000,
              legGeometry: {
                type: 'LineString',
                coordinates: [
                  [125.609, 7.065],
                  [125.72, 7.22],
                ],
              },
            },
          ],
        } as DispatchPlan,
      ]);

      const result = await service.findByUser(1);

      expect(result[0]).toEqual(
        expect.objectContaining({
          deliveryAssignmentId: null,
          deliveryQueuePosition: 2,
          deliveryQueueSize: 2,
          deliveryPlanVersion: 1,
          deliveryRouteGeometry: null,
          deliveryLegDurationSeconds: null,
          canTrackDelivery: false,
        }),
      );
      expect((result[0] as any).assignedRiderContact).toEqual(
        expect.objectContaining({ deliveryAssignmentId: null }),
      );
    });

    it('attaches assigned rider contact details for customer delivery surfaces', async () => {
      const orders = [{ ...mockOrder, id: 12 }] as Order[];
      repo.find.mockResolvedValue(orders);
      assignmentRepo.find.mockResolvedValue([
        {
          id: 99,
          orderId: 12,
          riderId: 7,
          status: DeliveryStatus.ACCEPTED,
          rider: {
            id: 7,
            userId: 70,
            vehicleType: 'motorcycle',
            plateNumber: 'ABC 1234',
            user: {
              id: 70,
              fullName: 'Maya Santos',
              nickname: 'Maya',
              phoneNumber: '+639171234567',
            },
          },
        } as DeliveryAssignment,
      ]);

      const result = await service.findByUser(1);

      expect((result[0] as any).assignedRiderContact).toEqual({
        userId: 70,
        riderProfileId: 7,
        displayName: 'Maya Santos',
        fullName: 'Maya Santos',
        nickname: 'Maya',
        phoneNumber: '+639171234567',
        vehicleType: 'motorcycle',
        plateNumber: 'ABC 1234',
        deliveryAssignmentId: null,
        deliveryStatus: DeliveryStatus.ACCEPTED,
        proof: null,
      });
    });
  });

  describe('findById', () => {
    it('should return order', async () => {
      repo.findOne.mockResolvedValue(mockOrder);
      assignmentRepo.find.mockResolvedValue([]);

      const result = await service.findById(1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: [
          'batchOrder',
          'destination',
          'items',
          'items.destination',
          'items.specValues',
          'statusHistory',
        ],
      });
      expect(result).toMatchObject(mockOrder);
    });

    it('attaches the active batch slot to an individual order', async () => {
      const order = { ...mockOrder, batchOrderId: 101 } as Order;
      repo.findOne.mockResolvedValue(order);
      assignmentRepo.find.mockResolvedValue([]);
      slotBookingRepo.find!.mockResolvedValue([
        {
          batchOrderId: 101,
          slotTemplateId: 1,
          date: '2026-07-20',
          slotTemplate: {
            startTime: '09:30:00',
            endTime: '11:00:00',
          },
        } as DeliverySlotBooking,
      ]);

      const result = await service.findById(1);

      expect((result as any).assignedSlot).toEqual({
        slotTemplateId: 1,
        date: '2026-07-20',
        startTime: '09:30:00',
        endTime: '11:00:00',
      });
    });
  });

  describe('updateStatus', () => {
    it('rejects generic cancellation before credit, batch, and slot accounting can be bypassed', async () => {
      repo.findOneOrFail.mockResolvedValue({
        ...mockOrder,
        orderStatus: OrderStatus.SUBMITTED,
      } as Order);

      await expect(
        service.updateStatus(1, OrderStatus.CANCELLED, {}, statusContext),
      ).rejects.toThrow('Use the cancellation workflow');

      expect(repo.update).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
      expect(gateway.notifyOrderUpdate).not.toHaveBeenCalled();
    });

    it.each([
      OrderStatus.RIDER_ASSIGNED,
      OrderStatus.PICKED_UP,
      OrderStatus.DELIVERED,
      OrderStatus.CANCELLED,
      OrderStatus.APPROVED_FOR_MATCHING,
    ])('treats a repeated %s status as an event-free no-op', async (status) => {
      const current = { ...mockOrder, orderStatus: status } as Order;
      repo.findOneOrFail.mockResolvedValue(current);
      repo.findOne.mockResolvedValue(current);

      await expect(
        service.updateStatus(1, status, {}, statusContext),
      ).resolves.toMatchObject(current);

      expect(repo.update).not.toHaveBeenCalled();
      expect(historyRepo.insert).not.toHaveBeenCalled();
      expect(gateway.notifyOrderUpdate).not.toHaveBeenCalled();
    });

    it('rejects an unknown status instead of treating it as a retry', async () => {
      await expect(
        service.updateStatus(1, 'not-a-real-status', {}, statusContext),
      ).rejects.toThrow('Unknown order status: not-a-real-status');

      expect(repo.findOneOrFail).not.toHaveBeenCalled();
      expect(repo.update).not.toHaveBeenCalled();
    });

    it.each(['delivery', null, 'legacy-option'])(
      'rejects completed pickup for non-pickup delivery option %s',
      async (deliveryOption) => {
        repo.findOneOrFail.mockResolvedValue({
          ...mockOrder,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
          deliveryOption,
        } as Order);

        await expect(
          service.updateStatus(
            1,
            OrderStatus.COLLECTED_BY_CUSTOMER,
            {},
            statusContext,
          ),
        ).rejects.toThrow('Completed pickup requires a pickup order');

        expect(repo.update).not.toHaveBeenCalled();
        expect(historyRepo.insert).not.toHaveBeenCalled();
      },
    );

    it('allows completed pickup for an explicit pickup order', async () => {
      repo.findOneOrFail.mockResolvedValue({
        ...mockOrder,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
        deliveryOption: 'pickup',
      } as Order);

      await service.updateStatus(
        1,
        OrderStatus.COLLECTED_BY_CUSTOMER,
        {},
        statusContext,
      );

      // Collected, then material concern window (issue_window_open).
      expect(repo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: OrderStatus.READY_FOR_DISPATCH },
        { orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER },
      );
      expect(repo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER },
        expect.objectContaining({
          orderStatus: OrderStatus.ISSUE_WINDOW_OPEN,
        }),
      );
    });

    it.each([
      [OrderStatus.READY_FOR_DISPATCH, OrderStatus.RIDER_ASSIGNED],
      [OrderStatus.RIDER_ASSIGNED, OrderStatus.READY_FOR_DISPATCH],
      [OrderStatus.RIDER_ASSIGNED, OrderStatus.PICKED_UP],
      [OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED],
    ])(
      'rejects generic admin assignment-owned transition %s to %s',
      async (fromStatus, toStatus) => {
        repo.findOneOrFail.mockResolvedValue({
          ...mockOrder,
          orderStatus: fromStatus,
        } as Order);

        await expect(
          service.updateStatus(1, toStatus, {}, statusContext),
        ).rejects.toThrow('Use the rider assignment workflow');

        expect(repo.update).not.toHaveBeenCalled();
        expect(historyRepo.insert).not.toHaveBeenCalled();
      },
    );

    it('rejects a skipped production transition', async () => {
      const placedOrder = {
        ...mockOrder,
        orderStatus: OrderStatus.SUBMITTED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(placedOrder);

      await expect(
        service.updateStatus(1, OrderStatus.READY_FOR_DISPATCH),
      ).rejects.toThrow(
        'Cannot transition from submitted to ready_for_dispatch',
      );

      expect(repo.update).not.toHaveBeenCalled();
      expect(gateway.notifyOrderUpdate).not.toHaveBeenCalled();
    });

    it('writes actor-aware status history in the status transaction', async () => {
      const placedOrder = {
        ...mockOrder,
        orderStatus: OrderStatus.NEEDS_QA,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(placedOrder);

      await service.updateStatus(
        1,
        OrderStatus.APPROVED_FOR_MATCHING,
        {},
        {
          actorUserId: 7,
          reason: 'Admin production update',
        },
      );

      expect(historyRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 1,
          fromStatus: OrderStatus.NEEDS_QA,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
          changedByUserId: 7,
          notes: 'Admin production update',
        }),
      );
      expect(historyRepo.insert.mock.invocationCallOrder[0]).toBeLessThan(
        (gateway.notifyOrderUpdate as jest.Mock).mock.invocationCallOrder[0],
      );
    });

    it('writes an AuditEvent on controlled status change', async () => {
      const placedOrder = {
        ...mockOrder,
        orderStatus: OrderStatus.NEEDS_QA,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(placedOrder);

      await service.updateStatus(
        1,
        OrderStatus.APPROVED_FOR_MATCHING,
        {},
        {
          actorUserId: 7,
          actorRole: 'ops_admin',
          reason: 'Admin production update',
        },
      );

      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        {
          orderId: 1,
          fromStatus: OrderStatus.NEEDS_QA,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
          actorUserId: 7,
          actorRole: 'ops_admin',
          reason: 'Admin production update',
        },
        expect.anything(),
      );
      expect(
        auditService.recordOrderStatusTransition.mock.invocationCallOrder[0],
      ).toBeGreaterThan(historyRepo.insert.mock.invocationCallOrder[0]);
      expect(
        auditService.recordOrderStatusTransition.mock.invocationCallOrder[0],
      ).toBeLessThan(
        (gateway.notifyOrderUpdate as jest.Mock).mock.invocationCallOrder[0],
      );
    });

    it('does not write audit on no-op same-status update', async () => {
      const current = {
        ...mockOrder,
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(current);
      repo.findOne.mockResolvedValue(current);

      await service.updateStatus(
        1,
        OrderStatus.APPROVED_FOR_MATCHING,
        {},
        statusContext,
      );

      expect(auditService.recordOrderStatusTransition).not.toHaveBeenCalled();
    });

    it('should update status and emit WebSocket event', async () => {
      const qaOrder = {
        ...mockOrder,
        orderStatus: OrderStatus.NEEDS_QA,
      } as Order;
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(qaOrder);

      const result = await service.updateStatus(
        1,
        OrderStatus.APPROVED_FOR_MATCHING,
        {},
        statusContext,
      );

      expect(repo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: OrderStatus.NEEDS_QA },
        { orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
      );
      expect(gateway.notifyOrderUpdate).toHaveBeenCalledWith(
        qaOrder.orderId,
        expect.objectContaining({ id: 1, orderId: 'ORD-10001' }),
      );
      expect(result).toEqual(expect.objectContaining({ id: 1 }));
    });

    it('rejects transitions out of cancelled after acquiring the row lock', async () => {
      const cancelled = {
        ...mockOrder,
        orderStatus: OrderStatus.CANCELLED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(cancelled);

      await expect(
        service.updateStatus(1, OrderStatus.PRODUCTION),
      ).rejects.toThrow('Cancelled orders are terminal');

      expect(repo.update).not.toHaveBeenCalled();
      expect(gateway.notifyOrderUpdate).not.toHaveBeenCalled();
    });

    it('rejects a status write when the expected row was not affected', async () => {
      const qaOrder = {
        ...mockOrder,
        orderStatus: OrderStatus.NEEDS_QA,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(qaOrder);
      repo.update.mockResolvedValue({ affected: 0 } as any);

      await expect(
        service.updateStatus(
          1,
          OrderStatus.APPROVED_FOR_MATCHING,
          {},
          statusContext,
        ),
      ).rejects.toThrow('Order changed during status update');

      expect(gateway.notifyOrderUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus notifications', () => {
    it('sends delivery progress as string data in a data-only status push', async () => {
      const updated = {
        ...mockOrder,
        orderStatus: OrderStatus.PRODUCTION,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(updated);
      (usersService.getFcmToken as jest.Mock).mockResolvedValue('token-1');

      await service.publishStatusUpdate(
        {
          ...mockOrder,
          orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
        } as Order,
        updated.id,
        OrderStatus.PRODUCTION,
      );

      expect(firebaseService.sendToDevice).toHaveBeenCalledWith(
        'token-1',
        'Printing Started',
        `Your order ${mockOrder.orderId} is being printed.`,
        {
          orderId: String(mockOrder.id),
          status: OrderStatus.PRODUCTION,
          toStatus: OrderStatus.PRODUCTION,
          type: 'delivery_status',
          progressCurrent: '2',
          progressTotal: '5',
        },
        { dataOnly: true },
      );
    });

    it('omits journey progress for an unmapped status push', async () => {
      const updated = {
        ...mockOrder,
        orderStatus: OrderStatus.SUPPLIER_ASSIGNED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(updated);
      (usersService.getFcmToken as jest.Mock).mockResolvedValue('token-1');

      await service.publishStatusUpdate(
        {
          ...mockOrder,
          orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
        } as Order,
        updated.id,
        OrderStatus.SUPPLIER_ASSIGNED,
      );

      const data = (firebaseService.sendToDevice as jest.Mock).mock.calls[0][3];
      expect(data).toEqual(
        expect.objectContaining({
          type: 'delivery_status',
          status: OrderStatus.SUPPLIER_ASSIGNED,
        }),
      );
      expect(data).not.toHaveProperty('progressCurrent');
      expect(data).not.toHaveProperty('progressTotal');
      expect(
        (firebaseService.sendToDevice as jest.Mock).mock.calls[0][4],
      ).toEqual({ dataOnly: true });
    });

    it('keeps publication best-effort when customer FCM delivery fails', async () => {
      const updated = {
        ...mockOrder,
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(updated);
      (usersService.getFcmToken as jest.Mock).mockResolvedValue('token-1');
      (firebaseService.sendToDevice as jest.Mock).mockRejectedValue(
        new Error('FCM unavailable'),
      );

      await expect(
        service.publishStatusUpdate(
          { ...mockOrder, orderStatus: OrderStatus.SUBMITTED } as Order,
          updated.id,
          OrderStatus.APPROVED_FOR_MATCHING,
        ),
      ).resolves.toEqual(expect.objectContaining({ id: updated.id }));

      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'order_approved_for_matching' }),
      );
    });

    it('notifies admins when the complete cancellation workflow succeeds', async () => {
      const placedOrder = {
        ...mockOrder,
        userId: 1,
        paymentMethod: 'gcash',
        orderStatus: OrderStatus.SUBMITTED,
      } as Order;
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(placedOrder);

      await service.cancelOrder(1, placedOrder.userId);

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order_cancelled',
          orderRef: placedOrder.orderId,
        }),
      );
    });

    it('notifies admins when status becomes file_rejected', async () => {
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(mockOrder);

      await service.updateStatus(
        1,
        OrderStatus.FILE_REJECTED,
        {},
        statusContext,
      );

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'order_declined',
          orderRef: mockOrder.orderId,
        }),
      );
    });

    it.each([
      [OrderStatus.FILE_REJECTED, 'File Rejected', OrderStatus.SUBMITTED, {}],
      [
        OrderStatus.PRODUCTION,
        'Printing Started',
        OrderStatus.PAYMENT_AUTHORIZED,
        {
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        },
      ],
    ])(
      'notifies the customer when status becomes %s',
      async (status, title, fromStatus, extras) => {
        repo.update.mockResolvedValue(undefined as any);
        repo.findOneOrFail.mockResolvedValue({
          ...mockOrder,
          orderStatus: fromStatus,
          ...extras,
        } as Order);

        await service.updateStatus(1, status, {}, statusContext);

        expect(notificationsService.create).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: mockOrder.userId,
            title,
            type: `order_${status}`,
            orderRef: mockOrder.orderId,
          }),
        );
      },
    );

    it('does NOT call createForAllAdmins for other statuses', async () => {
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue({
        ...mockOrder,
        orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
      } as Order);

      await service.updateStatus(1, OrderStatus.PRODUCTION, {}, statusContext);

      expect(notificationsService.createForAllAdmins).not.toHaveBeenCalled();
    });
  });

  describe('cancelOrder', () => {
    it('writes customer cancellation history in the cancellation transaction', async () => {
      const placedOrder = {
        ...mockOrder,
        userId: 7,
        paymentMethod: 'gcash',
        orderStatus: OrderStatus.SUBMITTED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(placedOrder);

      await service.cancelOrder(placedOrder.id, placedOrder.userId);

      expect(historyRepo.insert).toHaveBeenCalledWith({
        orderId: placedOrder.id,
        fromStatus: OrderStatus.SUBMITTED,
        toStatus: OrderStatus.CANCELLED,
        changedByUserId: placedOrder.userId,
        notes: 'Customer cancelled order',
      });
    });

    it('refunds GRIDGO Credits before cancelling an eligible credit-paid order', async () => {
      const creditOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 250,
        deliveryFee: 30,
        paymentMethod: 'gridCredits',
        orderStatus: OrderStatus.SUBMITTED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(creditOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, 1);

      expect(creditsService.refundCredits).toHaveBeenCalledWith(
        creditOrder.userId,
        Number(creditOrder.totalPrice) + Number(creditOrder.deliveryFee),
        `ORDER-REFUND:${creditOrder.orderId}`,
        expect.anything(),
        [creditOrder.orderId],
      );
      expect(repo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: creditOrder.orderStatus },
        {
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: 'refunded',
        },
      );
    });

    it('refunds individual decimal-string charge components exactly once', async () => {
      const creditOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: '40.00',
        deliveryFee: '20.00',
        paymentMethod: 'gridCredits',
        orderStatus: OrderStatus.SUBMITTED,
      } as unknown as Order;
      repo.findOneOrFail.mockResolvedValue(creditOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, creditOrder.userId);

      expect(creditsService.refundCredits).toHaveBeenCalledWith(
        creditOrder.userId,
        60,
        `ORDER-REFUND:${creditOrder.orderId}`,
        expect.anything(),
        [creditOrder.orderId],
      );
    });

    it('refunds GRIDGO Credits when the stored payment method is snake_case', async () => {
      const creditOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 250,
        paymentMethod: 'grid_credits',
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(creditOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, 1);

      expect(creditsService.refundCredits).toHaveBeenCalledWith(
        creditOrder.userId,
        Number(creditOrder.totalPrice),
        `ORDER-REFUND:${creditOrder.orderId}`,
        expect.anything(),
        [creditOrder.orderId],
      );
    });

    it('does not refund credits for non-credit payment methods', async () => {
      const gcashOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 250,
        paymentMethod: 'gcash',
        orderStatus: OrderStatus.SUBMITTED,
      } as Order;
      repo.findOneOrFail.mockResolvedValue(gcashOrder);
      repo.update.mockResolvedValue(undefined as any);

      await service.cancelOrder(1, 1);

      expect(creditsService.refundCredits).not.toHaveBeenCalled();
    });

    it('does not parse charge components for non-credit cancellations', async () => {
      const gcashOrder = {
        ...mockOrder,
        userId: 1,
        totalPrice: 'legacy-invalid-value',
        paymentMethod: 'gcash',
        orderStatus: OrderStatus.SUBMITTED,
      } as unknown as Order;
      repo.findOneOrFail.mockResolvedValue(gcashOrder);
      repo.update.mockResolvedValue(undefined as any);

      await expect(service.cancelOrder(1, 1)).resolves.toMatchObject(
        gcashOrder,
      );

      expect(creditsService.refundCredits).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        { id: 1, orderStatus: gcashOrder.orderStatus },
        { orderStatus: OrderStatus.CANCELLED },
      );
    });
  });

  describe('cancelBatch', () => {
    it('writes one customer cancellation history row per changed batch order', async () => {
      const batch = {
        id: 79,
        batchRef: 'BATCH-10003',
        userId: 9,
        subtotal: 80,
        deliveryFee: 0,
        priorityFee: 0,
        extraDestinationFee: 0,
        paymentMethod: 'gcash',
        slotBookingId: null,
      } as BatchOrder;
      const orders = [1, 2].map(
        (id) =>
          ({
            ...mockOrder,
            id,
            orderId: `ORD-1002${id}`,
            userId: batch.userId,
            batchOrderId: batch.id,
            orderStatus: OrderStatus.SUBMITTED,
          }) as Order,
      );
      repo.find.mockResolvedValue(orders);
      (batchRepo.findOne as jest.Mock).mockResolvedValue(batch);
      repo.findOneOrFail.mockImplementation(async ({ where }) =>
        orders.find((order) => order.id === where.id),
      );

      await service.cancelBatch(batch.id, batch.userId);

      expect(historyRepo.insert).toHaveBeenCalledWith(
        orders.map((order) => ({
          orderId: order.id,
          fromStatus: OrderStatus.SUBMITTED,
          toStatus: OrderStatus.CANCELLED,
          changedByUserId: batch.userId,
          notes: 'Customer cancelled batch',
        })),
      );
    });

    it('refunds one logical batch charge once when legacy data has multiple order rows', async () => {
      const batch = {
        id: 77,
        batchRef: 'BATCH-10001',
        userId: 1,
        subtotal: '40.00',
        totalPrice: '85.00',
        deliveryFee: '20.00',
        priorityFee: '15.00',
        extraDestinationFee: '10.00',
        paymentMethod: 'gridCredits',
        slotBookingId: null,
      } as unknown as BatchOrder;
      const orders = [1, 2].map(
        (id) =>
          ({
            ...mockOrder,
            id,
            orderId: `ORD-1000${id}`,
            userId: 1,
            batchOrderId: batch.id,
            batchOrder: batch,
            paymentMethod: 'gridCredits',
            orderStatus: OrderStatus.SUBMITTED,
          }) as Order,
      );
      repo.find.mockResolvedValue(orders);
      (batchRepo.findOne as jest.Mock).mockResolvedValue(batch);
      repo.findOneOrFail.mockImplementation(async ({ where }) => {
        return orders.find((order) => order.id === where.id) ?? orders[0];
      });

      await service.cancelBatch(batch.id, 1);

      expect(creditsService.refundCredits).toHaveBeenCalledTimes(1);
      expect(creditsService.refundCredits).toHaveBeenCalledWith(
        1,
        85,
        'BATCH-REFUND:BATCH-10001',
        expect.anything(),
        ['ORD-10001', 'ORD-10002'],
      );
      expect(repo.update).toHaveBeenCalledWith(
        expect.objectContaining({ batchOrderId: batch.id }),
        expect.objectContaining({
          orderStatus: OrderStatus.CANCELLED,
          paymentStatus: 'refunded',
        }),
      );
    });

    it('rolls back when the bulk update does not affect every locked order', async () => {
      const batch = {
        id: 78,
        batchRef: 'BATCH-10002',
        userId: 1,
        subtotal: 40,
        deliveryFee: 0,
        priorityFee: 0,
        extraDestinationFee: 0,
        paymentMethod: 'gcash',
        slotBookingId: null,
      } as BatchOrder;
      const orders = [1, 2].map(
        (id) =>
          ({
            ...mockOrder,
            id,
            orderId: `ORD-1001${id}`,
            userId: 1,
            batchOrderId: batch.id,
            orderStatus: OrderStatus.SUBMITTED,
          }) as Order,
      );
      repo.find.mockResolvedValue(orders);
      (batchRepo.findOne as jest.Mock).mockResolvedValue(batch);
      repo.update.mockResolvedValue({ affected: 1 } as any);

      await expect(service.cancelBatch(batch.id, 1)).rejects.toThrow(
        'Batch changed during cancellation',
      );

      expect(gateway.notifyOrderUpdate).not.toHaveBeenCalled();
    });
  });

  describe('beta order limit', () => {
    const enrolledAt = new Date('2026-04-01T00:00:00Z');

    it('allows non-beta users regardless of order count', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        isBetaUser: false,
        betaEnrolledAt: null,
      });
      const countSpy = repo.count as jest.Mock;
      countSpy.mockClear();
      await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();
      expect(countSpy).not.toHaveBeenCalled();
    });

    it('allows beta users with zero orders since enrollment', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      (repo.count as jest.Mock).mockResolvedValue(0);
      await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();
    });

    it('throws BETA_ORDER_LIMIT_REACHED for beta users with >=1 order since enrollment', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      (repo.count as jest.Mock).mockResolvedValue(1);
      await expect(service.assertBetaOrderLimit(7)).rejects.toMatchObject({
        response: { code: BETA_ORDER_LIMIT_REACHED },
      });
      await expect(service.assertBetaOrderLimit(7)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('counts only orders with createdAt >= betaEnrolledAt', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      const countSpy = repo.count as jest.Mock;
      countSpy.mockClear();
      countSpy.mockResolvedValue(0);
      await service.assertBetaOrderLimit(7);
      expect(countSpy).toHaveBeenCalledWith({
        where: {
          userId: 7,
          createdAt: MoreThanOrEqual(enrolledAt),
        },
      });
    });

    it('treats missing betaEnrolledAt as no limit (defensive)', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: null,
      });
      const countSpy = repo.count as jest.Mock;
      countSpy.mockClear();
      await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();
      expect(countSpy).not.toHaveBeenCalled();
    });

    it('bypasses the beta order cap when beta mode is disabled', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { is_enabled: false },
      ]);
      const countSpy = repo.count as jest.Mock;
      countSpy.mockClear();

      await expect(
        service.assertBetaOrderLimit(7, repo as Repository<Order>, false),
      ).resolves.toBeUndefined();

      expect(countSpy).not.toHaveBeenCalled();
    });

    it('never applies the beta order cap to a non-customer role', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'rider',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { is_enabled: true },
      ]);
      const countSpy = repo.count as jest.Mock;
      countSpy.mockClear();

      await expect(service.assertBetaOrderLimit(7)).resolves.toBeUndefined();

      expect(countSpy).not.toHaveBeenCalled();
    });

    it('keeps the beta order cap for a survey-exempt beta customer', async () => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        isBetaSurveyExempt: true,
        betaEnrolledAt: enrolledAt,
      });
      (dataSource.query as jest.Mock).mockResolvedValueOnce([
        { is_enabled: true },
      ]);
      (repo.count as jest.Mock).mockResolvedValueOnce(1);

      await expect(service.assertBetaOrderLimit(7)).rejects.toMatchObject({
        response: { code: BETA_ORDER_LIMIT_REACHED },
      });
    });
  });

  describe('beta limit gating on writes', () => {
    const enrolledAt = new Date('2026-04-01T00:00:00Z');

    beforeEach(() => {
      (usersService.findById as jest.Mock).mockResolvedValue({
        id: 7,
        role: 'client',
        isBetaUser: true,
        betaEnrolledAt: enrolledAt,
      });
      (repo.count as jest.Mock).mockResolvedValue(1);
    });

    it('create() rejects beta user past the cap', async () => {
      await expect(
        service.create({
          userId: 7,
          category: 'paper',
          quantity: 1,
          totalPrice: 0,
        }),
      ).rejects.toMatchObject({
        response: { code: 'BETA_ORDER_LIMIT_REACHED' },
      });
    });

    it('createBatch() rejects under the locked transaction policy', async () => {
      const txSpy = dataSource.transaction as jest.Mock;
      txSpy.mockClear();
      await expect(
        service.createBatch(7, {
          items: [{ category: 'paper', quantity: 1, totalPrice: 0 }],
          deliveryFee: 0,
          paymentMethod: 'cod',
          deliveryOption: 'pickup',
        } as any),
      ).rejects.toMatchObject({
        response: { code: 'BETA_ORDER_LIMIT_REACHED' },
      });
      expect(txSpy).toHaveBeenCalledTimes(1);
    });
  });
});

describe('OrdersService.updateStatus — expiresAt stamping', () => {
  let service: OrdersService;
  let transactionManager: any;
  let transactionHistoryRepo: { insert: jest.Mock };
  let transactionUserRepo: { findOne: jest.Mock };
  let transactionEvents: string[];
  const ordersRepo = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockFilesService = { stampExpiry: jest.fn() };
  const mockUsersService = { findById: jest.fn(), getFcmToken: jest.fn() };
  const mockGateway = {
    notifyOrderUpdate: jest.fn(),
    notifySurveyRequired: jest.fn(),
  };
  const mockFirebase = { sendToDevice: jest.fn() };
  const mockCredits = {
    subtractCredits: jest.fn(),
    refundCredits: jest.fn(),
  };
  const mockNotifications = {
    create: jest.fn(),
    createForAllAdmins: jest.fn(),
  };
  const mockTamSurveysService = {
    createPostDeliveryRequirementIfNeeded: jest.fn(),
  };

  const makeOrder = (overrides: Partial<Order> = {}): Order =>
    ({
      id: 1,
      orderId: 'ORD-10001',
      userId: 99,
      fileMetadataId: 5,
      orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER,
      ...overrides,
    }) as Order;

  beforeEach(async () => {
    jest.clearAllMocks();
    transactionEvents = [];
    transactionHistoryRepo = { insert: jest.fn().mockResolvedValue({}) };
    transactionUserRepo = { findOne: jest.fn() };
    transactionManager = {
      getRepository: jest.fn((entity) => {
        if (entity === Order) return ordersRepo;
        if (entity === OrderStatusHistory) return transactionHistoryRepo;
        if (entity === User) return transactionUserRepo;
        throw new Error(`Unexpected repository ${entity.name}`);
      }),
    };
    ordersRepo.findOneOrFail.mockResolvedValue(makeOrder());
    ordersRepo.update.mockResolvedValue({ affected: 1 });
    const transaction = jest.fn(async (work) => {
      transactionEvents.push('transaction-start');
      const result = await work(transactionManager);
      transactionEvents.push('transaction-commit');
      return result;
    });
    mockGateway.notifySurveyRequired.mockImplementation(() => {
      transactionEvents.push('survey-ws');
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        specValueRepoProvider(),
        dispatchPlanRepoProvider(),
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        {
          provide: getRepositoryToken(PaperSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ThreeDSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: { findOne: jest.fn() },
        },
        { provide: OrdersGateway, useValue: mockGateway },
        { provide: FirebaseService, useValue: mockFirebase },
        { provide: UsersService, useValue: mockUsersService },
        { provide: CreditsService, useValue: mockCredits },
        {
          provide: PaymentsService,
          useValue: {
            assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
            ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        { provide: NotificationsService, useValue: mockNotifications },
        { provide: TamSurveysService, useValue: mockTamSurveysService },
        { provide: FilesService, useValue: mockFilesService },
        { provide: DataSource, useValue: { transaction } },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOne: jest.fn(), findOneOrFail: jest.fn() },
        },
        {
          provide: DeliverySlotsService,
          useValue: {
            bookSlot: jest.fn().mockResolvedValue({ id: 1 }),
            getAvailability: jest.fn().mockResolvedValue([
              {
                templateId: 1,
                startTime: '00:00:00',
                endTime: '23:59:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
            ]),
          },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              buildVolumeWidthMm: 999,
              buildVolumeDepthMm: 999,
              buildVolumeHeightMm: 999,
              maxFileSizeMb: 999,
            }),
          },
        },
        catalogPricingProvider(),
        {
          provide: AuditService,
          useValue: {
            recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
            append: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();
    service = module.get<OrdersService>(OrdersService);
  });

  it('completes delivery, history, expiry, and survey using one manager', async () => {
    const arrived = makeOrder({
      orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      deliveryOption: 'delivery',
    });
    const historyRepo = { insert: jest.fn().mockResolvedValue({}) };
    const userRepo = {
      findOne: jest
        .fn()
        .mockResolvedValue({ id: arrived.userId, fileRetentionDays: 7 }),
    };
    const manager = {
      getRepository: jest.fn((entity) => {
        if (entity === Order) return ordersRepo;
        if (entity === OrderStatusHistory) return historyRepo;
        if (entity === User) return userRepo;
        throw new Error(`Unexpected repository ${entity.name}`);
      }),
    } as any;
    const surveyRequirement = { id: 77 } as TamSurveyRequirement;
    ordersRepo.findOneOrFail.mockResolvedValue(arrived);
    ordersRepo.update.mockResolvedValue({ affected: 1 });
    mockFilesService.stampExpiry.mockResolvedValue(undefined);
    mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
      surveyRequirement,
    );

    const result = await Promise.resolve().then(() =>
      (service as any).completeDelivery(manager, arrived.id, 51),
    );

    expect(ordersRepo.update).toHaveBeenCalledWith(
      {
        id: arrived.id,
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      },
      { orderStatus: OrderStatus.DELIVERED },
    );
    // Phase 9: delivered → issue_window_open with 24h window.
    expect(ordersRepo.update).toHaveBeenCalledWith(
      {
        id: arrived.id,
        orderStatus: OrderStatus.DELIVERED,
      },
      expect.objectContaining({
        orderStatus: OrderStatus.ISSUE_WINDOW_OPEN,
        issueWindowEndsAt: expect.any(Date),
      }),
    );
    expect(historyRepo.insert).toHaveBeenCalledWith({
      orderId: arrived.id,
      fromStatus: OrderStatus.OUT_FOR_DELIVERY,
      toStatus: OrderStatus.DELIVERED,
      changedByUserId: 51,
      notes: 'Rider completed delivery',
    });
    expect(historyRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: arrived.id,
        fromStatus: OrderStatus.DELIVERED,
        toStatus: OrderStatus.ISSUE_WINDOW_OPEN,
        changedByUserId: 51,
      }),
    );
    expect(
      (service as any).auditService.recordOrderStatusTransition,
    ).toHaveBeenCalledWith(
      {
        orderId: arrived.id,
        fromStatus: OrderStatus.OUT_FOR_DELIVERY,
        toStatus: OrderStatus.DELIVERED,
        actorUserId: 51,
        actorRole: 'rider',
        reason: 'Rider completed delivery',
      },
      manager,
    );
    expect(mockFilesService.stampExpiry).toHaveBeenCalledWith(
      arrived.fileMetadataId,
      7,
      manager,
    );
    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).toHaveBeenCalledWith(arrived, manager);
    expect(result).toEqual({
      previous: arrived,
      surveyRequirement,
      publishedStatus: OrderStatus.ISSUE_WINDOW_OPEN,
    });
  });

  it('publishes a transaction-created survey requirement without creating another', async () => {
    const delivered = makeOrder({ orderStatus: OrderStatus.DELIVERED });
    const surveyRequirement = { id: 77 } as TamSurveyRequirement;
    ordersRepo.findOneOrFail.mockResolvedValue(delivered);
    mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
      { id: 999 },
    );
    mockUsersService.getFcmToken.mockResolvedValue(null);

    await (service.publishStatusUpdate as any)(
      delivered,
      delivered.id,
      OrderStatus.DELIVERED,
      surveyRequirement,
    );

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).not.toHaveBeenCalled();
    expect(mockGateway.notifySurveyRequired).toHaveBeenCalledWith(
      delivered.userId,
      {
        requirementId: surveyRequirement.id,
        orderId: delivered.id,
        orderRef: delivered.orderId,
      },
    );
  });

  it('keeps completed-pickup expiry and survey writes atomic before events', async () => {
    const ready = makeOrder({
      orderStatus: OrderStatus.READY_FOR_DISPATCH,
      deliveryOption: 'pickup',
    });
    const completed = makeOrder({
      orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER,
      deliveryOption: 'pickup',
    });
    const surveyRequirement = { id: 88 } as TamSurveyRequirement;
    ordersRepo.findOneOrFail
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(completed);
    ordersRepo.update.mockResolvedValue({ affected: 1 });
    transactionUserRepo.findOne.mockResolvedValue({
      id: ready.userId,
      fileRetentionDays: 7,
    });
    mockFilesService.stampExpiry.mockResolvedValue(undefined);
    mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
      surveyRequirement,
    );
    mockUsersService.getFcmToken.mockResolvedValue(null);

    await service.updateStatus(
      ready.id,
      OrderStatus.COLLECTED_BY_CUSTOMER,
      {},
      { actorUserId: 51, reason: 'Customer collected pickup' },
    );

    expect(mockFilesService.stampExpiry).toHaveBeenCalledWith(
      ready.fileMetadataId,
      7,
      transactionManager,
    );
    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).toHaveBeenCalledWith(ready, transactionManager);
    expect(mockGateway.notifySurveyRequired).toHaveBeenCalledWith(
      ready.userId,
      expect.objectContaining({ requirementId: surveyRequirement.id }),
    );
    expect(transactionEvents.indexOf('transaction-commit')).toBeLessThan(
      transactionEvents.indexOf('survey-ws'),
    );
  });

  it('returns the committed pickup when post-commit publication fails and retry is event-free', async () => {
    const ready = makeOrder({
      orderStatus: OrderStatus.READY_FOR_DISPATCH,
      deliveryOption: 'pickup',
    });
    const completed = makeOrder({
      orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER,
      deliveryOption: 'pickup',
    });
    const surveyRequirement = { id: 89 } as TamSurveyRequirement;
    ordersRepo.findOneOrFail
      .mockResolvedValue(completed)
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(ready)
      .mockRejectedValueOnce(new Error('post-commit reload failed'));
    ordersRepo.findOne.mockResolvedValue(completed);
    ordersRepo.update.mockResolvedValue({ affected: 1 });
    transactionUserRepo.findOne.mockResolvedValue({
      id: ready.userId,
      fileRetentionDays: 7,
    });
    mockFilesService.stampExpiry.mockResolvedValue(undefined);
    mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
      surveyRequirement,
    );
    await expect(
      service.updateStatus(
        ready.id,
        OrderStatus.COLLECTED_BY_CUSTOMER,
        {},
        { actorUserId: 51, reason: 'Customer collected pickup' },
      ),
    ).resolves.toMatchObject(completed);

    // collected + issue-window endsAt + issue_window_open status
    expect(ordersRepo.update).toHaveBeenCalledTimes(3);
    expect(transactionHistoryRepo.insert).toHaveBeenCalledTimes(2);
    expect(mockFilesService.stampExpiry).toHaveBeenCalledTimes(1);
    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).toHaveBeenCalledTimes(1);

    await expect(
      service.updateStatus(
        completed.id,
        OrderStatus.COLLECTED_BY_CUSTOMER,
        {},
        { actorUserId: 51, reason: 'Retry after response failure' },
      ),
    ).resolves.toMatchObject(completed);

    // Retry is idempotent when already collected/windowed (no extra writes).
    expect(ordersRepo.update).toHaveBeenCalledTimes(3);
    expect(transactionHistoryRepo.insert).toHaveBeenCalledTimes(2);
    expect(mockFilesService.stampExpiry).toHaveBeenCalledTimes(1);
    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).toHaveBeenCalledTimes(1);
  });

  it('returns committed pickup state when post-commit assignment attachment fails', async () => {
    const ready = makeOrder({
      orderStatus: OrderStatus.READY_FOR_DISPATCH,
      deliveryOption: 'pickup',
    });
    const completed = makeOrder({
      orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER,
      deliveryOption: 'pickup',
    });
    ordersRepo.findOneOrFail
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(completed);
    ordersRepo.findOne.mockResolvedValue(completed);
    ordersRepo.update.mockResolvedValue({ affected: 1 });
    transactionUserRepo.findOne.mockResolvedValue({
      id: ready.userId,
      fileRetentionDays: null,
    });
    mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
      null,
    );
    jest
      .spyOn(service as any, 'attachDeliveryAssignmentIds')
      .mockRejectedValueOnce(new Error('assignment reload failed'));

    await expect(
      service.updateStatus(
        ready.id,
        OrderStatus.COLLECTED_BY_CUSTOMER,
        {},
        { actorUserId: 51, reason: 'Customer collected pickup' },
      ),
    ).resolves.toMatchObject(completed);

    expect(ordersRepo.update).toHaveBeenCalledTimes(3);
    expect(transactionHistoryRepo.insert).toHaveBeenCalledTimes(2);
  });

  it('keeps pickup completion successful when every post-commit notification channel fails', async () => {
    const ready = makeOrder({
      orderStatus: OrderStatus.READY_FOR_DISPATCH,
      deliveryOption: 'pickup',
    });
    const completed = makeOrder({
      orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER,
      deliveryOption: 'pickup',
    });
    ordersRepo.findOneOrFail
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(ready)
      .mockResolvedValueOnce(completed);
    ordersRepo.update.mockResolvedValue({ affected: 1 });
    transactionUserRepo.findOne.mockResolvedValue({
      id: ready.userId,
      fileRetentionDays: null,
    });
    mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
      null,
    );
    mockUsersService.getFcmToken.mockRejectedValue(
      new Error('fcm lookup failed'),
    );
    mockGateway.notifyOrderUpdate.mockRejectedValue(new Error('socket failed'));
    mockNotifications.create.mockRejectedValue(
      new Error('notification failed'),
    );

    await expect(
      service.updateStatus(
        ready.id,
        OrderStatus.COLLECTED_BY_CUSTOMER,
        {},
        { actorUserId: 51, reason: 'Customer collected pickup' },
      ),
    ).resolves.toMatchObject(completed);

    // collected + issue window endsAt + issue_window_open
    expect(ordersRepo.update).toHaveBeenCalledTimes(3);
    expect(transactionHistoryRepo.insert).toHaveBeenCalledTimes(2);
  });

  it('does not repeat completed-pickup expiry writes during publication', async () => {
    const order = makeOrder();
    ordersRepo.findOneOrFail
      .mockResolvedValueOnce(order) // existing (before update)
      .mockResolvedValueOnce(order); // after update
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp when user fileRetentionDays is null', async () => {
    const order = makeOrder();
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp when order has no fileMetadataId', async () => {
    const order = makeOrder({ fileMetadataId: null });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'completed_pickup');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not stamp for non-completion statuses', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.APPROVED_FOR_MATCHING });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'file_verified');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not repeat delivered expiry writes during publication', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: 7 });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'delivered');

    expect(mockFilesService.stampExpiry).not.toHaveBeenCalled();
  });

  it('does not create a survey requirement during delivered publication', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'delivered');

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).not.toHaveBeenCalled();
  });

  it('does not create a survey requirement during pickup publication', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.COLLECTED_BY_CUSTOMER });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'completed_pickup');

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).not.toHaveBeenCalled();
  });

  it('continues notification flow when survey WebSocket publication fails', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockGateway.notifySurveyRequired.mockImplementationOnce(() => {
      throw new Error('survey socket unavailable');
    });
    mockNotifications.create.mockResolvedValue({});

    try {
      await expect(
        service.publishStatusUpdate(order, 1, 'delivered', {
          id: 42,
        } as TamSurveyRequirement),
      ).resolves.toMatchObject(order);

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: order.userId,
          type: 'order_delivered',
          orderRef: order.orderId,
        }),
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('survey-required WS emit failed'),
      );
    } finally {
      warnSpy.mockRestore();
    }
  });

  it('does not create a survey requirement for non-completion statuses', async () => {
    const order = makeOrder({ orderStatus: OrderStatus.APPROVED_FOR_MATCHING });
    ordersRepo.findOneOrFail.mockResolvedValue(order);
    ordersRepo.update.mockResolvedValue({});
    mockUsersService.getFcmToken.mockResolvedValue(null);
    mockNotifications.create.mockResolvedValue({});

    await service.publishStatusUpdate(order, 1, 'file_verified');

    expect(
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded,
    ).not.toHaveBeenCalled();
  });

  describe('survey-required real-time notifications when delivered', () => {
    const surveyReq = { id: 42, orderId: 1, userId: 99 };

    beforeEach(() => {
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
        surveyReq as any,
      );
      mockNotifications.create.mockResolvedValue({});
    });

    it('emits survey-required WS event when delivered and requirement is created', async () => {
      const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
      ordersRepo.findOneOrFail.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue({});
      mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
      mockUsersService.getFcmToken.mockResolvedValue(null);

      await service.publishStatusUpdate(
        order,
        1,
        'delivered',
        surveyReq as any,
      );

      expect(mockGateway.notifySurveyRequired).toHaveBeenCalledWith(
        order.userId,
        expect.objectContaining({
          requirementId: surveyReq.id,
          orderId: order.id,
          orderRef: order.orderId,
        }),
      );
    });

    it('creates a survey_required in-app notification when delivered', async () => {
      const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
      ordersRepo.findOneOrFail.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue({});
      mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
      mockUsersService.getFcmToken.mockResolvedValue(null);

      await service.publishStatusUpdate(
        order,
        1,
        'delivered',
        surveyReq as any,
      );

      expect(mockNotifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: order.userId,
          type: 'survey_required',
          orderRef: order.orderId,
          metadata: expect.objectContaining({
            orderId: order.id,
            requirementId: surveyReq.id,
          }),
        }),
      );
    });

    it('sends FCM push with survey_required type when user has a token', async () => {
      const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
      ordersRepo.findOneOrFail.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue({});
      mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
      // getFcmToken is called for both the status push and the survey push
      mockUsersService.getFcmToken.mockResolvedValue('fcm-xyz');

      await service.publishStatusUpdate(
        order,
        1,
        'delivered',
        surveyReq as any,
      );

      // Verify at least one call was made with the survey_required metadata
      const surveyCalls = mockFirebase.sendToDevice.mock.calls.filter(
        (call: any[]) => call[3]?.type === 'survey_required',
      );
      expect(surveyCalls).toHaveLength(1);
      expect(surveyCalls[0][0]).toBe('fcm-xyz');
      expect(surveyCalls[0][4]).toBeUndefined();
    });

    it('skips WS/notification when survey requirement returns null (non-beta user)', async () => {
      mockTamSurveysService.createPostDeliveryRequirementIfNeeded.mockResolvedValue(
        null,
      );
      const order = makeOrder({ orderStatus: OrderStatus.DELIVERED });
      ordersRepo.findOneOrFail.mockResolvedValue(order);
      ordersRepo.update.mockResolvedValue({});
      mockUsersService.findById.mockResolvedValue({ fileRetentionDays: null });
      mockUsersService.getFcmToken.mockResolvedValue(null);

      await service.publishStatusUpdate(order, 1, 'delivered');

      expect(mockGateway.notifySurveyRequired).not.toHaveBeenCalled();
      const surveyCalls = mockNotifications.create.mock.calls.filter(
        (call: any[]) => call[0]?.type === 'survey_required',
      );
      expect(surveyCalls).toHaveLength(0);
    });
  });
});

describe('createBatch with slot + destinations', () => {
  let service: OrdersService;

  // Repos
  let batchRepo: jest.Mocked<Partial<Repository<any>>>;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let orderItemsRepo: jest.Mocked<Partial<Repository<OrderItem>>>;
  let paperSpecsRepo: jest.Mocked<Partial<Repository<PaperSpec>>>;
  let threeDSpecsRepo: jest.Mocked<Partial<Repository<ThreeDSpec>>>;
  let assignmentRepo: jest.Mocked<Partial<Repository<DeliveryAssignment>>>;
  let addressRepo: jest.Mocked<Partial<Repository<Address>>>;
  let destinationRepo: jest.Mocked<Partial<Repository<DeliveryDestination>>>;

  // Services / gateway
  let slotsService: jest.Mocked<Partial<DeliverySlotsService>>;
  let settingsService: jest.Mocked<Partial<DeliverySettingsService>>;
  let slotsGateway: jest.Mocked<Partial<DeliverySlotsGateway>>;
  let dataSource: Partial<DataSource>;

  // Saved batch reference captured during each test
  let capturedBatch: any;

  const makeItem = (overrides: Record<string, any> = {}) => ({
    category: 'paper',
    quantity: 1,
    totalPrice: 100,
    fileName: 'file.pdf',
    fileUrl: 'https://cdn/file.pdf',
    ...overrides,
  });

  const makeAddress = (id: number, lat: number, lng: number): Address =>
    ({
      id,
      userId: 1,
      label: id === 10 ? 'Saved Home' : `Saved ${id}`,
      fullAddress: `${id} Saved Address`,
      barangay: 'Barangay 1',
      city: 'Davao City',
      province: 'Davao del Sur',
      zipCode: '8000',
      landmark: 'Near the gate',
      latitude: lat,
      longitude: lng,
    }) as unknown as Address;

  beforeEach(async () => {
    jest.clearAllMocks();
    capturedBatch = null;

    batchRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((data) => ({
        id: 77,
        batchRef: 'BATCH-10001',
        ...data,
      })),
      save: jest.fn().mockImplementation(async (b) => {
        capturedBatch = { ...b };
        return capturedBatch;
      }),
    };

    ordersRepo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockImplementation((data) => data as Order),
      save: jest.fn().mockImplementation(async (o) => ({ id: 1, ...o })),
      findOneOrFail: jest.fn().mockImplementation(async () => ({
        id: 1,
        orderId: 'ORD-10001',
        category: 'batch',
        items: [],
      })),
    };

    orderItemsRepo = {
      create: jest.fn().mockImplementation((data) => data as OrderItem),
      save: jest.fn().mockImplementation(async (item) => ({ id: 1, ...item })),
    };

    paperSpecsRepo = {
      create: jest.fn().mockImplementation((data) => data as PaperSpec),
      save: jest.fn().mockResolvedValue({} as PaperSpec),
    };

    threeDSpecsRepo = {
      create: jest.fn().mockImplementation((data) => data as ThreeDSpec),
      save: jest.fn().mockResolvedValue({} as ThreeDSpec),
    };

    assignmentRepo = { find: jest.fn().mockResolvedValue([]) };

    addressRepo = {
      findOne: jest
        .fn()
        .mockImplementation(async ({ where }: any) =>
          makeAddress(where.id, 7.07, 125.61),
        ),
    };

    destinationRepo = {
      create: jest
        .fn()
        .mockImplementation((data) => data as DeliveryDestination),
      save: jest.fn().mockImplementation(async (d) => ({ id: 200, ...d })),
    };

    slotsService = {
      bookSlot: jest.fn().mockResolvedValue({ id: 99 }),
      getAvailability: jest.fn().mockResolvedValue([
        {
          templateId: 1,
          startTime: '00:00:00',
          endTime: '23:59:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
      ]),
    };

    settingsService = {
      isInsideServiceArea: jest.fn().mockResolvedValue(true),
      getSettings: jest.fn().mockResolvedValue({
        priorityFeeAmount: 50,
        extraDestinationSurcharge: 30,
      }),
    };

    slotsGateway = {
      notifySlotUpdated: jest.fn(),
    };

    dataSource = {
      transaction: jest.fn(async (cb) =>
        cb({
          query: jest
            .fn()
            .mockResolvedValue([
              { max_batch_ref: 10000, max_order_ref: 10000 },
            ]),
          getRepository: (entity: { name?: string }) => {
            if (entity?.name === 'Order') return ordersRepo;
            if (entity?.name === 'OrderItem') return orderItemsRepo;
            if (entity?.name === 'OrderItemSpecValue')
              return {
                create: jest.fn((data) => data),
                save: jest.fn(async (data) => data),
              };
            if (entity?.name === 'PaperSpec') return paperSpecsRepo;
            if (entity?.name === 'ThreeDSpec') return threeDSpecsRepo;
            if (entity?.name === 'BatchOrder') return batchRepo;
            if (entity?.name === 'DeliveryDestination') return destinationRepo;
            if (entity?.name === BetaModeSettings.name) {
              return {
                findOne: jest
                  .fn()
                  .mockResolvedValue({ id: 1, isEnabled: false }),
              };
            }
            throw new Error(`Unexpected repo: ${entity?.name}`);
          },
        }),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemsRepo },
        specValueRepoProvider(),
        dispatchPlanRepoProvider(),
        { provide: getRepositoryToken(BatchOrder), useValue: batchRepo },
        { provide: getRepositoryToken(PaperSpec), useValue: paperSpecsRepo },
        { provide: getRepositoryToken(ThreeDSpec), useValue: threeDSpecsRepo },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        { provide: getRepositoryToken(Address), useValue: addressRepo },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: destinationRepo,
        },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn(), isAvailable: false },
        },
        {
          provide: UsersService,
          useValue: {
            getFcmToken: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CreditsService,
          useValue: {
            subtractCredits: jest.fn().mockResolvedValue(undefined),
            refundCredits: jest.fn(),
          },
        },
        {
          provide: PaymentsService,
          useValue: {
            assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
            ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createForAllAdmins: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TamSurveysService,
          useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: DeliverySlotsService, useValue: slotsService },
        { provide: DeliverySettingsService, useValue: settingsService },
        { provide: DeliverySlotsGateway, useValue: slotsGateway },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: {
            findOne: jest.fn().mockImplementation(async ({ where }: any) => ({
              id: where.id,
              uploadedBy: 1,
              url: `https://files/${where.id}`,
              originalName: `file-${where.id}`,
              model3dWidthMm: null,
            })),
            findOneOrFail: jest.fn(),
          },
        },
        {
          provide: PrinterProfileService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              buildVolumeWidthMm: 999,
              buildVolumeDepthMm: 999,
              buildVolumeHeightMm: 999,
              maxFileSizeMb: 999,
            }),
          },
        },
        catalogPricingProvider(),
        {
          provide: AuditService,
          useValue: {
            recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
            append: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('marks deliveryType=external when any destination is out of radius', async () => {
    // Address 10 inside, address 11 outside
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address; // deliveryAddress validation
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea
      .mockResolvedValueOnce(true) // destination[0] inside
      .mockResolvedValueOnce(false); // destination[1] outside

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      destinations: [
        { addressId: 10, label: 'Home' },
        { addressId: 11, label: 'Office' },
      ],
      items: [
        makeItem({ destinationIndex: 0 }),
        makeItem({ destinationIndex: 1 }),
      ],
    };

    await (service as any).createBatch(1, dto);

    expect(capturedBatch.deliveryType).toBe('external');
    expect(capturedBatch.slotBookingId).toBeNull();
    expect(capturedBatch.externalDeliveryStatus).toBe('pending_admin');
    // bookSlot should NOT have been called
    expect(slotsService.bookSlot).not.toHaveBeenCalled();
  });

  it('books a slot when all destinations are inside radius', async () => {
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address;
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea.mockResolvedValue(true);
    slotsService.bookSlot.mockResolvedValue({ id: 99 } as any);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      destinations: [{ addressId: 10, label: 'Home' }],
      items: [makeItem({ destinationIndex: 0 })],
    };

    const result = await (service as any).createBatch(1, dto);

    expect(capturedBatch.deliveryType).toBe('local');
    expect(capturedBatch.slotBookingId).toBe(99);
    expect(result.assignedSlot).toEqual(
      expect.objectContaining({
        bookingId: 99,
        slotTemplateId: 1,
        date: '2026-05-01',
      }),
    );
    expect(slotsService.bookSlot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        slotTemplateId: 1,
        date: '2026-05-01',
        batchOrderId: 77,
      }),
    );
  });

  it('computes priorityFee + extraDestinationFee correctly', async () => {
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address;
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea.mockResolvedValue(true);
    settingsService.getSettings.mockResolvedValue({
      priorityFeeAmount: 50,
      extraDestinationSurcharge: 30,
    } as any);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      speedTier: DeliverySpeedTier.PRIORITY,
      destinations: [
        { addressId: 10, label: 'A' },
        { addressId: 11, label: 'B' },
        { addressId: 12, label: 'C' },
      ],
      items: [
        makeItem({ destinationIndex: 0 }),
        makeItem({ destinationIndex: 1 }),
        makeItem({ destinationIndex: 2 }),
      ],
    };

    await (service as any).createBatch(1, dto);

    expect(capturedBatch.priorityFee).toBe(50);
    expect(capturedBatch.extraDestinationFee).toBe(60); // 2 extra * 30
  });

  it('defaults to speedTier="standard" with priorityFee=0 when speedTier not set', async () => {
    addressRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where.id === 9) return { id: 9, userId: 1 } as unknown as Address;
      return makeAddress(where.id, 7.07, 125.61);
    });
    settingsService.isInsideServiceArea.mockResolvedValue(true);
    settingsService.getSettings.mockResolvedValue({
      priorityFeeAmount: 50,
      extraDestinationSurcharge: 30,
    } as any);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      destinations: [{ addressId: 10, label: 'Home' }],
      items: [makeItem({ destinationIndex: 0 })],
    };

    await (service as any).createBatch(1, dto);

    expect(capturedBatch.priorityFee).toBe(0);
    expect(capturedBatch.speedTier).toBe(DeliverySpeedTier.STANDARD);
  });

  describe('standard delivery auto-slot assignment', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('auto-books the nearest available same-day slot and returns assignedSlot', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T02:39:33Z'));
      addressRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 9) return makeAddress(9, 7.07, 125.61);
        return makeAddress(where.id, 7.07, 125.61);
      });
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      slotsService.getAvailability!.mockResolvedValue([
        {
          templateId: 1,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
        {
          templateId: 2,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
      ]);
      slotsService.bookSlot!.mockResolvedValue({ id: 99 } as any);

      const result = await (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 9,
        speedTier: DeliverySpeedTier.STANDARD,
        items: [makeItem()],
      });

      expect(capturedBatch.slotBookingId).toBe(99);
      expect(slotsService.bookSlot).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotTemplateId: 1,
          date: '2026-05-01',
          batchOrderId: 77,
          priority: false,
        }),
      );
      expect(result.assignedSlot).toEqual({
        bookingId: 99,
        slotTemplateId: 1,
        date: '2026-05-01',
        startTime: '09:30:00',
        endTime: '11:30:00',
      });
      expect(slotsGateway.notifySlotUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: 1,
          date: '2026-05-01',
        }),
      );
    });

    it('searches future PH dates when all same-day slots have ended', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T15:30:00Z'));
      addressRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 9) return makeAddress(9, 7.07, 125.61);
        return makeAddress(where.id, 7.07, 125.61);
      });
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      slotsService.getAvailability!.mockImplementation(async (date: string) =>
        date === '2026-05-01'
          ? [
              {
                templateId: 1,
                startTime: '09:30:00',
                endTime: '11:30:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
            ]
          : [
              {
                templateId: 4,
                startTime: '09:30:00',
                endTime: '11:30:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
            ],
      );
      slotsService.bookSlot!.mockResolvedValue({ id: 100 } as any);

      const result = await (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 9,
        speedTier: DeliverySpeedTier.STANDARD,
        items: [makeItem()],
      });

      expect(slotsService.getAvailability).toHaveBeenCalledWith('2026-05-01');
      expect(slotsService.getAvailability).toHaveBeenCalledWith('2026-05-02');
      expect(slotsService.bookSlot).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          slotTemplateId: 4,
          date: '2026-05-02',
        }),
      );
      expect(result.assignedSlot).toEqual(
        expect.objectContaining({
          bookingId: 100,
          slotTemplateId: 4,
          date: '2026-05-02',
        }),
      );
    });

    it('moves to the next candidate when capacity is lost during booking', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T02:39:33Z'));
      addressRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 9) return makeAddress(9, 7.07, 125.61);
        return makeAddress(where.id, 7.07, 125.61);
      });
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      slotsService.getAvailability!.mockResolvedValue([
        {
          templateId: 1,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
        {
          templateId: 2,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
      ]);
      slotsService
        .bookSlot!.mockRejectedValueOnce(new SlotFullException())
        .mockResolvedValueOnce({ id: 101 } as any);

      const result = await (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 9,
        speedTier: DeliverySpeedTier.STANDARD,
        items: [makeItem()],
      });

      expect(slotsService.bookSlot).toHaveBeenCalledTimes(2);
      expect(slotsService.bookSlot).toHaveBeenNthCalledWith(
        1,
        expect.anything(),
        expect.objectContaining({ slotTemplateId: 1 }),
      );
      expect(slotsService.bookSlot).toHaveBeenNthCalledWith(
        2,
        expect.anything(),
        expect.objectContaining({ slotTemplateId: 2 }),
      );
      expect(capturedBatch.slotBookingId).toBe(101);
      expect(result.assignedSlot).toEqual(
        expect.objectContaining({
          bookingId: 101,
          slotTemplateId: 2,
          date: '2026-05-01',
        }),
      );
    });
  });

  it('persists a temporary pinned address as a destination snapshot', async () => {
    settingsService.isInsideServiceArea.mockResolvedValue(true);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      temporaryAddress: {
        label: 'Temporary drop',
        fullAddress: 'Unit 12, Jacinto Extension, Davao City',
        city: 'Davao City',
        landmark: 'Beside the blue gate',
        latitude: 7.0731,
        longitude: 125.6128,
      },
      items: [makeItem()],
    };

    await (service as any).createBatch(1, dto);

    expect(addressRepo.findOne).not.toHaveBeenCalled();
    expect(settingsService.isInsideServiceArea).toHaveBeenCalledWith(
      7.0731,
      125.6128,
    );
    expect(capturedBatch.deliveryAddressId).toBeUndefined();
    expect(destinationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        batchOrderId: 77,
        addressId: null,
        label: 'Temporary drop',
        fullAddress: 'Unit 12, Jacinto Extension, Davao City',
        city: 'Davao City',
        landmark: 'Beside the blue gate',
        latitude: 7.0731,
        longitude: 125.6128,
        sortOrder: 0,
      }),
    );
    expect(ordersRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        deliveryAddressId: undefined,
        destinationId: 200,
      }),
    );
  });

  it('persists mixed saved and temporary multidrop destinations', async () => {
    addressRepo.findOne.mockResolvedValueOnce(makeAddress(10, 7.07, 125.61));
    let nextDestinationId = 200;
    destinationRepo.save.mockImplementation(async (d) => ({
      id: nextDestinationId++,
      ...d,
    }));
    settingsService.isInsideServiceArea.mockResolvedValue(true);

    const dto = {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      destinations: [
        { addressId: 10, label: 'Home' },
        {
          label: 'Event booth',
          address: {
            fullAddress: 'SMX Booth A12, Davao City',
            city: 'Davao City',
            landmark: 'Near loading bay',
            latitude: 7.0731,
            longitude: 125.6128,
          },
        },
      ],
      items: [
        makeItem({ destinationIndex: 0 }),
        makeItem({ destinationIndex: 1 }),
      ],
    };

    await (service as any).createBatch(1, dto);

    expect(addressRepo.findOne).toHaveBeenCalledWith({
      where: { id: 10, userId: 1 },
    });
    expect(settingsService.isInsideServiceArea).toHaveBeenNthCalledWith(
      1,
      7.07,
      125.61,
    );
    expect(settingsService.isInsideServiceArea).toHaveBeenNthCalledWith(
      2,
      7.0731,
      125.6128,
    );
    expect(destinationRepo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        batchOrderId: 77,
        addressId: 10,
        label: 'Home',
        fullAddress: '10 Saved Address',
        city: 'Davao City',
        latitude: 7.07,
        longitude: 125.61,
        sortOrder: 0,
      }),
    );
    expect(destinationRepo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        batchOrderId: 77,
        addressId: null,
        label: 'Event booth',
        fullAddress: 'SMX Booth A12, Davao City',
        city: 'Davao City',
        landmark: 'Near loading bay',
        latitude: 7.0731,
        longitude: 125.6128,
        sortOrder: 1,
      }),
    );
    expect(orderItemsRepo.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        destinationId: 200,
      }),
    );
    expect(orderItemsRepo.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        destinationId: 201,
      }),
    );
    expect(capturedBatch.extraDestinationFee).toBe(30);
  });

  it('rejects a destination with both saved and temporary address data', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        slotTemplateId: 1,
        slotDate: '2026-05-01',
        destinations: [
          {
            addressId: 10,
            address: {
              fullAddress: 'SMX Booth A12, Davao City',
              city: 'Davao City',
              latitude: 7.0731,
              longitude: 125.6128,
            },
          },
        ],
        items: [makeItem({ destinationIndex: 0 })],
      }),
    ).rejects.toThrow(
      'Choose either a saved address or a temporary address for each destination',
    );
  });

  it('rejects item destinationIndex values outside the destination list', async () => {
    addressRepo.findOne.mockResolvedValueOnce(makeAddress(10, 7.07, 125.61));

    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        slotTemplateId: 1,
        slotDate: '2026-05-01',
        destinations: [{ addressId: 10, label: 'Home' }],
        items: [makeItem({ destinationIndex: 1 })],
      }),
    ).rejects.toThrow('Invalid destination index');
  });

  it('classifies a saved single delivery address with service-area checks', async () => {
    addressRepo.findOne.mockResolvedValueOnce(makeAddress(9, 7.0731, 125.6128));
    settingsService.isInsideServiceArea.mockResolvedValueOnce(false);

    await (service as any).createBatch(1, {
      paymentMethod: 'gcash',
      deliveryOption: 'delivery',
      deliveryAddressId: 9,
      slotTemplateId: 1,
      slotDate: '2026-05-01',
      items: [makeItem()],
    });

    expect(settingsService.isInsideServiceArea).toHaveBeenCalledWith(
      7.0731,
      125.6128,
    );
    expect(capturedBatch.deliveryType).toBe('external');
    expect(slotsService.bookSlot).not.toHaveBeenCalled();
    expect(destinationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        batchOrderId: 77,
        addressId: 9,
        sortOrder: 0,
      }),
    );
  });

  it('rejects delivery checkout without saved or temporary address', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        slotTemplateId: 1,
        slotDate: '2026-05-01',
        items: [makeItem()],
      }),
    ).rejects.toThrow('Delivery address is required');
  });

  it('rejects delivery checkout with both saved and temporary addresses', async () => {
    addressRepo.findOne.mockResolvedValueOnce(makeAddress(9, 7.0731, 125.6128));

    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 9,
        temporaryAddress: {
          fullAddress: 'Unit 12, Jacinto Extension, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        },
        slotTemplateId: 1,
        slotDate: '2026-05-01',
        items: [makeItem()],
      }),
    ).rejects.toThrow('Choose either a saved address or a temporary address');
  });

  it('rejects top-level temporary address together with destinations', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        temporaryAddress: {
          fullAddress: 'Unit 12, Jacinto Extension, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        },
        destinations: [{ addressId: 10, label: 'Home' }],
        items: [makeItem({ destinationIndex: 0 })],
      }),
    ).rejects.toThrow(
      'Choose either a temporary address or delivery destinations',
    );
  });

  it('rejects empty destination entries', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        slotTemplateId: 1,
        slotDate: '2026-05-01',
        destinations: [{}],
        items: [makeItem({ destinationIndex: 0 })],
      }),
    ).rejects.toThrow('Invalid delivery address');
  });

  it('rejects saved destination addresses not owned by the user', async () => {
    addressRepo.findOne.mockResolvedValueOnce(null);

    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        slotTemplateId: 1,
        slotDate: '2026-05-01',
        destinations: [{ addressId: 10, label: 'Home' }],
        items: [makeItem({ destinationIndex: 0 })],
      }),
    ).rejects.toThrow('Invalid delivery address');
  });

  it('rejects temporary addresses for pickup checkout', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'pickup',
        temporaryAddress: {
          fullAddress: 'Unit 12, Jacinto Extension, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        },
        items: [makeItem()],
      }),
    ).rejects.toThrow('Delivery destinations are only allowed for delivery');
  });

  it('rejects destinations for pickup checkout', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'pickup',
        destinations: [{ addressId: 10, label: 'Home' }],
        items: [makeItem({ destinationIndex: 0 })],
      }),
    ).rejects.toThrow('Delivery destinations are only allowed for delivery');
  });

  it('rejects invalid temporary address coordinates at service level', async () => {
    await expect(
      (service as any).createBatch(1, {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        temporaryAddress: {
          fullAddress: 'Unit 12, Jacinto Extension, Davao City',
          city: 'Davao City',
          latitude: 0,
          longitude: 0,
        },
        items: [makeItem()],
      }),
    ).rejects.toThrow('Invalid temporary address');
  });

  describe('Standard same-day bookable check (no slotTemplateId)', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    it('accepts a future-today slot at 10:39 AM PH (UTC 02:39) — only seeded slots are 09:30, 14:00, 21:00 PH', async () => {
      // Reproduces bug: customer placing Standard delivery at PH morning,
      // server is in UTC, slot times are stored as PH wall-clock. The previous
      // "live RIGHT NOW" check rejected all today's slots because at 02:39 UTC
      // every slot's start (in server-local UTC) was still in the future.
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T02:39:33Z'));

      addressRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 1) return makeAddress(1, 7.07, 125.61);
        return makeAddress(where.id, 7.07, 125.61);
      });
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      // Seeded slots (PH wall-clock): 09:30-11:30, 14:00-16:00, 21:00-23:00
      slotsService.getAvailability!.mockResolvedValue([
        {
          templateId: 1,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
        {
          templateId: 2,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
        {
          templateId: 3,
          startTime: '21:00:00',
          endTime: '23:00:00',
          capacity: 10,
          bookedCount: 0,
          isFull: false,
        },
      ]);

      const dto = {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 1,
        deliveryFee: 0,
        speedTier: DeliverySpeedTier.STANDARD,
        items: [
          makeItem({
            category: 'paper',
            quantity: 1,
            totalPrice: 2,
            fileName: 'TalaSora.png',
          }),
        ],
      };

      // Expect the order to be accepted (capturedBatch populated, no throw).
      await expect((service as any).createBatch(1, dto)).resolves.toBeDefined();
      expect(capturedBatch).not.toBeNull();
      expect(capturedBatch.speedTier).toBe(DeliverySpeedTier.STANDARD);
    });

    it('rejects with no_slot_available_today when every slot today is full', async () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T02:39:33Z'));

      addressRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 1) return makeAddress(1, 7.07, 125.61);
        return makeAddress(where.id, 7.07, 125.61);
      });
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      slotsService.getAvailability!.mockResolvedValue([
        {
          templateId: 1,
          startTime: '09:30:00',
          endTime: '11:30:00',
          capacity: 10,
          bookedCount: 10,
          isFull: true,
        },
        {
          templateId: 2,
          startTime: '14:00:00',
          endTime: '16:00:00',
          capacity: 10,
          bookedCount: 10,
          isFull: true,
        },
        {
          templateId: 3,
          startTime: '21:00:00',
          endTime: '23:00:00',
          capacity: 10,
          bookedCount: 10,
          isFull: true,
        },
      ]);

      const dto = {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 1,
        deliveryFee: 0,
        speedTier: DeliverySpeedTier.STANDARD,
        items: [
          makeItem({
            category: 'paper',
            quantity: 1,
            totalPrice: 2,
            fileName: 'a.pdf',
          }),
        ],
      };

      await expect((service as any).createBatch(1, dto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'no_slot_available_today' }),
      });
    });

    it('books the next future slot when every slot today has already ended (PH late evening)', async () => {
      // PH 23:30 = UTC 15:30. All seeded slots (latest ends 23:00 PH) are past.
      jest.useFakeTimers().setSystemTime(new Date('2026-05-01T15:30:00Z'));

      addressRepo.findOne.mockImplementation(async ({ where }: any) => {
        if (where.id === 1) return makeAddress(1, 7.07, 125.61);
        return makeAddress(where.id, 7.07, 125.61);
      });
      settingsService.isInsideServiceArea.mockResolvedValue(true);
      slotsService.getAvailability!.mockImplementation(async (date: string) =>
        date === '2026-05-01'
          ? [
              {
                templateId: 1,
                startTime: '09:30:00',
                endTime: '11:30:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
              {
                templateId: 2,
                startTime: '14:00:00',
                endTime: '16:00:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
              {
                templateId: 3,
                startTime: '21:00:00',
                endTime: '23:00:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
            ]
          : [
              {
                templateId: 1,
                startTime: '09:30:00',
                endTime: '11:30:00',
                capacity: 10,
                bookedCount: 0,
                isFull: false,
              },
            ],
      );

      const dto = {
        paymentMethod: 'gcash',
        deliveryOption: 'delivery',
        deliveryAddressId: 1,
        deliveryFee: 0,
        speedTier: DeliverySpeedTier.STANDARD,
        items: [
          makeItem({
            category: 'paper',
            quantity: 1,
            totalPrice: 2,
            fileName: 'a.pdf',
          }),
        ],
      };

      await expect((service as any).createBatch(1, dto)).resolves.toEqual(
        expect.objectContaining({
          assignedSlot: expect.objectContaining({
            slotTemplateId: 1,
            date: '2026-05-02',
          }),
        }),
      );
    });
  });
});

describe('cancelBatch', () => {
  let service: OrdersService;

  let ordersRepo: jest.Mocked<
    Pick<Repository<Order>, 'find' | 'findOneOrFail' | 'save' | 'update'>
  >;
  let batchOrdersRepo: jest.Mocked<
    Pick<Repository<any>, 'findOne' | 'findOneOrFail' | 'save'>
  >;
  let slotsService: jest.Mocked<Pick<DeliverySlotsService, 'releaseSlot'>>;
  let dataSource: Partial<DataSource>;

  beforeEach(async () => {
    jest.clearAllMocks();

    batchOrdersRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(async (batch) => batch),
    };
    ordersRepo = {
      find: jest.fn(),
      findOneOrFail: jest.fn(),
      save: jest.fn(async (order: Order) => order),
      update: jest.fn(),
    };

    slotsService = {
      releaseSlot: jest.fn(),
    };

    // Default transaction mock routes repositories through one transaction manager.
    const makeMockManager = () => ({
      getRepository: (entity: unknown) => {
        if (entity === BatchOrder) return batchOrdersRepo;
        if (entity === OrderStatusHistory) return { insert: jest.fn() };
        return ordersRepo;
      },
    });

    dataSource = {
      transaction: jest.fn(async (cb) => cb(makeMockManager())),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: ordersRepo,
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        specValueRepoProvider(),
        dispatchPlanRepoProvider(),
        { provide: getRepositoryToken(BatchOrder), useValue: batchOrdersRepo },
        {
          provide: getRepositoryToken(PaperSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ThreeDSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOne: jest.fn(), findOneOrFail: jest.fn() },
        },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn(), isAvailable: false },
        },
        {
          provide: UsersService,
          useValue: {
            getFcmToken: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CreditsService,
          useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: {
            assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
            ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            create: jest.fn().mockResolvedValue(undefined),
            createForAllAdmins: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TamSurveysService,
          useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: dataSource },
        { provide: DeliverySlotsService, useValue: slotsService },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              buildVolumeWidthMm: 999,
              buildVolumeDepthMm: 999,
              buildVolumeHeightMm: 999,
              maxFileSizeMb: 999,
            }),
          },
        },
        catalogPricingProvider(),
        {
          provide: AuditService,
          useValue: {
            recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
            append: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('releases slot and marks orders cancelled when before cutoff', async () => {
    const fakeBatch = {
      id: 1,
      batchRef: 'BATCH-10001',
      userId: 1,
      slotBookingId: 7,
      paymentMethod: 'gcash',
    };
    ordersRepo.find.mockResolvedValue([
      {
        id: 11,
        userId: 1,
        batchOrderId: 1,
        orderStatus: OrderStatus.SUBMITTED,
      } as Order,
    ]);
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 11,
      userId: 1,
      orderStatus: OrderStatus.SUBMITTED,
    } as Order);
    batchOrdersRepo.findOneOrFail.mockResolvedValue(fakeBatch as any);
    batchOrdersRepo.findOne.mockResolvedValue(fakeBatch as any);
    slotsService.releaseSlot.mockResolvedValue(undefined);

    await service.cancelBatch(1, 1);

    expect(slotsService.releaseSlot).toHaveBeenCalledWith(expect.anything(), 7);
  });

  it('rejects cancellation past cutoff', async () => {
    const fakeBatch = {
      id: 1,
      batchRef: 'BATCH-10001',
      userId: 1,
      slotBookingId: 7,
      paymentMethod: 'gcash',
    };
    ordersRepo.find.mockResolvedValue([
      {
        id: 11,
        userId: 1,
        batchOrderId: 1,
        orderStatus: OrderStatus.SUBMITTED,
      } as Order,
    ]);
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 11,
      userId: 1,
      orderStatus: OrderStatus.SUBMITTED,
    } as Order);
    batchOrdersRepo.findOneOrFail.mockResolvedValue(fakeBatch as any);
    batchOrdersRepo.findOne.mockResolvedValue(fakeBatch as any);
    slotsService.releaseSlot.mockRejectedValue(
      new CancellationClosedException(),
    );

    await expect(service.cancelBatch(1, 1)).rejects.toThrow(
      'cancellation closed',
    );
  });
});

describe('updateManualStatus', () => {
  let service: OrdersService;
  let ordersRepo: jest.Mocked<
    Pick<Repository<Order>, 'findOneOrFail' | 'save'>
  >;
  let notificationsService: jest.Mocked<
    Pick<NotificationsService, 'create' | 'createForAllAdmins'>
  >;

  beforeEach(async () => {
    jest.clearAllMocks();

    ordersRepo = {
      findOneOrFail: jest.fn(),
      save: jest.fn(),
    };

    notificationsService = {
      create: jest.fn().mockResolvedValue({}),
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: ordersRepo.findOneOrFail,
            create: jest.fn(),
            save: ordersRepo.save,
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        specValueRepoProvider(),
        dispatchPlanRepoProvider(),
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        {
          provide: getRepositoryToken(PaperSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ThreeDSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOne: jest.fn(), findOneOrFail: jest.fn() },
        },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn(), isAvailable: false },
        },
        {
          provide: UsersService,
          useValue: {
            getFcmToken: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CreditsService,
          useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: {
            assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
            ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        { provide: NotificationsService, useValue: notificationsService },
        {
          provide: TamSurveysService,
          useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: DeliverySlotsService,
          useValue: {
            bookSlot: jest.fn(),
            releaseSlot: jest.fn(),
            getAvailability: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              buildVolumeWidthMm: 999,
              buildVolumeDepthMm: 999,
              buildVolumeHeightMm: 999,
              maxFileSizeMb: 999,
            }),
          },
        },
        catalogPricingProvider(),
        {
          provide: AuditService,
          useValue: {
            recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
            append: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('fires notification on first set', async () => {
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 5,
      userId: 7,
      adminStatusNote: null,
      adminStatusSetAt: null,
    } as Order);
    ordersRepo.save.mockImplementation(async (o) => o as Order);

    await service.updateManualStatus(5, {
      note: 'Reprinting',
      estimatedCompletionAt: '2026-05-01T08:00:00Z',
    });

    expect(notificationsService.create).toHaveBeenCalled();
  });

  it('does NOT fire notification on subsequent edit', async () => {
    ordersRepo.findOneOrFail.mockResolvedValue({
      id: 5,
      userId: 7,
      adminStatusNote: 'Old',
      adminStatusSetAt: new Date(),
    } as Order);
    ordersRepo.save.mockImplementation(async (o) => o as Order);
    notificationsService.create.mockClear();

    await service.updateManualStatus(5, {
      note: 'Newer',
      estimatedCompletionAt: null,
    });

    expect(notificationsService.create).not.toHaveBeenCalled();
  });
});

describe('createBatch — 3D bounds enforcement', () => {
  let service: OrdersService;
  let printerProfileService: jest.Mocked<
    Pick<PrinterProfileService, 'getProfile'>
  >;
  let fileMetadataRepo: jest.Mocked<
    Pick<Repository<FileMetadata>, 'findOne' | 'findOneOrFail'>
  >;

  beforeEach(async () => {
    jest.clearAllMocks();

    printerProfileService = {
      getProfile: jest.fn(),
    };

    fileMetadataRepo = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        specValueRepoProvider(),
        dispatchPlanRepoProvider(),
        { provide: getRepositoryToken(BatchOrder), useValue: {} },
        {
          provide: getRepositoryToken(PaperSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ThreeDSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: 9, userId: 99 }),
          },
        },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: fileMetadataRepo,
        },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn(), isAvailable: false },
        },
        {
          provide: UsersService,
          useValue: {
            getFcmToken: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CreditsService,
          useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: {
            assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
            ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createForAllAdmins: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TamSurveysService,
          useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: DeliverySlotsService,
          useValue: {
            bookSlot: jest.fn(),
            releaseSlot: jest.fn(),
            getAvailability: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        { provide: PrinterProfileService, useValue: printerProfileService },
        catalogPricingProvider(),
        {
          provide: AuditService,
          useValue: {
            recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
            append: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  it('rejects when any 3D item exceeds the printer profile', async () => {
    printerProfileService.getProfile.mockResolvedValue({
      buildVolumeWidthMm: 180,
      buildVolumeDepthMm: 180,
      buildVolumeHeightMm: 180,
      name: 'X',
      maxFileSizeMb: 200,
    } as any);
    fileMetadataRepo.findOne.mockResolvedValue({
      id: 1,
      uploadedBy: 99,
      url: 'https://files/model.stl',
      originalName: 'model.stl',
      model3dWidthMm: '200',
      model3dDepthMm: '50',
      model3dHeightMm: '50',
    } as any);

    await expect(
      service.createBatch(99, {
        items: [
          {
            category: '3d',
            fileMetadataId: 1,
            quantity: 1,
            threeDSpecs: {} as any,
          },
        ],
        paymentMethod: 'cash',
        temporaryAddress: {
          fullAddress: 'Unit 12, Jacinto Extension, Davao City',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        },
        deliveryOption: 'delivery',
      } as any),
    ).rejects.toThrow(/build volume/);
  });
});

describe('listExternalDeliveries and updateExternalDeliveryStatus', () => {
  let service: OrdersService;
  let batchOrdersRepo: jest.Mocked<Pick<Repository<any>, 'find' | 'update'>>;

  beforeEach(async () => {
    jest.clearAllMocks();

    batchOrdersRepo = {
      find: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: getRepositoryToken(Order),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            findOneOrFail: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        specValueRepoProvider(),
        dispatchPlanRepoProvider(),
        { provide: getRepositoryToken(BatchOrder), useValue: batchOrdersRepo },
        {
          provide: getRepositoryToken(PaperSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(ThreeDSpec),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: { find: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Address),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(DeliveryDestination),
          useValue: { create: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: { findOne: jest.fn(), findOneOrFail: jest.fn() },
        },
        { provide: OrdersGateway, useValue: { notifyOrderUpdate: jest.fn() } },
        {
          provide: FirebaseService,
          useValue: { sendToDevice: jest.fn(), isAvailable: false },
        },
        {
          provide: UsersService,
          useValue: {
            getFcmToken: jest.fn().mockResolvedValue(null),
            findById: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: CreditsService,
          useValue: { subtractCredits: jest.fn(), refundCredits: jest.fn() },
        },
        {
          provide: PaymentsService,
          useValue: {
            assertCodEligibleForCheckout: jest.fn().mockResolvedValue(null),
            ensurePendingCodCollection: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            createForAllAdmins: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TamSurveysService,
          useValue: { createPostDeliveryRequirementIfNeeded: jest.fn() },
        },
        { provide: FilesService, useValue: { stampExpiry: jest.fn() } },
        { provide: DataSource, useValue: { transaction: jest.fn() } },
        {
          provide: DeliverySlotsService,
          useValue: { bookSlot: jest.fn(), releaseSlot: jest.fn() },
        },
        {
          provide: DeliverySettingsService,
          useValue: {
            isInsideServiceArea: jest.fn().mockResolvedValue(true),
            getSettings: jest.fn().mockResolvedValue({
              priorityFeeAmount: 50,
              extraDestinationSurcharge: 30,
            }),
          },
        },
        {
          provide: DeliverySlotsGateway,
          useValue: { notifySlotUpdated: jest.fn() },
        },
        {
          provide: PrinterProfileService,
          useValue: {
            getProfile: jest.fn().mockResolvedValue({
              buildVolumeWidthMm: 999,
              buildVolumeDepthMm: 999,
              buildVolumeHeightMm: 999,
              maxFileSizeMb: 999,
            }),
          },
        },
        catalogPricingProvider(),
        {
          provide: AuditService,
          useValue: {
            recordOrderStatusTransition: jest.fn().mockResolvedValue({ id: 1 }),
            append: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
      ],
    }).compile();

    service = module.get(OrdersService);
  });

  describe('listExternalDeliveries', () => {
    it('filters by externalDeliveryStatus', async () => {
      batchOrdersRepo.find.mockResolvedValue([
        { id: 1, deliveryType: 'external' },
      ]);
      const out = await service.listExternalDeliveries('pending_admin');
      expect(batchOrdersRepo.find).toHaveBeenCalledWith({
        where: {
          deliveryType: 'external',
          externalDeliveryStatus: 'pending_admin',
        },
        order: { createdAt: 'DESC' },
        relations: ['user'],
      });
      expect(out).toEqual([{ id: 1, deliveryType: 'external' }]);
    });

    it('omits status filter when no status passed', async () => {
      batchOrdersRepo.find.mockResolvedValue([]);
      await service.listExternalDeliveries(undefined);
      expect(batchOrdersRepo.find).toHaveBeenCalledWith({
        where: { deliveryType: 'external' },
        order: { createdAt: 'DESC' },
        relations: ['user'],
      });
    });
  });

  describe('updateExternalDeliveryStatus', () => {
    it('updates the status', async () => {
      batchOrdersRepo.update.mockResolvedValue({ affected: 1 } as any);
      await service.updateExternalDeliveryStatus(1, 'booked');
      expect(batchOrdersRepo.update).toHaveBeenCalledWith(1, {
        externalDeliveryStatus: 'booked',
      });
    });
  });
});

describe('OrdersService.submitRfq', () => {
  const makeProduct = (
    id: number,
    slug: string,
    specKey: string,
    overrides: Partial<ProductCategory> = {},
  ) =>
    ({
      id,
      slug,
      name: slug === 'flyers' ? 'Flyers' : 'Custom Apparel',
      description: 'RFQ leaf',
      groupSlug: slug === 'flyers' ? 'marketing-promo' : 'corporate-merch',
      groupName: slug === 'flyers' ? 'Marketing' : 'Merchandise',
      groupDescription: 'Orderable RFQ products',
      groupSortOrder: slug === 'flyers' ? 1 : 2,
      pricingModel: PricingModel.QUOTE_REQUIRED,
      baseRate: 0,
      isActive: true,
      fileProcessingType: 'generic_file',
      maxFileSizeMb: 100,
      allowedExtensions: ['pdf'],
      quantityUnit: 'piece',
      sortOrder: 1,
      specs: [
        {
          id: id * 10,
          key: specKey,
          label: `Required ${specKey}`,
          inputType: InputType.TEXT,
          valueType: ValueType.STRING,
          isRequired: true,
          isActive: true,
          pricingRole: PricingRole.NONE,
          defaultValue: null,
          minValue: null,
          maxValue: null,
          stepValue: null,
          sortOrder: 1,
          options: [],
        },
      ],
      addons: [],
      ...overrides,
    }) as ProductCategory;

  const flyers = makeProduct(11, 'flyers', 'size');
  const apparel = makeProduct(12, 'custom-apparel', 'variant');
  const firstItem = () => ({
    categorySlug: 'flyers',
    quantity: 100,
    requiredDate: '2099-12-31',
    fileMetadataId: 41,
    specs: { size: 'A5' },
    specialInstructions: 'Keep crop marks.',
  });
  const request = (items = [firstItem()]) => ({
    items,
    deliveryOption: 'pickup' as const,
  });

  const buildHarness = (
    products = [flyers, apparel],
    catalogProducts = products,
  ) => {
    const durable = {
      batches: [] as BatchOrder[],
      orders: [] as Order[],
      items: [] as OrderItem[],
      specs: [] as OrderItemSpecValue[],
      destinations: [] as DeliveryDestination[],
    };
    const credits = {
      subtractCredits: jest.fn(),
      publishCreditMutation: jest.fn(),
    };
    const payments = {
      assertCodEligibleForCheckout: jest.fn(),
      ensurePendingCodCollection: jest.fn(),
    };
    const slots = { bookSlot: jest.fn(), getAvailability: jest.fn() };
    const notifications = { create: jest.fn(), createForAllAdmins: jest.fn() };
    const files = {
      resolveCatalogArtwork: jest.fn(
        async (fileId: number, selected: ProductCategory) =>
          ({
            id: fileId,
            url: `https://files/${fileId}.pdf`,
            originalName: `${selected.slug}-${fileId}.pdf`,
          }) as FileMetadata,
      ),
    };
    const savedAddresses = new Map<number, Address>([
      [
        9,
        {
          id: 9,
          userId: 1,
          label: 'Home',
          fullAddress: '9 Main Street',
          city: 'Davao City',
          latitude: 7.0731,
          longitude: 125.6128,
        } as Address,
      ],
    ]);
    const addressRepo = {
      findOne: jest.fn(async ({ where }: any) => {
        const found = savedAddresses.get(Number(where.id));
        return found?.userId === Number(where.userId) ? found : null;
      }),
    };
    const settings = { isInsideServiceArea: jest.fn().mockResolvedValue(true) };
    const geoZones = {
      hasActiveZones: jest.fn().mockResolvedValue(true),
      getCommerceSettings: jest
        .fn()
        .mockResolvedValue({ rejectOutsideZones: true }),
      matchPoint: jest.fn().mockResolvedValue({
        inside: true,
        zone: { id: 5 },
        deliveryFeeMinor: '4000',
      }),
    };
    const pricing = new CatalogPricingService(
      {
        getPublicCatalog: jest.fn().mockResolvedValue({
          version: '1.10',
          groups: [],
          categories: catalogProducts.filter((entry) => entry.isActive),
        }),
      } as any,
      new CatalogValidationService(),
    );
    const dataSource = {
      transaction: jest.fn(async (callback: (manager: any) => Promise<any>) => {
        const staged = {
          batches: [] as BatchOrder[],
          orders: [] as Order[],
          items: [] as OrderItem[],
          specs: [] as OrderItemSpecValue[],
          destinations: [] as DeliveryDestination[],
        };
        const repo = <T extends { id?: number }>(
          target: T[],
          idBase: number,
        ) => ({
          create: jest.fn((data: T) => data),
          save: jest.fn(async (data: T) => {
            const saved = { id: idBase + target.length, ...data } as T;
            target.push(saved);
            return saved;
          }),
        });
        const repositories: Record<string, any> = {
          BatchOrder: repo(staged.batches, 77),
          Order: repo(staged.orders, 101),
          OrderItem: repo(staged.items, 201),
          OrderItemSpecValue: repo(staged.specs, 301),
          DeliveryDestination: repo(staged.destinations, 401),
          ProductCategory: {
            findBy: jest.fn(async () => products),
          },
          ProductSpecDefinition: {
            findBy: jest.fn(async () =>
              products.flatMap((entry) =>
                entry.specs.map((spec) => ({
                  ...spec,
                  categoryId: entry.id,
                })),
              ),
            ),
          },
          ProductSpecOption: {
            findBy: jest.fn(async () =>
              products.flatMap((entry) =>
                entry.specs.flatMap((spec) =>
                  spec.options.map((option) => ({
                    ...option,
                    specDefinitionId: spec.id,
                  })),
                ),
              ),
            ),
          },
          FileMetadata: {},
        };
        const result = await callback({
          query: jest.fn(async (sql: string, parameters?: unknown[]) => {
            if (sql.includes('FROM product_categories')) {
              const slugs = parameters?.[0] as string[];
              return products
                .filter((entry) => slugs.includes(entry.slug))
                .sort((a, b) => a.slug.localeCompare(b.slug))
                .map(({ id, slug }) => ({ id, slug }));
            }
            if (sql.includes('FROM product_spec_definitions')) {
              return products.flatMap((entry) =>
                entry.specs.map((spec) => ({
                  id: spec.id,
                  category_id: entry.id,
                })),
              );
            }
            if (sql.includes('FROM product_spec_options')) {
              return products.flatMap((entry) =>
                entry.specs.flatMap((spec) =>
                  spec.options.map((option) => ({
                    id: option.id,
                    spec_definition_id: spec.id,
                  })),
                ),
              );
            }
            if (sql.includes('pg_advisory_xact_lock')) return [];
            return [{ max_batch_ref: 10020, max_order_ref: 10030 }];
          }),
          getRepository: (entity: { name: string }) =>
            repositories[entity.name],
        });
        durable.batches.push(...staged.batches);
        durable.orders.push(...staged.orders);
        durable.items.push(...staged.items);
        durable.specs.push(...staged.specs);
        durable.destinations.push(...staged.destinations);
        return result;
      }),
    };
    const service = Object.create(OrdersService.prototype) as OrdersService;
    Object.assign(service as any, {
      dataSource,
      catalogPricingService: pricing,
      filesService: files,
      addressRepo,
      settingsService: settings,
      geoZonesService: geoZones,
      creditsService: credits,
      paymentsService: payments,
      slotsService: slots,
      notificationsService: notifications,
    });
    return {
      service,
      dataSource,
      durable,
      files,
      credits,
      payments,
      slots,
      notifications,
      settings,
      geoZones,
    };
  };

  it('creates one pending, nullable-money order with one exact item/spec snapshot', async () => {
    const harness = buildHarness();

    const result = await harness.service.submitRfq(1, request());

    expect(result.batchId).toBe('BATCH-10021');
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0]).toMatchObject({
      orderId: 'ORD-10031',
      category: 'flyers',
      batchOrderId: 77,
      pricingStatus: PricingStatus.PENDING_QUOTE,
      totalPrice: null,
      deliveryFee: null,
      finalTotalMinor: null,
      quotedTotalMinor: null,
      paymentMethod: 'unselected',
      paymentStatus: 'pending',
    });
    expect(result.orders[0].items).toEqual([
      expect.objectContaining({
        orderId: 101,
        categorySlug: 'flyers',
        totalPrice: null,
        requiredAt: new Date('2099-12-30T16:00:00.000Z'),
      }),
    ]);
    expect(result.orders[0].items[0].specValues[0]).not.toHaveProperty(
      'fixedFee',
    );
    expect(result.orders[0].items[0].specValues[0]).not.toHaveProperty(
      'unitCost',
    );
    expect(harness.durable.orders[0]).toMatchObject({
      totalPrice: 0,
      deliveryFee: 0,
      finalTotalMinor: null,
      deliveryFeeMinor: null,
    });
    expect(harness.durable.specs).toEqual([
      expect.objectContaining({
        orderItemId: 201,
        specDefinitionId: 110,
        specKey: 'size',
        value: 'A5',
        displayValue: 'A5',
      }),
    ]);
    expect(harness.durable.specs[0]).not.toHaveProperty('fixedFee');
    expect(harness.files.resolveCatalogArtwork).toHaveBeenCalledWith(
      41,
      flyers,
      1,
      expect.anything(),
    );
  });

  it('creates unlike lines as independent orders in one shared batch with contiguous refs', async () => {
    const harness = buildHarness();
    const result = await harness.service.submitRfq(
      1,
      request([
        firstItem(),
        {
          categorySlug: 'custom-apparel',
          quantity: 12,
          requiredDate: '2099-12-30',
          fileMetadataId: 42,
          specs: { variant: 'Large shirt' },
        },
      ]),
    );

    expect(result.orders.map((order) => order.orderId)).toEqual([
      'ORD-10031',
      'ORD-10032',
    ]);
    expect(result.orders.map((order) => order.category)).toEqual([
      'flyers',
      'custom-apparel',
    ]);
    expect(new Set(result.orders.map((order) => order.batchOrderId))).toEqual(
      new Set([77]),
    );
    expect(harness.durable.items.map((item) => item.orderId)).toEqual([
      101, 102,
    ]);
  });

  it('stores one authoritative shared delivery fee on the batch and maps each destination', async () => {
    const harness = buildHarness();
    const result = await harness.service.submitRfq(1, {
      ...request([
        { ...firstItem(), destinationIndex: 0 },
        {
          ...firstItem(),
          quantity: 200,
          fileMetadataId: 41,
          destinationIndex: 1,
        },
      ]),
      deliveryOption: 'delivery' as const,
      destinations: [
        { addressId: 9, label: 'Home drop' },
        {
          label: 'Event booth',
          address: {
            fullAddress: 'SMX Booth A12',
            city: 'Davao City',
            latitude: 7.09,
            longitude: 125.63,
          },
        },
      ],
    });

    expect(harness.durable.batches[0]).toMatchObject({
      subtotal: 0,
      deliveryFee: 42,
      totalPrice: 0,
      priorityFee: 0,
      extraDestinationFee: 0,
      slotBookingId: null,
    });
    expect(harness.durable.orders.map((order) => order.deliveryFee)).toEqual([
      0, 0,
    ]);
    expect(harness.durable.items.map((item) => item.destinationId)).toEqual([
      401, 402,
    ]);
    expect(result.orders.map((order) => order.destinationId)).toEqual([
      401, 402,
    ]);
  });

  it('does not invoke payment, credit, COD, slot, or production notification side effects', async () => {
    const harness = buildHarness();

    await harness.service.submitRfq(1, request());

    expect(harness.credits.subtractCredits).not.toHaveBeenCalled();
    expect(
      harness.payments.assertCodEligibleForCheckout,
    ).not.toHaveBeenCalled();
    expect(harness.payments.ensurePendingCodCollection).not.toHaveBeenCalled();
    expect(harness.slots.bookSlot).not.toHaveBeenCalled();
    expect(harness.slots.getAvailability).not.toHaveBeenCalled();
    expect(harness.notifications.create).not.toHaveBeenCalled();
    expect(harness.notifications.createForAllAdmins).not.toHaveBeenCalled();
  });

  it.each([
    ['foreign', 'Invalid catalog artwork reference'],
    ['wrong-product', 'Invalid catalog artwork reference'],
    ['missing', 'Invalid catalog artwork reference'],
    ['non-stored', 'Catalog artwork storage object not found'],
  ])('rejects %s artwork before a durable write', async (_case, message) => {
    const harness = buildHarness();
    harness.files.resolveCatalogArtwork.mockRejectedValueOnce(
      new BadRequestException(message),
    );

    await expect(harness.service.submitRfq(1, request())).rejects.toThrow(
      message,
    );
    expect(harness.durable.batches).toEqual([]);
    expect(harness.durable.orders).toEqual([]);
  });

  it('rolls back when the second line fails and permits same-product file reuse', async () => {
    const failing = buildHarness();
    failing.files.resolveCatalogArtwork
      .mockResolvedValueOnce({ id: 41 } as FileMetadata)
      .mockRejectedValueOnce(
        new BadRequestException('Invalid catalog artwork reference'),
      );
    await expect(
      failing.service.submitRfq(
        1,
        request([
          firstItem(),
          {
            ...firstItem(),
            categorySlug: 'custom-apparel',
            fileMetadataId: 42,
            specs: { variant: 'M' },
          },
        ]),
      ),
    ).rejects.toThrow('Invalid catalog artwork reference');
    expect(failing.durable).toEqual({
      batches: [],
      orders: [],
      items: [],
      specs: [],
      destinations: [],
    });

    const reusable = buildHarness();
    await expect(
      reusable.service.submitRfq(
        1,
        request([firstItem(), { ...firstItem(), quantity: 200 }]),
      ),
    ).resolves.toMatchObject({
      orders: [{ category: 'flyers' }, { category: 'flyers' }],
    });
    expect(reusable.files.resolveCatalogArtwork).toHaveBeenCalledTimes(1);
  });

  it('rejects inactive products, missing specs, past dates, zero quantity, and delivery without an address', async () => {
    const inactive = buildHarness([
      makeProduct(11, 'flyers', 'size', { isActive: false }),
    ]);
    await expect(
      inactive.service.submitRfq(1, request()),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'CATEGORY_INACTIVE' }),
    });

    const invalidRequests = [
      request([{ ...firstItem(), specs: {} }]),
      request([{ ...firstItem(), requiredDate: '2020-01-01' }]),
      request([{ ...firstItem(), requiredDate: '2099-02-29' }]),
      request([{ ...firstItem(), quantity: 0 }]),
      { ...request(), deliveryOption: 'delivery' as const },
      {
        ...request(),
        deliveryOption: 'delivery' as const,
        deliveryAddressId: 999,
      },
    ];
    for (const dto of invalidRequests) {
      const harness = buildHarness();
      await expect(harness.service.submitRfq(1, dto)).rejects.toBeDefined();
      expect(harness.durable.orders).toEqual([]);
    }
  });

  it('rejects an address outside the configured delivery zones before opening a transaction', async () => {
    const harness = buildHarness();
    harness.settings.isInsideServiceArea.mockResolvedValueOnce(false);

    await expect(
      harness.service.submitRfq(1, {
        ...request(),
        deliveryOption: 'delivery',
        deliveryAddressId: 9,
      }),
    ).rejects.toBeInstanceOf(ServiceAreaMismatchException);
    expect(harness.dataSource.transaction).not.toHaveBeenCalled();
    expect(harness.durable.orders).toEqual([]);
  });

  it('revalidates specifications against the locked transaction product', async () => {
    const changedFlyers = makeProduct(11, 'flyers', 'new_size');
    const harness = buildHarness([changedFlyers], [flyers]);

    await expect(harness.service.submitRfq(1, request())).rejects.toMatchObject(
      {
        response: expect.objectContaining({ code: 'SPEC_REQUIRED' }),
      },
    );
    expect(harness.files.resolveCatalogArtwork).not.toHaveBeenCalled();
    expect(harness.durable.orders).toEqual([]);
  });

  it('omits a required spec deactivated after prevalidation', async () => {
    const locked = makeProduct(11, 'flyers', 'size');
    locked.specs[0].isActive = false;
    const harness = buildHarness([locked], [flyers]);

    const result = await harness.service.submitRfq(1, request());

    expect(result.orders[0].items[0].specValues).toEqual([]);
    expect(harness.durable.specs).toEqual([]);
  });

  it('rejects an option deactivated after prevalidation without a snapshot', async () => {
    const makeSelectProduct = (optionActive: boolean) =>
      makeProduct(11, 'flyers', 'size', {
        specs: [
          {
            ...flyers.specs[0],
            inputType: InputType.SELECT,
            options: [
              {
                id: 111,
                value: 'A5',
                label: 'A5 paper',
                isActive: optionActive,
              } as never,
            ],
          },
        ],
      });
    const harness = buildHarness(
      [makeSelectProduct(false)],
      [makeSelectProduct(true)],
    );

    await expect(harness.service.submitRfq(1, request())).rejects.toMatchObject(
      {
        response: expect.objectContaining({ code: 'SPEC_OPTION_INACTIVE' }),
      },
    );
    expect(harness.durable.specs).toEqual([]);
  });

  it('preserves deterministic active spec order and exact snapshots', async () => {
    const product = makeProduct(11, 'flyers', 'later', {
      specs: [
        { ...flyers.specs[0], id: 112, key: 'later', label: 'Later' },
        { ...flyers.specs[0], id: 111, key: 'earlier', label: 'Earlier' },
      ],
    });
    const harness = buildHarness([product], [product]);

    await harness.service.submitRfq(
      1,
      request([{ ...firstItem(), specs: { earlier: 'one', later: 'two' } }]),
    );

    expect(harness.durable.specs).toEqual([
      expect.objectContaining({
        specDefinitionId: 111,
        specKey: 'earlier',
        value: 'one',
      }),
      expect.objectContaining({
        specDefinitionId: 112,
        specKey: 'later',
        value: 'two',
      }),
    ]);
  });
});
