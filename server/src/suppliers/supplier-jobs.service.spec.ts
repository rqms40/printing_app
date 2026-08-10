/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { SupplierJobsService } from './supplier-jobs.service';
import { SupplierProfile } from './entities/supplier-profile.entity';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../matching/entities/supplier-assignment.entity';
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
  PricingStatus,
} from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { BatchOrder } from '../orders/entities/batch-order.entity';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductionMilestone } from './dto/production-status.dto';

describe('SupplierJobsService', () => {
  let service: SupplierJobsService;
  let assignmentRepo: jest.Mocked<Partial<Repository<SupplierAssignment>>>;
  let profileRepo: jest.Mocked<Partial<Repository<SupplierProfile>>>;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let auditService: jest.Mocked<
    Pick<AuditService, 'recordOrderStatusTransition' | 'append'>
  >;
  let filesService: jest.Mocked<
    Pick<FilesService, 'findById' | 'getPresignedUrlForKey' | 'storeMetadata'>
  >;
  let notificationsService: jest.Mocked<Pick<NotificationsService, 'create'>>;

  let txAssignmentRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
  };
  let txOrdersRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let txBatchRepo: {
    findOne: jest.Mock;
  };
  let txHistoryRepo: {
    insert: jest.Mock;
  };
  let txFileRepo: {
    findOne: jest.Mock;
  };

  const actor = { userId: 55, role: 'supplier' as const };
  const supplierProfile = {
    id: 11,
    userId: 55,
    businessName: 'PrintCo',
    isActive: true,
    verification: { status: 'verified' },
  } as unknown as SupplierProfile;

  function baseOrder(overrides: Partial<Order> = {}): Order {
    return {
      id: 42,
      orderId: 'ORD-42',
      userId: 3,
      orderStatus: OrderStatus.SUPPLIER_ASSIGNED,
      category: 'paper',
      quantity: 10,
      totalPrice: 500,
      deliveryFee: 25,
      deliveryFeeMinor: '2500',
      finalTotalMinor: null,
      quotedTotalMinor: null,
      quotedAt: null,
      quoteAcceptedAt: null,
      quotedByUserId: null,
      promisedCompletionAt: null,
      pricingStatus: PricingStatus.PENDING_QUOTE,
      paymentMethod: 'pilot_credit',
      paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
      deliveryOption: 'delivery',
      fileName: 'flyer.pdf',
      fileUrl: null,
      fileMetadataId: 99,
      adminNotes: null,
      estimatedCompletionAt: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      ...overrides,
    } as Order;
  }

  function baseAssignment(
    overrides: Partial<SupplierAssignment> = {},
  ): SupplierAssignment {
    return {
      id: 7,
      orderId: 42,
      supplierId: 11,
      rankingInputs: {},
      rankPosition: 1,
      acceptanceDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
      decision: SupplierAssignmentDecision.PENDING,
      decisionReason: null,
      finalPriceMinor: null,
      promisedDate: null,
      decidedAt: null,
      selfQcEvidenceFileIds: [],
      createdAt: new Date('2026-08-02T00:00:00Z'),
      updatedAt: new Date('2026-08-02T00:00:00Z'),
      order: baseOrder(),
      ...overrides,
    } as SupplierAssignment;
  }

  beforeEach(async () => {
    txAssignmentRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(async (row) => row),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txOrdersRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txBatchRepo = {
      findOne: jest.fn(),
    };
    txHistoryRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
    };
    txFileRepo = {
      findOne: jest.fn(),
    };

    assignmentRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    profileRepo = {
      findOne: jest.fn().mockResolvedValue(supplierProfile),
    };
    ordersRepo = {
      findOne: jest.fn(),
      manager: {
        getRepository: jest.fn().mockReturnValue({
          find: jest.fn().mockResolvedValue([]),
        }),
      } as unknown as Repository<Order>['manager'],
    };
    auditService = {
      recordOrderStatusTransition: jest.fn().mockResolvedValue({}),
      append: jest.fn().mockResolvedValue({}),
    };
    filesService = {
      findById: jest.fn(),
      getPresignedUrlForKey: jest
        .fn()
        .mockResolvedValue('https://minio.example/signed'),
      storeMetadata: jest.fn(),
    };
    notificationsService = {
      create: jest.fn().mockResolvedValue({}),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        SupplierJobsService,
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(SupplierProfile),
          useValue: profileRepo,
        },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(async (fn: (m: unknown) => unknown) =>
              fn({
                getRepository: (entity: unknown) => {
                  if (entity === SupplierAssignment) return txAssignmentRepo;
                  if (entity === Order) return txOrdersRepo;
                  if (entity === BatchOrder) return txBatchRepo;
                  if (entity === OrderStatusHistory) return txHistoryRepo;
                  if (entity === FileMetadata) return txFileRepo;
                  return {};
                },
              }),
            ),
          },
        },
        { provide: AuditService, useValue: auditService },
        { provide: FilesService, useValue: filesService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    service = moduleRef.get(SupplierJobsService);
  });

  describe('acceptJob', () => {
    const futureDate = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();

    beforeEach(() => {
      assignmentRepo.findOne!.mockResolvedValue(baseAssignment());
      ordersRepo.findOne!.mockResolvedValue(baseOrder());
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());
      txAssignmentRepo.find.mockImplementation(async () => {
        const selected = await txAssignmentRepo.findOne({});
        return selected ? [selected] : [];
      });
    });

    it('accepts pending assignment: ACCEPTED + supplier_accepted + freezes price/promised', async () => {
      const assignment = baseAssignment();
      const order = baseOrder();
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txAssignmentRepo.find.mockResolvedValue([assignment]);
      txOrdersRepo.findOne.mockResolvedValue(order);
      txAssignmentRepo.save.mockImplementation(async (row) => ({
        ...row,
        decision: SupplierAssignmentDecision.ACCEPTED,
        finalPriceMinor: '150000',
        promisedDate: new Date(futureDate),
        decidedAt: expect.any(Date),
      }));

      const result = await service.acceptJob(
        7,
        { finalPriceMinor: 150000, promisedDate: futureDate },
        actor,
      );

      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_ACCEPTED);
      expect(result.fromStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
      expect(result.assignment.decision).toBe(
        SupplierAssignmentDecision.ACCEPTED,
      );
      expect(result.assignment.finalPriceMinor).toBe('150000');
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
        expect.objectContaining({
          orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
          pricingStatus: PricingStatus.QUOTED,
          quotedTotalMinor: '152500', // 150000 goods + 2500 delivery
          quotedAt: expect.any(Date),
          quotedByUserId: 55,
          promisedCompletionAt: new Date(futureDate),
          deliveryFeeMinor: '2500',
        }),
      );
      expect(txHistoryRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 42,
          fromStatus: OrderStatus.SUPPLIER_ASSIGNED,
          toStatus: OrderStatus.SUPPLIER_ACCEPTED,
          changedByUserId: 55,
        }),
      );
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: 'supplier',
          toStatus: OrderStatus.SUPPLIER_ACCEPTED,
        }),
        expect.anything(),
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'supplier_job_accepted' }),
        expect.anything(),
      );
      expect(notificationsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 3,
          type: 'supplier_accepted',
        }),
      );
    });

    it('allocates a shared batch delivery fee only to the lowest persisted order id', async () => {
      const assignment = baseAssignment({ orderId: 43 });
      const order = baseOrder({
        id: 43,
        orderId: 'ORD-43',
        batchOrderId: 8,
        deliveryFee: 0,
        deliveryFeeMinor: null,
      });
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txAssignmentRepo.find.mockResolvedValue([assignment]);
      txBatchRepo.findOne.mockResolvedValue({ id: 8, deliveryFee: '25.00' });
      assignmentRepo.findOne!.mockResolvedValue(assignment);
      ordersRepo.findOne!.mockResolvedValue(order);
      (txOrdersRepo as any).find = jest
        .fn()
        .mockResolvedValue([{ id: 42 }, order]);

      await service.acceptJob(
        7,
        { finalPriceMinor: 150000, promisedDate: futureDate },
        actor,
      );

      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 43, orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
        expect.objectContaining({
          quotedTotalMinor: '150000',
          deliveryFeeMinor: '0',
        }),
      );
    });

    it('assigns the shared batch delivery fee to the lowest persisted order even when it quotes last', async () => {
      const assignment = baseAssignment({ orderId: 42 });
      const order = baseOrder({
        id: 42,
        batchOrderId: 8,
        deliveryFee: 0,
        deliveryFeeMinor: null,
      });
      assignmentRepo.findOne!.mockResolvedValue(assignment);
      ordersRepo.findOne!.mockResolvedValue(order);
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txAssignmentRepo.find.mockResolvedValue([assignment]);
      txBatchRepo.findOne.mockResolvedValue({ id: 8, deliveryFee: '25.00' });
      txOrdersRepo.find.mockResolvedValue([order, { id: 43 }]);

      await service.acceptJob(
        7,
        { finalPriceMinor: 100000, promisedDate: futureDate },
        actor,
      );

      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
        expect.objectContaining({
          quotedTotalMinor: '102500',
          deliveryFeeMinor: '2500',
        }),
      );
    });

    it('rejects a quote total that overflows the safe minor-unit range', async () => {
      const assignment = baseAssignment();
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txAssignmentRepo.find.mockResolvedValue([assignment]);
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ deliveryFeeMinor: '1' }),
      );

      await expect(
        service.acceptJob(
          7,
          {
            finalPriceMinor: Number.MAX_SAFE_INTEGER,
            promisedDate: futureDate,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'quote_total_overflow' }),
      });
      expect(txAssignmentRepo.save).not.toHaveBeenCalled();
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a superseded assignment even when it is still pending', async () => {
      const stale = baseAssignment({ id: 7 });
      txAssignmentRepo.findOne.mockResolvedValue(stale);
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());
      txAssignmentRepo.find.mockResolvedValue([
        stale,
        baseAssignment({ id: 8 }),
      ]);

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'stale_assignment' }),
      });
      expect(txAssignmentRepo.save).not.toHaveBeenCalled();
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
    });

    it('never mutates a quote already accepted by the customer', async () => {
      const assignment = baseAssignment();
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.SUPPLIER_ASSIGNED,
          pricingStatus: PricingStatus.ACCEPTED,
          quotedTotalMinor: '9000',
          quoteAcceptedAt: new Date('2026-08-09T00:00:00Z'),
        }),
      );
      txAssignmentRepo.find.mockResolvedValue([assignment]);

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'quote_already_accepted' }),
      });
      expect(txAssignmentRepo.save).not.toHaveBeenCalled();
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
    });

    it('rejects a promised completion that is not strictly in the future', async () => {
      await expect(
        service.acceptJob(
          7,
          {
            finalPriceMinor: 100,
            promisedDate: new Date(Date.now() - 1_000).toISOString(),
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'promised_date_in_past' }),
      });
    });

    it('rejects an unsafe integer price before persistence', async () => {
      await expect(
        service.acceptJob(
          7,
          {
            finalPriceMinor: Number.MAX_SAFE_INTEGER + 1,
            promisedDate: futureDate,
          },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'invalid_final_price' }),
      });
    });

    it('rejects when assignment belongs to another supplier', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ supplierId: 99 }),
      );

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_own_assignment' }),
      });
    });

    it('rejects non-pending decision', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'assignment_not_pending' }),
      });
    });

    it('rejects when acceptance SLA expired', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({
          acceptanceDeadline: new Date(Date.now() - 60_000),
        }),
      );

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'acceptance_sla_expired' }),
      });
    });

    it('rejects when order is not supplier_assigned', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(baseAssignment());
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.APPROVED_FOR_MATCHING }),
      );

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'order_not_supplier_assigned',
        }),
      });
    });

    it('rejects non-supplier actor', async () => {
      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          { userId: 1, role: 'ops_admin' },
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'supplier_role_required' }),
      });
    });

    it('rejects missing supplier profile', async () => {
      profileRepo.findOne!.mockResolvedValue(null);

      await expect(
        service.acceptJob(
          7,
          { finalPriceMinor: 100, promisedDate: futureDate },
          actor,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('declineJob', () => {
    it('declines pending assignment and re-queues order to approved_for_matching', async () => {
      const assignment = baseAssignment();
      const order = baseOrder();
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txOrdersRepo.findOne.mockResolvedValue(order);
      txAssignmentRepo.save.mockImplementation(async (row) => ({
        ...row,
        decision: SupplierAssignmentDecision.DECLINED,
        decisionReason: 'At capacity',
        decidedAt: new Date(),
      }));

      const result = await service.declineJob(
        7,
        { reason: 'At capacity' },
        actor,
      );

      expect(result.assignment.decision).toBe(
        SupplierAssignmentDecision.DECLINED,
      );
      expect(result.toStatus).toBe(OrderStatus.APPROVED_FOR_MATCHING);
      expect(result.fromStatus).toBe(OrderStatus.SUPPLIER_ASSIGNED);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
        { orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'supplier_job_declined' }),
        expect.anything(),
      );
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
        }),
        expect.anything(),
      );
    });

    it('rejects when not own assignment', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ supplierId: 99 }),
      );

      await expect(
        service.declineJob(7, { reason: 'No' }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_own_assignment' }),
      });
    });

    it('rejects non-pending assignment', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.EXPIRED }),
      );

      await expect(
        service.declineJob(7, { reason: 'No' }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'assignment_not_pending' }),
      });
    });

    it('does not re-queue when order already left supplier_assigned', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(baseAssignment());
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.CANCELLED }),
      );
      txAssignmentRepo.save.mockImplementation(async (row) => ({
        ...row,
        decision: SupplierAssignmentDecision.DECLINED,
      }));

      const result = await service.declineJob(
        7,
        { reason: 'Late decline' },
        actor,
      );

      expect(result.assignment.decision).toBe(
        SupplierAssignmentDecision.DECLINED,
      );
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
      expect(result.toStatus).toBe(OrderStatus.CANCELLED);
    });
  });

  describe('updateProductionStatus (payment gate)', () => {
    it('starts production from payment_authorized when authorized', async () => {
      const assignment = baseAssignment({
        decision: SupplierAssignmentDecision.ACCEPTED,
        finalPriceMinor: '10000',
      });
      const order = baseOrder({
        orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
        paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
      });
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
      txOrdersRepo.findOne.mockResolvedValue(order);

      const result = await service.updateProductionStatus(
        7,
        { milestone: ProductionMilestone.IN_PRODUCTION },
        actor,
      );

      expect(result.fromStatus).toBe(OrderStatus.PAYMENT_AUTHORIZED);
      expect(result.toStatus).toBe(OrderStatus.PRODUCTION);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.PAYMENT_AUTHORIZED },
        { orderStatus: OrderStatus.PRODUCTION },
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'supplier_production_milestone' }),
        expect.anything(),
      );
    });

    it('blocks production when paymentAuthorizationStatus is not authorized', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        }),
      );

      await expect(
        service.updateProductionStatus(7, { status: 'production' }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'payment_not_authorized' }),
      });
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
    });

    it('blocks production before payment_authorized status', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        }),
      );

      await expect(
        service.updateProductionStatus(
          7,
          { milestone: ProductionMilestone.MATERIALS_SETUP },
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_open_for_production' }),
      });
    });

    it('records milestone-only when already in production', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PRODUCTION,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        }),
      );

      const result = await service.updateProductionStatus(
        7,
        {
          milestone: ProductionMilestone.PRODUCTION_COMPLETE,
          notes: 'Print done',
        },
        actor,
      );

      expect(result.fromStatus).toBe(OrderStatus.PRODUCTION);
      expect(result.toStatus).toBe(OrderStatus.PRODUCTION);
      expect(txOrdersRepo.update).not.toHaveBeenCalled();
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'supplier_production_milestone',
          reason: 'Print done',
        }),
        expect.anything(),
      );
    });

    it('rejects production on non-accepted assignment', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.PENDING }),
      );

      await expect(
        service.updateProductionStatus(7, { status: 'production' }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'assignment_not_accepted' }),
      });
    });
  });

  describe('submitSelfQc', () => {
    function ownedEvidence(
      overrides: Partial<FileMetadata> = {},
    ): FileMetadata {
      return {
        id: 200,
        originalName: 'qc.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        url: 'https://minio.example/qc.jpg',
        objectKey: 'uploads/general/2026/08/qc.jpg',
        uploadedBy: 55,
        purpose: FilePurpose.GENERAL,
        ...overrides,
      } as FileMetadata;
    }

    it('production → supplier_self_qc with owned evidence files', async () => {
      // also persists evidence ids on the assignment for client display
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PRODUCTION,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        }),
      );
      txFileRepo.findOne.mockResolvedValue(ownedEvidence());

      const result = await service.submitSelfQc(
        7,
        {
          evidenceFileIds: [200],
          checklist: { print_quality: true },
          notes: 'Looks good',
        },
        actor,
      );

      expect(result.fromStatus).toBe(OrderStatus.PRODUCTION);
      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_SELF_QC);
      expect(result.evidenceFileIds).toEqual([200]);
      expect(txAssignmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ selfQcEvidenceFileIds: [200] }),
      );
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.PRODUCTION },
        { orderStatus: OrderStatus.SUPPLIER_SELF_QC },
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'supplier_self_qc',
          metadata: expect.objectContaining({
            evidenceFileIds: [200],
            checklist: { print_quality: true },
          }),
        }),
        expect.anything(),
      );
    });

    it('rejects self-qc without evidence', async () => {
      await expect(service.submitSelfQc(7, {}, actor)).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'self_qc_evidence_required',
        }),
      });
    });

    it('rejects evidence not owned by supplier', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PRODUCTION,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        }),
      );
      txFileRepo.findOne.mockResolvedValue(ownedEvidence({ uploadedBy: 999 }));

      await expect(
        service.submitSelfQc(7, { evidenceFileIds: [200] }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'evidence_not_owned' }),
      });
    });

    it('rejects self-qc when order not in production', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PAYMENT_AUTHORIZED,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        }),
      );
      txFileRepo.findOne.mockResolvedValue(ownedEvidence());

      await expect(
        service.submitSelfQc(7, { evidenceFileIds: [200] }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_in_production' }),
      });
    });

    it('rejects self-qc when payment is not authorized', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PRODUCTION,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
        }),
      );

      await expect(
        service.submitSelfQc(7, { evidenceFileIds: [200] }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'payment_not_authorized' }),
      });
    });

    it('rejects self-qc on another supplier assignment', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({
          supplierId: 99,
          decision: SupplierAssignmentDecision.ACCEPTED,
        }),
      );

      await expect(
        service.submitSelfQc(7, { evidenceFileIds: [200] }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_own_assignment' }),
      });
    });

    it('accepts multipart-uploaded evidence via storeMetadata', async () => {
      filesService.storeMetadata.mockResolvedValue({
        id: 301,
        originalName: 'shot.jpg',
        objectKey: 'uploads/general/shot.jpg',
        uploadedBy: 55,
        purpose: FilePurpose.GENERAL,
      } as FileMetadata);
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PRODUCTION,
          paymentAuthorizationStatus: PaymentAuthorizationStatus.AUTHORIZED,
        }),
      );
      txFileRepo.findOne.mockResolvedValue(
        ownedEvidence({ id: 301, originalName: 'shot.jpg' }),
      );

      const file = {
        originalname: 'shot.jpg',
        mimetype: 'image/jpeg',
        size: 500,
        buffer: Buffer.from('fake'),
      } as Express.Multer.File;

      const result = await service.submitSelfQc(7, {}, actor, file);

      expect(filesService.storeMetadata).toHaveBeenCalled();
      expect(result.evidenceFileIds).toEqual([301]);
      expect(result.toStatus).toBe(OrderStatus.SUPPLIER_SELF_QC);
    });
  });

  describe('readyForPickup', () => {
    it('supplier_self_qc → ready_for_dispatch', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.SUPPLIER_SELF_QC }),
      );

      const result = await service.readyForPickup(7, actor);

      expect(result.fromStatus).toBe(OrderStatus.SUPPLIER_SELF_QC);
      expect(result.toStatus).toBe(OrderStatus.READY_FOR_DISPATCH);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.SUPPLIER_SELF_QC },
        { orderStatus: OrderStatus.READY_FOR_DISPATCH },
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'supplier_ready_for_pickup' }),
        expect.anything(),
      );
    });

    it('rejects when not in supplier_self_qc', async () => {
      txAssignmentRepo.findOne.mockResolvedValue(
        baseAssignment({ decision: SupplierAssignmentDecision.ACCEPTED }),
      );
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.PRODUCTION }),
      );

      await expect(service.readyForPickup(7, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_in_self_qc' }),
      });
    });
  });

  describe('getJob artwork gate', () => {
    it('returns signed artwork for own assigned job after QA', async () => {
      const order = baseOrder();
      assignmentRepo.findOne!.mockResolvedValue(baseAssignment({ order }));
      filesService.findById.mockResolvedValue({
        id: 99,
        objectKey: 'uploads/paper/flyer.pdf',
      } as FileMetadata);

      const detail = await service.getJob(7, actor, 'localhost');

      expect(detail.artwork.signedUrl).toBe('https://minio.example/signed');
      expect(detail.artwork.fileMetadataId).toBe(99);
      expect(detail.allowedActions).toEqual(
        expect.arrayContaining(['accept', 'decline']),
      );
      expect(filesService.getPresignedUrlForKey).toHaveBeenCalledWith(
        'uploads/paper/flyer.pdf',
        3600,
        'localhost',
      );
    });

    it('forbids artwork when order is still pre-assignment (e.g. needs_qa)', async () => {
      assignmentRepo.findOne!.mockResolvedValue(
        baseAssignment({
          order: baseOrder({ orderStatus: OrderStatus.NEEDS_QA }),
        }),
      );

      await expect(service.getJob(7, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'artwork_not_released' }),
      });
      expect(filesService.getPresignedUrlForKey).not.toHaveBeenCalled();
    });

    it('forbids job detail for another supplier', async () => {
      assignmentRepo.findOne!.mockResolvedValue(
        baseAssignment({ supplierId: 99, order: baseOrder() }),
      );

      await expect(service.getJob(7, actor)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('getJob privacy and production specs', () => {
    it('never exposes adminNotes (or as specialInstructions) on job detail', async () => {
      const order = baseOrder({
        adminNotes: 'OPS INTERNAL: escalate pricing to finance',
      });
      assignmentRepo.findOne!.mockResolvedValue(baseAssignment({ order }));
      filesService.findById.mockResolvedValue({
        id: 99,
        objectKey: 'uploads/paper/flyer.pdf',
      } as FileMetadata);

      const detail = await service.getJob(7, actor, 'localhost');
      const payload = JSON.stringify(detail);

      expect(payload).not.toContain('OPS INTERNAL');
      expect(payload).not.toContain('adminNotes');
      expect(detail.order).not.toHaveProperty('specialInstructions');
      expect(detail.order).not.toHaveProperty('adminNotes');
    });

    it('includes item-level production specs when present', async () => {
      const order = baseOrder();
      assignmentRepo.findOne!.mockResolvedValue(baseAssignment({ order }));
      const itemFind = jest.fn().mockResolvedValue([
        {
          id: 501,
          category: 'paper',
          categoryName: 'Paper Prints',
          quantity: 50,
          specialInstructions: 'Trim to crop marks',
          fileName: 'flyer.pdf',
          fileMetadataId: 99,
          specValues: [
            {
              specKey: 'paper_size',
              specLabel: 'Paper size',
              value: 'a4',
              displayValue: 'A4',
              optionId: 1,
              optionLabel: 'A4',
            },
            {
              specKey: 'color_mode',
              specLabel: 'Color',
              value: 'cmyk',
              displayValue: 'Full color',
              optionId: 2,
              optionLabel: 'CMYK',
            },
          ],
        },
      ]);
      (ordersRepo.manager as { getRepository: jest.Mock }).getRepository = jest
        .fn()
        .mockReturnValue({ find: itemFind });

      const detail = await service.getJob(7, actor);

      expect(itemFind).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 42 },
          relations: { specValues: true },
        }),
      );
      expect(detail.specs.items).toHaveLength(1);
      expect(detail.specs.items[0]).toMatchObject({
        id: 501,
        category: 'paper',
        quantity: 50,
        specialInstructions: 'Trim to crop marks',
      });
      expect(detail.specs.items[0].specs).toEqual([
        {
          key: 'paper_size',
          label: 'Paper size',
          value: 'a4',
          displayValue: 'A4',
          optionId: 1,
          optionLabel: 'A4',
        },
        {
          key: 'color_mode',
          label: 'Color',
          value: 'cmyk',
          displayValue: 'Full color',
          optionId: 2,
          optionLabel: 'CMYK',
        },
      ]);
    });

    it('rejects getJob for declined assignment', async () => {
      assignmentRepo.findOne!.mockResolvedValue(
        baseAssignment({
          decision: SupplierAssignmentDecision.DECLINED,
          decisionReason: 'no capacity',
          order: baseOrder({ orderStatus: OrderStatus.APPROVED_FOR_MATCHING }),
        }),
      );

      await expect(service.getJob(7, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'assignment_not_active' }),
      });
      expect(filesService.getPresignedUrlForKey).not.toHaveBeenCalled();
    });

    it('rejects getJob for expired assignment', async () => {
      assignmentRepo.findOne!.mockResolvedValue(
        baseAssignment({
          decision: SupplierAssignmentDecision.EXPIRED,
          order: baseOrder(),
        }),
      );

      await expect(service.getJob(7, actor)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'assignment_not_active' }),
      });
    });
  });

  describe('listJobs', () => {
    it('returns only own assignments matching filter', async () => {
      const assigned = baseAssignment({
        id: 1,
        order: baseOrder({ orderStatus: OrderStatus.SUPPLIER_ASSIGNED }),
      });
      const accepted = baseAssignment({
        id: 2,
        decision: SupplierAssignmentDecision.ACCEPTED,
        order: baseOrder({
          id: 43,
          orderId: 'ORD-43',
          orderStatus: OrderStatus.SUPPLIER_ACCEPTED,
        }),
      });
      assignmentRepo.find!.mockResolvedValue([assigned, accepted]);

      const assignedOnly = await service.listJobs(actor, 'assigned');
      expect(assignedOnly).toHaveLength(1);
      expect(assignedOnly[0].id).toBe(1);

      assignmentRepo.find!.mockResolvedValue([assigned, accepted]);
      const all = await service.listJobs(actor, 'all');
      expect(all).toHaveLength(2);
    });

    it('rejects invalid filter', async () => {
      await expect(service.listJobs(actor, 'bogus')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
