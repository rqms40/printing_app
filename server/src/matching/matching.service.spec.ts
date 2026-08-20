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
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { SupplierVerificationStatus } from '../suppliers/entities/supplier-verification.entity';

describe('MatchingService', () => {
  let service: MatchingService;
  let assignmentRepo: jest.Mocked<Partial<Repository<SupplierAssignment>>>;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let supplierRepo: jest.Mocked<Partial<Repository<SupplierProfile>>>;
  let auditService: jest.Mocked<
    Pick<AuditService, 'recordOrderStatusTransition' | 'append'>
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'create'>>;

  let txOrdersRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let txAssignmentRepo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let txHistoryRepo: {
    insert: jest.Mock;
  };

  const actor = { userId: 7, role: 'ops_admin' as const };

  function baseOrder(overrides: Partial<Order> = {}): Order {
    return {
      id: 42,
      orderId: 'ORD-42',
      userId: 3,
      orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
      category: 'paper',
      quantity: 10,
      deliveryAddress: {
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
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: 0, ...data })),
      save: jest.fn(async (row) => ({ id: 99, ...row })),
      createQueryBuilder: jest.fn(() => {
        const qb = {
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 0 }),
        };
        return qb;
      }),
    };
    txHistoryRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
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
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (fn: (m: unknown) => unknown) =>
              fn({
                getRepository: (entity: unknown) => {
                  if (entity === Order) return txOrdersRepo;
                  if (entity === SupplierAssignment) return txAssignmentRepo;
                  if (entity === OrderStatusHistory) return txHistoryRepo;
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
              maxCapacity: 0,
              leadTimeDays: 2,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      txOrdersRepo.findOne.mockResolvedValue(order);

      const result = await service.assign(42, 11, actor, 'manual pick');

      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
      expect(result.assignment.supplierId).toBe(11);
      expect(result.assignment.decision).toBe(
        SupplierAssignmentDecision.PENDING,
      );
      expect(result.assignment.acceptanceDeadline).toBeInstanceOf(Date);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
        {
          orderStatus: OrderStatus.SUPPLIER_ASSIGNED,
          preferredSupplierId: 11,
          deliveryFeeMinor: '0',
          deliveryFee: 0,
        },
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

    it('rejects unknown supplier id on ops override path', async () => {
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      supplierRepo.find!.mockResolvedValue([]);
      supplierRepo.findOne!.mockResolvedValue(null);

      await expect(service.assign(42, 999, actor)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('allows ops override assign of verified supplier not ranked by capability', async () => {
      const order = baseOrder();
      ordersRepo.findOne!.mockResolvedValue(order);
      // Ranked list empty (no capability match) but supplier is verified active.
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
              maxCapacity: 0,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      supplierRepo.findOne!.mockResolvedValue({
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
            maxCapacity: 0,
            leadTimeDays: 1,
          },
        ],
        verification: { status: SupplierVerificationStatus.VERIFIED },
      } as unknown as SupplierProfile);
      txOrdersRepo.findOne.mockResolvedValue(order);

      const result = await service.assign(42, 20, actor, 'ops override');
      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
      expect(result.assignment.supplierId).toBe(20);
      expect(result.candidate.businessName).toBe('Override Print');
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
              maxCapacity: 5,
              leadTimeDays: 1,
            },
          ],
          verification: { status: SupplierVerificationStatus.VERIFIED },
        } as unknown as SupplierProfile,
      ]);
      txOrdersRepo.findOne.mockResolvedValue(order);

      const result = await service.autoMatch(42, actor);

      expect(result.candidate.supplierId).toBe(11);
      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
    });

    it('throws when no eligible suppliers', async () => {
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      supplierRepo.find!.mockResolvedValue([]);

      await expect(service.autoMatch(42, actor)).rejects.toThrow(
        /No eligible suppliers/,
      );
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
