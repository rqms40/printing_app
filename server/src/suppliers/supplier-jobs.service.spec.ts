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
} from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductionMilestone } from './dto/production-status.dto';
import { QualityService } from '../quality/quality.service';
import { AuditEvent } from '../audit/entities/audit-event.entity';

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
    save: jest.Mock;
  };
  let txOrdersRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
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
      save: jest.fn(async (row) => row),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txOrdersRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txHistoryRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
    };
    txFileRepo = {
      findOne: jest.fn(),
    };
    const txAuditRepo = {
      find: jest.fn().mockResolvedValue([]),
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
    const qualityService = {
      recordPickupQaSubmission: jest.fn().mockResolvedValue({
        checklistResults: {
          quantity_match: { pass: true },
          specification_match: { pass: true },
          visible_defects: { pass: true },
          packaging_integrity: { pass: true },
          documentation: { pass: true },
          supplier_sign_off: { pass: true },
        },
        submission: { id: 1 },
      }),
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
            getRepository: jest.fn((entity: unknown) => {
              if (entity === AuditEvent) return txAuditRepo;
              return { find: jest.fn().mockResolvedValue([]) };
            }),
            transaction: jest.fn(async (fn: (m: unknown) => unknown) =>
              fn({
                getRepository: (entity: unknown) => {
                  if (entity === SupplierAssignment) return txAssignmentRepo;
                  if (entity === Order) return txOrdersRepo;
                  if (entity === OrderStatusHistory) return txHistoryRepo;
                  if (entity === FileMetadata) return txFileRepo;
                  if (entity === AuditEvent) return txAuditRepo;
                  return { find: jest.fn().mockResolvedValue([]) };
                },
              }),
            ),
          },
        },
        { provide: AuditService, useValue: auditService },
        { provide: FilesService, useValue: filesService },
        { provide: NotificationsService, useValue: notificationsService },
        { provide: QualityService, useValue: qualityService },
      ],
    }).compile();

    service = moduleRef.get(SupplierJobsService);
  });

  describe('acceptJob', () => {
    const futureDate = new Date(
      Date.now() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();

    it('accepts pending assignment: ACCEPTED + supplier_accepted + freezes price/promised', async () => {
      const assignment = baseAssignment();
      const order = baseOrder();
      txAssignmentRepo.findOne.mockResolvedValue(assignment);
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
          finalTotalMinor: '152500', // 150000 goods + 2500 delivery
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

    const fullChecklist = {
      quantity_match: true,
      specification_match: true,
      visible_defects: true,
      packaging_integrity: true,
      documentation: true,
      supplier_sign_off: {
        pass: true,
        signatureData: JSON.stringify({
          format: 'gridgo-signature-v1',
          points: [
            [1, 2],
            [3, 4],
          ],
        }),
      },
    };

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
          checklist: fullChecklist,
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

    it('rejects self-qc without pickup QA checklist', async () => {
      await expect(
        service.submitSelfQc(7, { evidenceFileIds: [200] }, actor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'pickup_qa_checklist_required',
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
        service.submitSelfQc(
          7,
          { evidenceFileIds: [200], checklist: fullChecklist },
          actor,
        ),
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
        service.submitSelfQc(
          7,
          { evidenceFileIds: [200], checklist: fullChecklist },
          actor,
        ),
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
        service.submitSelfQc(
          7,
          { evidenceFileIds: [200], checklist: fullChecklist },
          actor,
        ),
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
        service.submitSelfQc(
          7,
          { evidenceFileIds: [200], checklist: fullChecklist },
          actor,
        ),
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

      const result = await service.submitSelfQc(
        7,
        { checklist: fullChecklist },
        actor,
        file,
      );

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
