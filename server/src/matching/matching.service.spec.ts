import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { MatchingService } from './matching.service';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from './entities/supplier-assignment.entity';
import {
  Order,
  OrderStatus,
  PricingStatus,
} from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../suppliers/entities/supplier-verification.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { PricingModel } from '../products/enums/catalog.enums';
import { Address } from '../addresses/entities/address.entity';

describe('MatchingService', () => {
  let service: MatchingService;
  let assignmentRepo: jest.Mocked<Partial<Repository<SupplierAssignment>>>;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let supplierRepo: jest.Mocked<Partial<Repository<SupplierProfile>>>;
  let categoryRepo: jest.Mocked<Partial<Repository<ProductCategory>>>;
  let auditService: jest.Mocked<
    Pick<AuditService, 'recordOrderStatusTransition' | 'append'>
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'create'>>;

  let txOrdersRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let txAssignmentRepo: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let txHistoryRepo: {
    insert: jest.Mock;
  };
  let txSupplierRepo: { find: jest.Mock; findOne: jest.Mock };
  let txCapabilityRepo: { find: jest.Mock };
  let txVerificationRepo: { find: jest.Mock; findOne: jest.Mock };
  let txCategoryRepo: { findOne: jest.Mock };
  let txAddressRepo: { findOne: jest.Mock };

  const actor = { userId: 7, role: 'ops_admin' as const };

  const flyersCategory = {
    id: 100,
    slug: 'flyers',
    isActive: true,
    pricingModel: PricingModel.QUOTE_REQUIRED,
    groupSlug: 'marketing-promo',
    groupName: 'Marketing & Promotional Collateral',
    groupDescription: 'Promotional print products.',
    groupSortOrder: 1,
  } as ProductCategory;

  function baseOrder(overrides: Partial<Order> = {}): Order {
    return {
      id: 42,
      orderId: 'ORD-42',
      userId: 3,
      orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
      category: 'paper',
      quantity: 10,
      deliveryAddressId: 5,
      deliveryAddress: {
        id: 5,
        city: 'Davao City',
        barangay: 'Poblacion',
      },
      ...overrides,
    } as Order;
  }

  beforeEach(async () => {
    txOrdersRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txAssignmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      create: jest.fn((data: Partial<SupplierAssignment>) => ({
        id: 0,
        ...data,
      })),
      save: jest.fn(async (row: Partial<SupplierAssignment>) => ({
        id: 99,
        ...row,
      })),
      createQueryBuilder: jest.fn(() => {
        const qb = {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
          execute: jest.fn().mockResolvedValue({ affected: 0 }),
        };
        return qb;
      }),
    };
    txHistoryRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
    };
    txSupplierRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    txCapabilityRepo = { find: jest.fn().mockResolvedValue([]) };
    txVerificationRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    txCategoryRepo = { findOne: jest.fn().mockResolvedValue(null) };
    txAddressRepo = {
      findOne: jest.fn().mockResolvedValue({
        id: 5,
        city: 'Davao City',
        barangay: 'Poblacion',
        province: null,
      }),
    };

    assignmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => {
        const qb = {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest.fn().mockResolvedValue([]),
        };
        return qb;
      }),
    };

    ordersRepo = {
      findOne: jest.fn(),
    };

    supplierRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    categoryRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    auditService = {
      recordOrderStatusTransition: jest.fn().mockResolvedValue({}),
      append: jest.fn().mockResolvedValue({}),
    };

    notificationsService = {
      create: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MatchingService,
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: assignmentRepo,
        },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        {
          provide: getRepositoryToken(SupplierProfile),
          useValue: supplierRepo,
        },
        {
          provide: getRepositoryToken(ProductCategory),
          useValue: categoryRepo,
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (fn: (m: unknown) => unknown) =>
              fn({
                getRepository: (entity: unknown) => {
                  if (entity === Order) return txOrdersRepo;
                  if (entity === SupplierAssignment) return txAssignmentRepo;
                  if (entity === OrderStatusHistory) return txHistoryRepo;
                  if (entity === SupplierProfile) return txSupplierRepo;
                  if (entity === SupplierCapability) return txCapabilityRepo;
                  if (entity === SupplierVerification)
                    return txVerificationRepo;
                  if (entity === ProductCategory) return txCategoryRepo;
                  if (entity === Address) return txAddressRepo;
                  return {};
                },
              }),
            ),
          },
        },
        { provide: AuditService, useValue: auditService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(MatchingService);
  });

  describe('getCandidates', () => {
    it('rejects orders not in approved_for_matching', async () => {
      ordersRepo.findOne!.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.NEEDS_QA }),
      );

      await expect(service.getCandidates(42)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('returns ranked candidates for matching queue order', async () => {
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      supplierRepo.find!.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: ['Davao City'],
          isActive: true,
          ratingAverage: 4.5,
          ratingCount: 2,
          capabilities: [
            {
              id: 1,
              supplierId: 11,
              productFamily: 'paper',
              isActive: true,
              materials: [],
              maxCapacity: 10,
              leadTimeDays: 1,
            },
          ],
          verification: {
            status: SupplierVerificationStatus.VERIFIED,
          },
        } as unknown as SupplierProfile,
        {
          id: 12,
          userId: 56,
          businessName: 'Unverified',
          serviceZones: [],
          isActive: true,
          ratingAverage: 5,
          capabilities: [
            {
              id: 2,
              supplierId: 12,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 10,
              leadTimeDays: 1,
            },
          ],
          verification: {
            status: SupplierVerificationStatus.PENDING,
          },
        } as unknown as SupplierProfile,
      ]);

      const result = await service.getCandidates(42);

      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].supplierId).toBe(11);
      expect(result.excludedCount).toBe(1);
      expect(result.order.orderStatus).toBe(OrderStatus.APPROVED_FOR_MATCHING);
      expect(result.outcome).toEqual({
        code: 'eligible_suppliers_found',
        message: '1 eligible supplier found',
      });
    });

    it('returns a stable unmet-coverage outcome when no supplier is eligible', async () => {
      ordersRepo.findOne!.mockResolvedValue(
        baseOrder({
          category: 'flyers',
          pricingStatus: PricingStatus.PENDING_QUOTE,
        }),
      );
      categoryRepo.findOne!.mockResolvedValue(flyersCategory);
      supplierRepo.find!.mockResolvedValue([]);

      const result = await service.getCandidates(42);

      expect(result.candidates).toEqual([]);
      expect(result.outcome).toEqual({
        code: 'no_eligible_supplier',
        message: 'No eligible supplier covers order 42',
      });
    });
  });

  describe('assign', () => {
    it('creates assignment and transitions order to supplier_assigned', async () => {
      const order = baseOrder();
      ordersRepo.findOne!.mockResolvedValue(order);
      supplierRepo.find!.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: [],
          isActive: true,
          ratingAverage: 4,
          capabilities: [
            {
              id: 1,
              supplierId: 11,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 0,
              leadTimeDays: 2,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      supplierRepo.findOne!.mockResolvedValue({ id: 11 } as SupplierProfile);
      txOrdersRepo.findOne.mockResolvedValue(order);
      txSupplierRepo.find.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: [],
          isActive: true,
          ratingAverage: 4,
        },
      ]);
      txCapabilityRepo.find.mockResolvedValue([
        {
          id: 1,
          supplierId: 11,
          productFamily: 'paper',
          isActive: true,
          maxCapacity: 0,
          leadTimeDays: 2,
        },
      ]);
      txVerificationRepo.find.mockResolvedValue([
        {
          supplierId: 11,
          status: SupplierVerificationStatus.VERIFIED,
        },
      ]);

      const result = await service.assign(42, 11, actor, 'manual pick');

      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
      expect(result.assignment.supplierId).toBe(11);
      expect(result.assignment.decision).toBe(
        SupplierAssignmentDecision.PENDING,
      );
      expect(result.assignment.acceptanceDeadline).toBeInstanceOf(Date);
      expect(result.assignment.rankingInputs).toEqual(
        expect.objectContaining({
          matchedProductFamily: 'paper',
          capabilityFit: 1,
        }),
      );
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
        { orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
      );
      expect(txHistoryRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 42,
          fromStatus: OrderStatus.APPROVED_FOR_MATCHING,
          toStatus: OrderStatus.SUPPLIER_ASSIGNED,
          changedByUserId: 7,
        }),
      );
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalled();
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 55,
          type: 'supplier_assignment',
          orderRef: 'ORD-42',
        }),
      );
    });

    it('returns stable not-found for an unknown manual supplier id', async () => {
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      supplierRepo.find!.mockResolvedValue([]);
      supplierRepo.findOne!.mockResolvedValue(null);

      await expect(service.assign(42, 999, actor)).rejects.toThrow(
        'Supplier 999 not found',
      );
    });

    it('rejects an existing unverified manual supplier while another candidate exists', async () => {
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      supplierRepo.findOne!.mockResolvedValue({ id: 20 });
      supplierRepo.find!.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'Eligible',
          serviceZones: [],
          isActive: true,
          ratingAverage: 4,
          capabilities: [
            {
              id: 1,
              supplierId: 11,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 10,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        },
        {
          id: 20,
          userId: 77,
          businessName: 'Unverified',
          serviceZones: [],
          isActive: true,
          ratingAverage: 5,
          capabilities: [
            {
              id: 2,
              supplierId: 20,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 10,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.PENDING },
        },
      ] as unknown as SupplierProfile[]);

      await expect(service.assign(42, 20, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'supplier_not_eligible' }),
      });
    });

    it('rejects manual assignment of a verified supplier without the exact capability', async () => {
      const order = baseOrder();
      ordersRepo.findOne!.mockResolvedValue(order);
      supplierRepo.find!.mockResolvedValue([
        {
          id: 20,
          userId: 77,
          businessName: 'Override Print',
          serviceZones: [],
          isActive: true,
          ratingAverage: 0,
          capabilities: [
            {
              id: 9,
              supplierId: 20,
              productFamily: 'shirts',
              isActive: true,
              maxCapacity: 0,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      supplierRepo.findOne!.mockResolvedValue({ id: 20 } as SupplierProfile);

      await expect(
        service.assign(42, 20, actor, 'manual pick'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'supplier_not_eligible' }),
      });
      expect(txAssignmentRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a supplier whose active capability changed after ranking', async () => {
      const order = baseOrder({
        category: 'flyers',
        pricingStatus: PricingStatus.PENDING_QUOTE,
      });
      ordersRepo.findOne!.mockResolvedValue(order);
      categoryRepo.findOne!.mockResolvedValue(flyersCategory);
      supplierRepo.find!.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: [],
          isActive: true,
          ratingAverage: 4,
          capabilities: [
            {
              id: 1,
              supplierId: 11,
              productFamily: 'flyers',
              isActive: true,
              maxCapacity: 10,
              leadTimeDays: 2,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      supplierRepo.findOne!.mockResolvedValue({ id: 11 } as SupplierProfile);
      txOrdersRepo.findOne.mockResolvedValue(order);
      txSupplierRepo.find.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: [],
          isActive: true,
          ratingAverage: 4,
        },
      ]);
      txCapabilityRepo.find.mockResolvedValue([
        {
          id: 1,
          supplierId: 11,
          productFamily: 'flyers',
          isActive: false,
          maxCapacity: 10,
          leadTimeDays: 2,
        },
      ]);
      txVerificationRepo.find.mockResolvedValue([
        {
          supplierId: 11,
          status: SupplierVerificationStatus.VERIFIED,
        },
      ]);
      txCategoryRepo.findOne.mockResolvedValue(flyersCategory);

      await expect(service.assign(42, 11, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'supplier_not_eligible' }),
      });
      expect(txAssignmentRepo.save).not.toHaveBeenCalled();
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
    });

    it('does not newly assign an inactive legacy catalog category', async () => {
      const order = baseOrder({ category: 'paper' });
      ordersRepo.findOne!.mockResolvedValue(order);
      categoryRepo.findOne!.mockResolvedValue({
        ...flyersCategory,
        slug: 'paper',
        isActive: false,
        pricingModel: PricingModel.PER_PAGE_MODIFIERS,
      });
      supplierRepo.find!.mockResolvedValue([]);
      supplierRepo.findOne!.mockResolvedValue({ id: 11 } as SupplierProfile);

      await expect(service.assign(42, 11, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'supplier_not_eligible' }),
      });
    });

    it('rejects non-ops actors', async () => {
      await expect(
        service.assign(42, 11, { userId: 1, role: 'client' }),
      ).rejects.toThrow(/cannot perform matching/);
    });
  });

  describe('autoMatch', () => {
    it('assigns top candidate', async () => {
      const order = baseOrder();
      ordersRepo.findOne!.mockResolvedValue(order);
      supplierRepo.find!.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: [],
          isActive: true,
          ratingAverage: 3,
          capabilities: [
            {
              id: 1,
              supplierId: 11,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 5,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      txOrdersRepo.findOne.mockResolvedValue(order);
      txSupplierRepo.find.mockResolvedValue([
        {
          id: 11,
          userId: 55,
          businessName: 'PrintCo',
          serviceZones: [],
          isActive: true,
          ratingAverage: 3,
        },
      ]);
      txCapabilityRepo.find.mockResolvedValue([
        {
          id: 1,
          supplierId: 11,
          productFamily: 'paper',
          isActive: true,
          maxCapacity: 5,
          leadTimeDays: 1,
        },
      ]);
      txVerificationRepo.find.mockResolvedValue([
        {
          supplierId: 11,
          status: SupplierVerificationStatus.VERIFIED,
        },
      ]);

      const result = await service.autoMatch(42, actor);

      expect(result.candidate.supplierId).toBe(11);
      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
    });

    it('returns the stable no-coverage error when no eligible suppliers exist', async () => {
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      supplierRepo.find!.mockResolvedValue([]);

      await expect(service.autoMatch(42, actor)).rejects.toMatchObject({
        response: {
          code: 'no_eligible_supplier',
          message: 'No eligible supplier covers order 42',
        },
      });
    });

    it('reranks the full locked pool and falls back when the preflight top is full', async () => {
      const order = baseOrder();
      const profiles = [
        {
          id: 11,
          userId: 55,
          businessName: 'Former Top',
          serviceZones: [],
          isActive: true,
          ratingAverage: 5,
          capabilities: [
            {
              id: 1,
              supplierId: 11,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 1,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        },
        {
          id: 12,
          userId: 56,
          businessName: 'Current Top',
          serviceZones: [],
          isActive: true,
          ratingAverage: 4,
          capabilities: [
            {
              id: 2,
              supplierId: 12,
              productFamily: 'paper',
              isActive: true,
              maxCapacity: 1,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        },
      ] as unknown as SupplierProfile[];
      ordersRepo.findOne!.mockResolvedValue(order);
      supplierRepo.find!.mockResolvedValue(profiles);
      txOrdersRepo.findOne.mockResolvedValue({
        ...order,
        deliveryAddress: undefined,
      });
      txSupplierRepo.find.mockResolvedValue(
        profiles.map(
          ({ capabilities: _caps, verification: _verification, ...profile }) =>
            profile,
        ),
      );
      txCapabilityRepo.find.mockResolvedValue(
        profiles.flatMap((profile) => profile.capabilities),
      );
      txVerificationRepo.find.mockResolvedValue(
        profiles.map((profile) => ({
          supplierId: profile.id,
          status: SupplierVerificationStatus.VERIFIED,
        })),
      );
      txAssignmentRepo.createQueryBuilder.mockImplementation(() => {
        const qb = {
          select: jest.fn().mockReturnThis(),
          addSelect: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          groupBy: jest.fn().mockReturnThis(),
          getRawMany: jest
            .fn()
            .mockResolvedValue([{ supplierId: '11', cnt: '1' }]),
          execute: jest.fn().mockResolvedValue({ affected: 0 }),
        };
        return qb;
      });

      const result = await service.autoMatch(42, actor);

      expect(result.candidate.supplierId).toBe(12);
      expect(result.candidate.rankPosition).toBe(1);
      expect(result.assignment.rankPosition).toBe(1);
      expect(result.assignment.rankingInputs).toEqual(
        expect.objectContaining({ openLoad: 0 }),
      );
    });

    it('uses the locked delivery address and rejects a stale preflight zone match', async () => {
      const order = baseOrder();
      const profile = {
        id: 11,
        userId: 55,
        businessName: 'Davao Only',
        serviceZones: ['Davao City'],
        isActive: true,
        ratingAverage: 4,
        capabilities: [
          {
            id: 1,
            supplierId: 11,
            productFamily: 'paper',
            isActive: true,
            maxCapacity: 10,
            leadTimeDays: 1,
          },
        ],
        verification: { status: SupplierVerificationStatus.VERIFIED },
      } as unknown as SupplierProfile;
      ordersRepo.findOne!.mockResolvedValue(order);
      supplierRepo.find!.mockResolvedValue([profile]);
      txOrdersRepo.findOne.mockResolvedValue({
        ...order,
        deliveryAddress: undefined,
      });
      txAddressRepo.findOne.mockResolvedValue({
        id: 5,
        city: 'Cebu City',
        barangay: 'Lahug',
        province: 'Cebu',
      });
      txSupplierRepo.find.mockResolvedValue([
        { ...profile, capabilities: undefined, verification: undefined },
      ]);
      txCapabilityRepo.find.mockResolvedValue(profile.capabilities);
      txVerificationRepo.find.mockResolvedValue([
        { supplierId: 11, status: SupplierVerificationStatus.VERIFIED },
      ]);

      await expect(service.autoMatch(42, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'no_eligible_supplier' }),
      });
      expect(txAssignmentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('expireAssignment', () => {
    it('expires pending assignment and returns order to approved_for_matching', async () => {
      const past = new Date('2026-08-01T00:00:00Z');
      const assignment = {
        id: 99,
        orderId: 42,
        supplierId: 11,
        decision: SupplierAssignmentDecision.PENDING,
        acceptanceDeadline: past,
      } as SupplierAssignment;

      txAssignmentRepo.findOne.mockResolvedValue({ ...assignment });
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.SUPPLIER_ASSIGNED }),
      );

      const result = await service.expireAssignment(
        99,
        new Date('2026-08-04T00:00:00Z'),
      );

      expect(result.decision).toBe(SupplierAssignmentDecision.EXPIRED);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
        { orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
      );
      expect(txHistoryRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: OrderStatus.SUPPLIER_ASSIGNED,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
        }),
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'supplier_assignment_expired',
        }),
        expect.anything(),
      );
    });

    it('does not change order when assignment already decided', async () => {
      txAssignmentRepo.findOne.mockResolvedValue({
        id: 99,
        orderId: 42,
        decision: SupplierAssignmentDecision.ACCEPTED,
        acceptanceDeadline: new Date('2026-08-01T00:00:00Z'),
      } as SupplierAssignment);

      const result = await service.expireAssignment(
        99,
        new Date('2026-08-04T00:00:00Z'),
      );

      expect(result.decision).toBe(SupplierAssignmentDecision.ACCEPTED);
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
    });

    it('throws when assignment missing', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(service.expireAssignment(404)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('expireStaleAssignments', () => {
    it('expires only past-deadline pending rows', async () => {
      const past = new Date('2026-08-01T00:00:00Z');
      const future = new Date('2026-08-10T00:00:00Z');
      assignmentRepo.find!.mockResolvedValue([
        {
          id: 1,
          orderId: 42,
          decision: SupplierAssignmentDecision.PENDING,
          acceptanceDeadline: past,
        },
        {
          id: 2,
          orderId: 43,
          decision: SupplierAssignmentDecision.PENDING,
          acceptanceDeadline: future,
        },
      ] as SupplierAssignment[]);

      const expireSpy = jest
        .spyOn(service, 'expireAssignment')
        .mockResolvedValue({
          id: 1,
          decision: SupplierAssignmentDecision.EXPIRED,
        } as SupplierAssignment);

      const result = await service.expireStaleAssignments(
        new Date('2026-08-04T00:00:00Z'),
      );

      expect(result.scanned).toBe(2);
      expect(result.expiredAssignmentIds).toEqual([1]);
      expect(expireSpy).toHaveBeenCalledWith(1, expect.any(Date));
      expireSpy.mockRestore();
    });
  });
});
