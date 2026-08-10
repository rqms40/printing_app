import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import {
  QualityService,
  qualityDecisionToOrderStatus,
} from './quality.service';
import {
  QualityReview,
  QualityReviewDecision,
  QualityReviewRiskLevel,
} from './entities/quality-review.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import {
  QualityDecisionDto,
  QualityDecisionInput,
} from './dto/quality-decision.dto';

describe('qualityDecisionToOrderStatus', () => {
  it('maps needs_correction → client_correction', () => {
    expect(
      qualityDecisionToOrderStatus(QualityReviewDecision.NEEDS_CORRECTION),
    ).toBe(OrderStatus.CLIENT_CORRECTION);
  });

  it('maps proof_approval → proof_approval', () => {
    expect(
      qualityDecisionToOrderStatus(QualityReviewDecision.PROOF_APPROVAL),
    ).toBe(OrderStatus.PROOF_APPROVAL);
  });

  it('maps approved_for_matching → approved_for_matching', () => {
    expect(
      qualityDecisionToOrderStatus(QualityReviewDecision.APPROVED_FOR_MATCHING),
    ).toBe(OrderStatus.APPROVED_FOR_MATCHING);
  });

  it('maps blocked → file_rejected', () => {
    expect(qualityDecisionToOrderStatus(QualityReviewDecision.BLOCKED)).toBe(
      OrderStatus.FILE_REJECTED,
    );
  });
});

describe('QualityService', () => {
  let service: QualityService;
  let reviewRepo: jest.Mocked<Partial<Repository<QualityReview>>>;
  let ordersRepo: jest.Mocked<Partial<Repository<Order>>>;
  let auditService: jest.Mocked<
    Pick<AuditService, 'recordOrderStatusTransition' | 'append'>
  >;
  let filesService: jest.Mocked<Pick<FilesService, 'getPresignedUrl'>>;

  let txOrdersRepo: {
    findOne: jest.Mock;
    update: jest.Mock;
  };
  let txReviewRepo: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let txHistoryRepo: {
    insert: jest.Mock;
  };
  let txFileRepo: {
    findOne: jest.Mock;
  };

  const actor = { userId: 7, role: 'ops_admin' as const };
  const clientActor = { userId: 3, role: 'client' as const };

  function baseOrder(overrides: Partial<Order> = {}): Order {
    return {
      id: 42,
      orderId: 'ORD-42',
      userId: 3,
      orderStatus: OrderStatus.NEEDS_QA,
      category: 'paper',
      quantity: 10,
      totalPrice: 500,
      deliveryFee: 25,
      paymentMethod: 'pilot_credit',
      deliveryOption: 'delivery',
      fileName: 'flyer.pdf',
      fileUrl: null,
      fileMetadataId: 99,
      adminNotes: null,
      declineReason: null,
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      user: {
        id: 3,
        email: 'client@example.com',
        fullName: 'Client User',
      },
      ...overrides,
    } as Order;
  }

  beforeEach(async () => {
    txOrdersRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    txReviewRepo = {
      create: jest.fn((row) => row),
      save: jest.fn(async (row) => ({
        id: 100,
        createdAt: new Date('2026-08-02T00:00:00Z'),
        updatedAt: new Date('2026-08-02T00:00:00Z'),
        ...row,
      })),
    };
    txHistoryRepo = {
      insert: jest.fn().mockResolvedValue(undefined),
    };
    txFileRepo = {
      findOne: jest.fn(),
    };

    reviewRepo = {
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
    };
    ordersRepo = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    auditService = {
      recordOrderStatusTransition: jest.fn().mockResolvedValue({}),
      append: jest.fn().mockResolvedValue({}),
    };
    filesService = {
      getPresignedUrl: jest
        .fn()
        .mockResolvedValue('https://minio.example/signed'),
    };

    const dataSource = {
      transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) =>
        fn({
          getRepository: (entity: unknown) => {
            if (entity === Order) return txOrdersRepo;
            if (entity === QualityReview) return txReviewRepo;
            if (entity === OrderStatusHistory) return txHistoryRepo;
            if (entity === FileMetadata) return txFileRepo;
            throw new Error(`Unexpected repo: ${String(entity)}`);
          },
        }),
      ),
    };

    const module = await Test.createTestingModule({
      providers: [
        QualityService,
        { provide: getRepositoryToken(QualityReview), useValue: reviewRepo },
        { provide: getRepositoryToken(Order), useValue: ordersRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: AuditService, useValue: auditService },
        { provide: FilesService, useValue: filesService },
      ],
    }).compile();

    service = module.get(QualityService);
  });

  describe('recordDecision', () => {
    function dto(
      overrides: Partial<QualityDecisionDto> = {},
    ): QualityDecisionDto {
      return {
        decision: QualityDecisionInput.APPROVED_FOR_MATCHING,
        checklist: { bleed: true, resolution: true },
        riskLevel: QualityReviewRiskLevel.LOW,
        ...overrides,
      };
    }

    it('approved_for_matching → order approved_for_matching', async () => {
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());

      const result = await service.recordDecision(
        42,
        dto({ decision: QualityDecisionInput.APPROVED_FOR_MATCHING }),
        actor,
      );

      expect(result.toStatus).toBe(OrderStatus.APPROVED_FOR_MATCHING);
      expect(result.fromStatus).toBe(OrderStatus.NEEDS_QA);
      expect(result.review.decision).toBe(
        QualityReviewDecision.APPROVED_FOR_MATCHING,
      );
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.NEEDS_QA },
        expect.objectContaining({
          orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
        }),
      );
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: OrderStatus.NEEDS_QA,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
          actorUserId: 7,
          actorRole: 'ops_admin',
        }),
        expect.anything(),
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'quality_review_decision',
          entityType: 'quality_review',
        }),
        expect.anything(),
      );
    });

    it('needs_correction → client_correction and requires correctionRequest', async () => {
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());

      await expect(
        service.recordDecision(
          42,
          dto({ decision: QualityDecisionInput.NEEDS_CORRECTION }),
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      const result = await service.recordDecision(
        42,
        dto({
          decision: QualityDecisionInput.NEEDS_CORRECTION,
          correctionRequest: 'Increase bleed to 3mm',
        }),
        actor,
      );

      expect(result.toStatus).toBe(OrderStatus.CLIENT_CORRECTION);
      expect(result.review.decision).toBe(
        QualityReviewDecision.NEEDS_CORRECTION,
      );
      expect(result.review.correctionRequest).toBe('Increase bleed to 3mm');
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.NEEDS_QA },
        expect.objectContaining({
          orderStatus: OrderStatus.CLIENT_CORRECTION,
          adminNotes: 'Increase bleed to 3mm',
        }),
      );
    });

    it('proof_required → proof_approval with proofRequired true', async () => {
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());

      const result = await service.recordDecision(
        42,
        dto({ decision: QualityDecisionInput.PROOF_REQUIRED }),
        actor,
      );

      expect(result.toStatus).toBe(OrderStatus.PROOF_APPROVAL);
      expect(result.review.decision).toBe(QualityReviewDecision.PROOF_APPROVAL);
      expect(result.review.proofRequired).toBe(true);
    });

    it('proof_approval alias → proof_approval', async () => {
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());

      const result = await service.recordDecision(
        42,
        dto({ decision: QualityDecisionInput.PROOF_APPROVAL }),
        actor,
      );

      expect(result.toStatus).toBe(OrderStatus.PROOF_APPROVAL);
      expect(result.review.decision).toBe(QualityReviewDecision.PROOF_APPROVAL);
      expect(result.review.proofRequired).toBe(true);
    });

    it('blocked → file_rejected terminal', async () => {
      txOrdersRepo.findOne.mockResolvedValue(baseOrder());

      const result = await service.recordDecision(
        42,
        dto({
          decision: QualityDecisionInput.BLOCKED,
          correctionRequest: 'Unprintable rasterization',
        }),
        actor,
      );

      expect(result.toStatus).toBe(OrderStatus.FILE_REJECTED);
      expect(result.review.decision).toBe(QualityReviewDecision.BLOCKED);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.NEEDS_QA },
        expect.objectContaining({
          orderStatus: OrderStatus.FILE_REJECTED,
          declineReason: 'Unprintable rasterization',
        }),
      );
    });

    it('auto-promotes submitted → needs_qa then applies decision', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.SUBMITTED }),
      );

      const result = await service.recordDecision(
        42,
        dto({ decision: QualityDecisionInput.APPROVED_FOR_MATCHING }),
        actor,
      );

      expect(result.autoPromotedFromSubmitted).toBe(true);
      expect(result.fromStatus).toBe(OrderStatus.NEEDS_QA);
      expect(result.toStatus).toBe(OrderStatus.APPROVED_FOR_MATCHING);
      // promote + decision = 2 updates
      expect(txOrdersRepo.update).toHaveBeenCalledTimes(2);
      expect(txOrdersRepo.update).toHaveBeenNthCalledWith(
        1,
        { id: 42, orderStatus: OrderStatus.SUBMITTED },
        { orderStatus: OrderStatus.NEEDS_QA },
      );
      expect(txHistoryRepo.insert).toHaveBeenCalledTimes(2);
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledTimes(2);
    });

    it('rejects decisions when order is not in QA queue', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.PRODUCTION }),
      );

      await expect(
        service.recordDecision(
          42,
          dto({ decision: QualityDecisionInput.APPROVED_FOR_MATCHING }),
          actor,
        ),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'not_in_qa_queue' }),
      });
    });

    it('rejects non-ops actors', async () => {
      await expect(
        service.recordDecision(42, dto(), {
          userId: 1,
          role: 'client',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws NotFound when order missing', async () => {
      txOrdersRepo.findOne.mockResolvedValue(null);

      await expect(
        service.recordDecision(999, dto(), actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getWorkspace', () => {
    it('returns signed artwork URL for ops', async () => {
      ordersRepo.findOne = jest.fn().mockResolvedValue(baseOrder());
      reviewRepo.find = jest.fn().mockResolvedValue([]);

      const workspace = await service.getWorkspace(42, actor, 'localhost');

      expect(filesService.getPresignedUrl).toHaveBeenCalledWith(
        99,
        7,
        true,
        'localhost',
      );
      expect(workspace.artwork.signedUrl).toBe('https://minio.example/signed');
      expect(workspace.allowedDecisions).toContain(
        QualityDecisionInput.APPROVED_FOR_MATCHING,
      );
    });

    it('auto-promotes submitted on open', async () => {
      const submitted = baseOrder({ orderStatus: OrderStatus.SUBMITTED });
      ordersRepo.findOne = jest.fn().mockResolvedValue(submitted);
      txOrdersRepo.findOne.mockResolvedValue({ ...submitted });
      reviewRepo.find = jest.fn().mockResolvedValue([]);

      const workspace = await service.getWorkspace(42, actor);

      expect(workspace.order.orderStatus).toBe(OrderStatus.NEEDS_QA);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.SUBMITTED },
        { orderStatus: OrderStatus.NEEDS_QA },
      );
    });
  });

  describe('getQueue', () => {
    it('returns submitted and needs_qa orders', async () => {
      ordersRepo.find = jest
        .fn()
        .mockResolvedValue([
          baseOrder({ id: 1, orderStatus: OrderStatus.SUBMITTED }),
          baseOrder({ id: 2, orderStatus: OrderStatus.NEEDS_QA }),
        ]);
      reviewRepo.find = jest.fn().mockResolvedValue([]);

      const queue = await service.getQueue();

      expect(queue).toHaveLength(2);
      expect(ordersRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            orderStatus: expect.anything(),
          },
        }),
      );
    });
  });

  describe('resubmitCorrection', () => {
    function ownedFile(overrides: Partial<FileMetadata> = {}): FileMetadata {
      return {
        id: 200,
        originalName: 'revised.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        url: 'https://minio.example/revised.pdf',
        objectKey: 'uploads/general/2026/08/revised.pdf',
        uploadedBy: 3,
        purpose: FilePurpose.GENERAL,
        ...overrides,
      } as FileMetadata;
    }

    it('client owner: client_correction → needs_qa with new artwork', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.CLIENT_CORRECTION,
          userId: 3,
          fileMetadataId: 99,
        }),
      );
      txFileRepo.findOne.mockResolvedValue(ownedFile());

      const result = await service.resubmitCorrection(
        42,
        { fileMetadataId: 200, notes: 'Fixed bleed' },
        clientActor,
      );

      expect(result.fromStatus).toBe(OrderStatus.CLIENT_CORRECTION);
      expect(result.toStatus).toBe(OrderStatus.NEEDS_QA);
      expect(result.order.fileMetadataId).toBe(200);
      expect(result.order.fileName).toBe('revised.pdf');
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.CLIENT_CORRECTION },
        expect.objectContaining({
          orderStatus: OrderStatus.NEEDS_QA,
          fileMetadataId: 200,
          fileName: 'revised.pdf',
        }),
      );
      expect(txHistoryRepo.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          fromStatus: OrderStatus.CLIENT_CORRECTION,
          toStatus: OrderStatus.NEEDS_QA,
          changedByUserId: 3,
        }),
      );
      expect(auditService.recordOrderStatusTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          actorRole: 'client',
          toStatus: OrderStatus.NEEDS_QA,
        }),
        expect.anything(),
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'client_correction_resubmit' }),
        expect.anything(),
      );
    });

    it('rejects non-owner client', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.CLIENT_CORRECTION,
          userId: 3,
        }),
      );

      await expect(
        service.resubmitCorrection(
          42,
          { fileMetadataId: 200 },
          { userId: 99, role: 'client' },
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects file not owned by client', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.CLIENT_CORRECTION,
          userId: 3,
        }),
      );
      txFileRepo.findOne.mockResolvedValue(ownedFile({ uploadedBy: 999 }));

      await expect(
        service.resubmitCorrection(42, { fileMetadataId: 200 }, clientActor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'file_not_owned' }),
      });
    });

    it('rejects when order is not in client_correction', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({ orderStatus: OrderStatus.NEEDS_QA, userId: 3 }),
      );

      await expect(
        service.resubmitCorrection(42, { fileMetadataId: 200 }, clientActor),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'not_awaiting_correction',
        }),
      });
    });
  });

  describe('approveProof', () => {
    it('client owner: proof_approval → approved_for_matching', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PROOF_APPROVAL,
          userId: 3,
        }),
      );

      const result = await service.approveProof(42, clientActor);

      expect(result.fromStatus).toBe(OrderStatus.PROOF_APPROVAL);
      expect(result.toStatus).toBe(OrderStatus.APPROVED_FOR_MATCHING);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.PROOF_APPROVAL },
        { orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'client_proof_approve' }),
        expect.anything(),
      );
    });

    it('rejects non-owner client', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PROOF_APPROVAL,
          userId: 3,
        }),
      );

      await expect(
        service.approveProof(42, { userId: 99, role: 'client' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects wrong status', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.CLIENT_CORRECTION,
          userId: 3,
        }),
      );

      await expect(service.approveProof(42, clientActor)).rejects.toMatchObject(
        {
          response: expect.objectContaining({ code: 'not_awaiting_proof' }),
        },
      );
    });
  });

  describe('rejectProof', () => {
    it('client owner: proof_approval → client_correction', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PROOF_APPROVAL,
          userId: 3,
        }),
      );

      const result = await service.rejectProof(
        42,
        { reason: 'Colors look off' },
        clientActor,
      );

      expect(result.fromStatus).toBe(OrderStatus.PROOF_APPROVAL);
      expect(result.toStatus).toBe(OrderStatus.CLIENT_CORRECTION);
      expect(txOrdersRepo.update).toHaveBeenCalledWith(
        { id: 42, orderStatus: OrderStatus.PROOF_APPROVAL },
        expect.objectContaining({
          orderStatus: OrderStatus.CLIENT_CORRECTION,
          adminNotes: 'Colors look off',
        }),
      );
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'client_proof_reject' }),
        expect.anything(),
      );
    });

    it('rejects non-owner client', async () => {
      txOrdersRepo.findOne.mockResolvedValue(
        baseOrder({
          orderStatus: OrderStatus.PROOF_APPROVAL,
          userId: 3,
        }),
      );

      await expect(
        service.rejectProof(42, {}, { userId: 99, role: 'client' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
