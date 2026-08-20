import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import {
  assertTransition,
  type TransitionActor,
} from '../orders/order-status-transition';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import {
  QualityReview,
  QualityReviewDecision,
  QualityReviewRiskLevel,
} from './entities/quality-review.entity';
import {
  QualityDecisionDto,
  QualityDecisionInput,
} from './dto/quality-decision.dto';
import { ResubmitCorrectionDto } from './dto/resubmit-correction.dto';
import { RejectProofDto } from './dto/reject-proof.dto';
import { PickupQaSubmission } from './entities/pickup-qa-submission.entity';
import {
  assertPickupQaChecklistPassed,
  PICKUP_QA_CHECKLIST_ITEMS,
  type PickupQaActorRole,
  type PickupQaChecklistResults,
} from './pickup-qa-checklist';
import type { EntityManager } from 'typeorm';
import { MatchingService } from '../matching/matching.service';

/** Queue statuses — submitted is auto-promoted into needs_qa on workspace/decision. */
const QA_QUEUE_STATUSES: OrderStatus[] = [
  OrderStatus.SUBMITTED,
  OrderStatus.NEEDS_QA,
];

/** Default Ops checklist keys (PRD §7.3 / §5.2). */
export const DEFAULT_QA_CHECKLIST_KEYS = [
  'product_compatibility',
  'dimensions',
  'material',
  'quantity',
  'finish',
  'bleed',
  'resolution',
  'color_mode',
  'safe_area',
  'deadline_realism',
  'address',
  'davao_zone_eligibility',
] as const;

export type QualityActor = {
  userId: number;
  role: TransitionActor;
};

export type QaQueueItem = {
  id: number;
  orderId: string;
  orderStatus: OrderStatus;
  category: string;
  quantity: number;
  totalPrice: number;
  fileName: string | null;
  fileMetadataId: number | null;
  userId: number;
  userEmail: string | null;
  userFullName: string | null;
  createdAt: Date;
  updatedAt: Date;
  latestReview: {
    id: number;
    decision: QualityReviewDecision;
    riskLevel: QualityReviewRiskLevel;
    createdAt: Date;
  } | null;
};

export type QaWorkspaceDetail = {
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
    category: string;
    quantity: number;
    totalPrice: number;
    deliveryFee: number;
    paymentMethod: string;
    deliveryOption: string;
    fileName: string | null;
    fileUrl: string | null;
    fileMetadataId: number | null;
    adminNotes: string | null;
    declineReason: string | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
      id: number;
      email: string | null;
      fullName: string | null;
    } | null;
  };
  artwork: {
    fileMetadataId: number | null;
    fileName: string | null;
    signedUrl: string | null;
  };
  checklistKeys: readonly string[];
  reviews: Array<{
    id: number;
    decision: QualityReviewDecision;
    riskLevel: QualityReviewRiskLevel;
    checklistResults: Record<string, unknown>;
    correctionRequest: string | null;
    proofRequired: boolean;
    evidence: Record<string, unknown> | null;
    reviewerId: number;
    createdAt: Date;
  }>;
  allowedDecisions: QualityDecisionInput[];
};

export type QualityDecisionResult = {
  review: QualityReview;
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
  };
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  autoPromotedFromSubmitted: boolean;
};

export type ClientQaActionResult = {
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
    fileMetadataId: number | null;
    fileName: string | null;
    fileUrl: string | null;
  };
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
};

/** Artwork purposes allowed when client revises a file for QA. */
const CLIENT_ARTWORK_PURPOSES = new Set<FilePurpose>([
  FilePurpose.GENERAL,
  FilePurpose.PAPER,
]);

function mapDecisionInput(input: QualityDecisionInput): QualityReviewDecision {
  switch (input) {
    case QualityDecisionInput.NEEDS_CORRECTION:
      return QualityReviewDecision.NEEDS_CORRECTION;
    case QualityDecisionInput.PROOF_REQUIRED:
    case QualityDecisionInput.PROOF_APPROVAL:
      return QualityReviewDecision.PROOF_APPROVAL;
    case QualityDecisionInput.APPROVED_FOR_MATCHING:
      return QualityReviewDecision.APPROVED_FOR_MATCHING;
    case QualityDecisionInput.BLOCKED:
      return QualityReviewDecision.BLOCKED;
    default: {
      const _exhaustive: never = input;
      throw new BadRequestException(`Unknown QA decision: ${_exhaustive}`);
    }
  }
}

/** Map stored QualityReview decision → order status. */
export function qualityDecisionToOrderStatus(
  decision: QualityReviewDecision,
): OrderStatus {
  switch (decision) {
    case QualityReviewDecision.NEEDS_CORRECTION:
      return OrderStatus.CLIENT_CORRECTION;
    case QualityReviewDecision.PROOF_APPROVAL:
      return OrderStatus.PROOF_APPROVAL;
    case QualityReviewDecision.APPROVED_FOR_MATCHING:
      return OrderStatus.APPROVED_FOR_MATCHING;
    case QualityReviewDecision.BLOCKED:
      return OrderStatus.FILE_REJECTED;
    default: {
      const _exhaustive: never = decision;
      throw new BadRequestException(
        `Unmapped QA decision: ${_exhaustive as string}`,
      );
    }
  }
}

function assertOpsActor(actor: QualityActor): void {
  if (actor.role !== 'ops_admin' && actor.role !== 'super_admin') {
    throw new BadRequestException(
      `Actor ${actor.role} cannot perform Ops QA decisions`,
    );
  }
  if (!Number.isInteger(actor.userId) || actor.userId <= 0) {
    throw new BadRequestException('QA actor user id is required');
  }
}

function assertClientOrOpsActor(actor: QualityActor): void {
  if (
    actor.role !== 'client' &&
    actor.role !== 'ops_admin' &&
    actor.role !== 'super_admin'
  ) {
    throw new BadRequestException(
      `Actor ${actor.role} cannot perform client QA actions`,
    );
  }
  if (!Number.isInteger(actor.userId) || actor.userId <= 0) {
    throw new BadRequestException('QA actor user id is required');
  }
}

function isOpsRole(role: TransitionActor): boolean {
  return role === 'ops_admin' || role === 'super_admin';
}

@Injectable()
export class QualityService {
  private readonly logger = new Logger(QualityService.name);

  constructor(
    @InjectRepository(QualityReview)
    private readonly reviewRepo: Repository<QualityReview>,
    @InjectRepository(PickupQaSubmission)
    private readonly pickupQaRepo: Repository<PickupQaSubmission>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService,
    @Optional() private readonly matchingService?: MatchingService,
  ) {}

  /** Canonical Pickup QA checklist definition for clients / admin UI. */
  getPickupQaChecklistDefinition() {
    return {
      title: 'Pickup QA Checklist',
      description:
        'Physical quality gate before an order leaves supplier custody. Do not accept an order that fails any line without flagging it first.',
      items: PICKUP_QA_CHECKLIST_ITEMS,
    };
  }

  /**
   * Persist a fully-passed supplier/rider pickup QA checklist.
   * Call inside an existing transaction via `manager`, or without for standalone.
   */
  async recordPickupQaSubmission(
    input: {
      orderId: number;
      actorRole: PickupQaActorRole;
      actorUserId: number;
      checklist: Record<string, unknown>;
      notes?: string | null;
      evidenceFileIds?: number[];
      supplierAssignmentId?: number | null;
      deliveryAssignmentId?: number | null;
    },
    manager?: EntityManager,
  ): Promise<{
    submission: PickupQaSubmission;
    checklistResults: PickupQaChecklistResults;
  }> {
    let checklistResults: PickupQaChecklistResults;
    try {
      checklistResults = assertPickupQaChecklistPassed(input.checklist);
    } catch (err) {
      throw new BadRequestException({
        code: 'pickup_qa_checklist_incomplete',
        message:
          err instanceof Error
            ? err.message
            : 'Pickup QA checklist incomplete — all checks must pass',
      });
    }

    const repo = manager
      ? manager.getRepository(PickupQaSubmission)
      : this.pickupQaRepo;

    const submission = await repo.save(
      repo.create({
        orderId: input.orderId,
        actorRole: input.actorRole,
        actorUserId: input.actorUserId,
        supplierAssignmentId: input.supplierAssignmentId ?? null,
        deliveryAssignmentId: input.deliveryAssignmentId ?? null,
        checklistResults,
        notes: input.notes?.trim() || null,
        evidenceFileIds: input.evidenceFileIds ?? [],
      }),
    );

    if (manager) {
      await this.auditService.append(
        {
          actorId: input.actorUserId,
          actorRole: input.actorRole,
          action: 'pickup_qa_submitted',
          entityType: 'pickup_qa_submission',
          entityId: String(submission.id),
          orderId: input.orderId,
          reason: `${input.actorRole} completed Pickup QA checklist`,
          metadata: {
            checklistResults,
            supplierAssignmentId: input.supplierAssignmentId ?? null,
            deliveryAssignmentId: input.deliveryAssignmentId ?? null,
            evidenceFileIds: input.evidenceFileIds ?? [],
          },
        },
        manager,
      );
    } else {
      await this.auditService.append({
        actorId: input.actorUserId,
        actorRole: input.actorRole,
        action: 'pickup_qa_submitted',
        entityType: 'pickup_qa_submission',
        entityId: String(submission.id),
        orderId: input.orderId,
        reason: `${input.actorRole} completed Pickup QA checklist`,
        metadata: {
          checklistResults,
          supplierAssignmentId: input.supplierAssignmentId ?? null,
          deliveryAssignmentId: input.deliveryAssignmentId ?? null,
          evidenceFileIds: input.evidenceFileIds ?? [],
        },
      });
    }

    return { submission, checklistResults };
  }

  /** Ops/superadmin: list supplier + rider pickup QA submissions (newest first). */
  async getPickupQaQueue(limit = 100) {
    const take = Math.min(Math.max(limit, 1), 200);
    const rows = await this.pickupQaRepo.find({
      relations: ['order', 'order.user', 'actor'],
      order: { createdAt: 'DESC' },
      take,
    });

    return rows.map((row) => ({
      id: row.id,
      orderId: row.orderId,
      orderPublicId: row.order?.orderId ?? null,
      orderStatus: row.order?.orderStatus ?? null,
      actorRole: row.actorRole,
      actorUserId: row.actorUserId,
      actorName: row.actor?.fullName ?? row.actor?.email ?? null,
      actorEmail: row.actor?.email ?? null,
      supplierAssignmentId: row.supplierAssignmentId,
      deliveryAssignmentId: row.deliveryAssignmentId,
      checklistResults: row.checklistResults,
      notes: row.notes,
      evidenceFileIds: row.evidenceFileIds ?? [],
      createdAt: row.createdAt,
      clientName: row.order?.user?.fullName ?? null,
      clientEmail: row.order?.user?.email ?? null,
    }));
  }

  async getPickupQaSubmission(id: number) {
    const row = await this.pickupQaRepo.findOne({
      where: { id },
      relations: ['order', 'order.user', 'actor'],
    });
    if (!row) {
      throw new NotFoundException(`Pickup QA submission ${id} not found`);
    }
    return {
      id: row.id,
      orderId: row.orderId,
      orderPublicId: row.order?.orderId ?? null,
      orderStatus: row.order?.orderStatus ?? null,
      actorRole: row.actorRole,
      actorUserId: row.actorUserId,
      actorName: row.actor?.fullName ?? row.actor?.email ?? null,
      actorEmail: row.actor?.email ?? null,
      supplierAssignmentId: row.supplierAssignmentId,
      deliveryAssignmentId: row.deliveryAssignmentId,
      checklistResults: row.checklistResults,
      checklistDefinition: PICKUP_QA_CHECKLIST_ITEMS,
      notes: row.notes,
      evidenceFileIds: row.evidenceFileIds ?? [],
      createdAt: row.createdAt,
      clientName: row.order?.user?.fullName ?? null,
      clientEmail: row.order?.user?.email ?? null,
    };
  }

  /**
   * Orders awaiting Ops QA. Includes `submitted` (auto-promote on open/decision)
   * and `needs_qa`.
   */
  async getQueue(): Promise<QaQueueItem[]> {
    const orders = await this.ordersRepo.find({
      where: { orderStatus: In(QA_QUEUE_STATUSES) },
      relations: ['user'],
      order: { createdAt: 'ASC' },
    });

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const reviews = await this.reviewRepo.find({
      where: { orderId: In(orderIds) },
      order: { createdAt: 'DESC' },
    });
    const latestByOrder = new Map<number, QualityReview>();
    for (const review of reviews) {
      if (!latestByOrder.has(review.orderId)) {
        latestByOrder.set(review.orderId, review);
      }
    }

    return orders.map((order) => {
      const latest = latestByOrder.get(order.id) ?? null;
      return {
        id: order.id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        category: order.category,
        quantity: order.quantity,
        totalPrice: Number(order.totalPrice),
        fileName: order.fileName ?? null,
        fileMetadataId: order.fileMetadataId ?? null,
        userId: order.userId,
        userEmail: order.user?.email ?? null,
        userFullName: order.user?.fullName ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        latestReview: latest
          ? {
              id: latest.id,
              decision: latest.decision,
              riskLevel: latest.riskLevel,
              createdAt: latest.createdAt,
            }
          : null,
      };
    });
  }

  /**
   * Workspace detail for a single order. Auto-promotes submitted → needs_qa
   * so the queue reflects active QA work. Artwork signed URL is ops-only
   * (this endpoint is role-gated; suppliers never reach it).
   */
  async getWorkspace(
    orderId: number,
    actor: QualityActor,
    requestHostname?: string,
  ): Promise<QaWorkspaceDetail> {
    assertOpsActor(actor);

    let order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: ['user'],
    });
    if (!order) throw new NotFoundException('Order not found');

    if (order.orderStatus === OrderStatus.SUBMITTED) {
      order = await this.promoteSubmittedToNeedsQa(order, actor);
    }

    const reviews = await this.reviewRepo.find({
      where: { orderId: order.id },
      order: { createdAt: 'DESC' },
    });

    let signedUrl: string | null = null;
    if (order.fileMetadataId != null) {
      try {
        signedUrl = await this.filesService.getPresignedUrl(
          order.fileMetadataId,
          actor.userId,
          true,
          requestHostname,
        );
      } catch {
        signedUrl = null;
      }
    }

    const qaOpen =
      order.orderStatus === OrderStatus.NEEDS_QA ||
      order.orderStatus === OrderStatus.SUBMITTED;

    return {
      order: {
        id: order.id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        category: order.category,
        quantity: order.quantity,
        totalPrice: Number(order.totalPrice),
        deliveryFee: Number(order.deliveryFee),
        paymentMethod: order.paymentMethod,
        deliveryOption: order.deliveryOption,
        fileName: order.fileName ?? null,
        fileUrl: order.fileUrl ?? null,
        fileMetadataId: order.fileMetadataId ?? null,
        adminNotes: order.adminNotes ?? null,
        declineReason: order.declineReason ?? null,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        user: order.user
          ? {
              id: order.user.id,
              email: order.user.email ?? null,
              fullName: order.user.fullName ?? null,
            }
          : null,
      },
      artwork: {
        fileMetadataId: order.fileMetadataId ?? null,
        fileName: order.fileName ?? null,
        signedUrl,
      },
      checklistKeys: DEFAULT_QA_CHECKLIST_KEYS,
      reviews: reviews.map((r) => ({
        id: r.id,
        decision: r.decision,
        riskLevel: r.riskLevel,
        checklistResults: r.checklistResults ?? {},
        correctionRequest: r.correctionRequest,
        proofRequired: r.proofRequired,
        evidence: r.evidence,
        reviewerId: r.reviewerId,
        createdAt: r.createdAt,
      })),
      allowedDecisions: qaOpen
        ? [
            QualityDecisionInput.NEEDS_CORRECTION,
            QualityDecisionInput.PROOF_REQUIRED,
            QualityDecisionInput.APPROVED_FOR_MATCHING,
            QualityDecisionInput.BLOCKED,
          ]
        : [],
    };
  }

  /**
   * Record a QualityReview and transition the order status (with history + audit).
   */
  async recordDecision(
    orderId: number,
    dto: QualityDecisionDto,
    actor: QualityActor,
  ): Promise<QualityDecisionResult> {
    assertOpsActor(actor);

    const storedDecision = mapDecisionInput(dto.decision);
    const targetStatus = qualityDecisionToOrderStatus(storedDecision);
    const proofRequired =
      storedDecision === QualityReviewDecision.PROOF_APPROVAL ||
      dto.proofRequired === true;

    if (storedDecision === QualityReviewDecision.NEEDS_CORRECTION) {
      const text = dto.correctionRequest?.trim();
      if (!text) {
        throw new BadRequestException({
          code: 'correction_request_required',
          message:
            'correctionRequest is required when decision is needs_correction',
        });
      }
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const reviewRepo = manager.getRepository(QualityReview);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await ordersRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      let currentStatus = locked.orderStatus;
      let autoPromotedFromSubmitted = false;
      const actorRole = actor.role;

      // submitted → needs_qa before QA decision edges apply
      if (currentStatus === OrderStatus.SUBMITTED) {
        assertTransition(
          OrderStatus.SUBMITTED,
          OrderStatus.NEEDS_QA,
          actorRole,
        );
        const promoteResult = await ordersRepo.update(
          { id: locked.id, orderStatus: OrderStatus.SUBMITTED },
          { orderStatus: OrderStatus.NEEDS_QA },
        );
        if (promoteResult.affected != null && promoteResult.affected !== 1) {
          throw new BadRequestException('Order changed during QA promote');
        }
        await historyRepo.insert({
          orderId: locked.id,
          fromStatus: OrderStatus.SUBMITTED,
          toStatus: OrderStatus.NEEDS_QA,
          changedByUserId: actor.userId,
          notes: 'Auto-promoted to needs_qa for Ops QA decision',
        });
        await this.auditService.recordOrderStatusTransition(
          {
            orderId: locked.id,
            fromStatus: OrderStatus.SUBMITTED,
            toStatus: OrderStatus.NEEDS_QA,
            actorUserId: actor.userId,
            actorRole,
            reason: 'Auto-promoted to needs_qa for Ops QA decision',
            metadata: { source: 'quality.recordDecision' },
          },
          manager,
        );
        currentStatus = OrderStatus.NEEDS_QA;
        autoPromotedFromSubmitted = true;
      }

      if (currentStatus !== OrderStatus.NEEDS_QA) {
        throw new BadRequestException({
          code: 'not_in_qa_queue',
          message: `Order status ${currentStatus} is not open for QA decision (expected needs_qa)`,
        });
      }

      assertTransition(currentStatus, targetStatus, actorRole);

      const correctionText =
        dto.correctionRequest?.trim() ||
        (storedDecision === QualityReviewDecision.BLOCKED
          ? 'Blocked by Ops QA'
          : null);

      const review = reviewRepo.create({
        orderId: locked.id,
        reviewerId: actor.userId,
        checklistResults: dto.checklist ?? {},
        decision: storedDecision,
        riskLevel: dto.riskLevel ?? QualityReviewRiskLevel.LOW,
        correctionRequest:
          storedDecision === QualityReviewDecision.NEEDS_CORRECTION ||
          storedDecision === QualityReviewDecision.BLOCKED
            ? correctionText
            : dto.correctionRequest?.trim() || null,
        proofRequired,
        evidence: dto.evidence ?? null,
      });
      const savedReview = await reviewRepo.save(review);

      const orderUpdates: Partial<Order> = {
        orderStatus: targetStatus,
      };
      if (storedDecision === QualityReviewDecision.BLOCKED) {
        orderUpdates.declineReason = correctionText || 'Blocked by Ops QA';
      }
      if (storedDecision === QualityReviewDecision.NEEDS_CORRECTION) {
        orderUpdates.adminNotes = correctionText || undefined;
      }

      const updateResult = await ordersRepo.update(
        { id: locked.id, orderStatus: currentStatus },
        orderUpdates,
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during QA decision');
      }

      const reason = `Ops QA decision: ${storedDecision}`;
      await historyRepo.insert({
        orderId: locked.id,
        fromStatus: currentStatus,
        toStatus: targetStatus,
        changedByUserId: actor.userId,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus: currentStatus,
          toStatus: targetStatus,
          actorUserId: actor.userId,
          actorRole,
          reason,
          metadata: {
            source: 'quality.recordDecision',
            qualityReviewId: savedReview.id,
            decision: storedDecision,
            riskLevel: savedReview.riskLevel,
            proofRequired,
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole,
          action: 'quality_review_decision',
          entityType: 'quality_review',
          entityId: String(savedReview.id),
          orderId: locked.id,
          fromState: currentStatus,
          toState: targetStatus,
          reason,
          metadata: {
            decision: storedDecision,
            riskLevel: savedReview.riskLevel,
            proofRequired,
            checklist: dto.checklist ?? {},
          },
        },
        manager,
      );

      return {
        review: savedReview,
        order: {
          id: locked.id,
          orderId: locked.orderId,
          orderStatus: targetStatus,
        },
        fromStatus: currentStatus,
        toStatus: targetStatus,
        autoPromotedFromSubmitted,
      };
    });

    return result;
  }

  /**
   * Client (order owner) revises artwork after Ops requested correction.
   * Transitions `client_correction` → `needs_qa` and binds the new file.
   * Upload first via POST /files/upload, then pass fileMetadataId.
   */
  async resubmitCorrection(
    orderId: number,
    dto: ResubmitCorrectionDto,
    actor: QualityActor,
  ): Promise<ClientQaActionResult> {
    assertClientOrOpsActor(actor);

    const fileId = Number(dto.fileMetadataId);
    if (!Number.isInteger(fileId) || fileId <= 0) {
      throw new BadRequestException({
        code: 'invalid_file_metadata_id',
        message: 'fileMetadataId must be a positive integer',
      });
    }

    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);
      const fileRepo = manager.getRepository(FileMetadata);

      const locked = await ordersRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      this.assertClientOrderAccess(locked, actor);

      if (locked.orderStatus !== OrderStatus.CLIENT_CORRECTION) {
        throw new BadRequestException({
          code: 'not_awaiting_correction',
          message: `Order status ${locked.orderStatus} is not open for correction resubmit (expected client_correction)`,
        });
      }

      const file = await fileRepo.findOne({
        where: { id: fileId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!file) {
        throw new BadRequestException({
          code: 'invalid_file_metadata_id',
          message: 'Uploaded file not found',
        });
      }
      // Client must own the upload; ops may attach any valid artwork purpose.
      if (!isOpsRole(actor.role) && file.uploadedBy !== actor.userId) {
        throw new ForbiddenException({
          code: 'file_not_owned',
          message: 'You can only resubmit files you uploaded',
        });
      }
      if (!CLIENT_ARTWORK_PURPOSES.has(file.purpose)) {
        throw new BadRequestException({
          code: 'invalid_file_purpose',
          message: `File purpose '${file.purpose}' is not valid artwork for correction`,
        });
      }
      if (!file.objectKey?.trim()) {
        throw new BadRequestException({
          code: 'file_missing_storage',
          message: 'Uploaded file has no storage object',
        });
      }

      const fromStatus = OrderStatus.CLIENT_CORRECTION;
      const toStatus = OrderStatus.NEEDS_QA;
      assertTransition(fromStatus, toStatus, actor.role);

      const notes =
        dto.notes?.trim() || 'Client resubmitted revised artwork for QA';

      const previousFileMetadataId = locked.fileMetadataId;
      const updateResult = await ordersRepo.update(
        { id: locked.id, orderStatus: fromStatus },
        {
          orderStatus: toStatus,
          fileMetadataId: file.id,
          fileName: file.originalName,
          fileUrl: file.url,
        },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException(
          'Order changed during correction resubmit',
        );
      }

      await historyRepo.insert({
        orderId: locked.id,
        fromStatus,
        toStatus,
        changedByUserId: actor.userId,
        notes,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason: notes,
          metadata: {
            source: 'quality.resubmitCorrection',
            fileMetadataId: file.id,
            previousFileMetadataId,
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'client_correction_resubmit',
          entityType: 'order',
          entityId: String(locked.id),
          orderId: locked.id,
          fromState: fromStatus,
          toState: toStatus,
          reason: notes,
          metadata: {
            fileMetadataId: file.id,
            previousFileMetadataId,
          },
        },
        manager,
      );

      return {
        order: {
          id: locked.id,
          orderId: locked.orderId,
          orderStatus: toStatus,
          fileMetadataId: file.id,
          fileName: file.originalName,
          fileUrl: file.url,
        },
        fromStatus,
        toStatus,
      };
    });
  }

  /**
   * Client approves proof artwork → `approved_for_matching`.
   */
  async approveProof(
    orderId: number,
    actor: QualityActor,
  ): Promise<ClientQaActionResult> {
    assertClientOrOpsActor(actor);

    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await ordersRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      this.assertClientOrderAccess(locked, actor);

      if (locked.orderStatus !== OrderStatus.PROOF_APPROVAL) {
        throw new BadRequestException({
          code: 'not_awaiting_proof',
          message: `Order status ${locked.orderStatus} is not open for proof approval (expected proof_approval)`,
        });
      }

      const fromStatus = OrderStatus.PROOF_APPROVAL;
      const toStatus = OrderStatus.APPROVED_FOR_MATCHING;
      assertTransition(fromStatus, toStatus, actor.role);

      const reason = 'Client approved proof';
      const updateResult = await ordersRepo.update(
        { id: locked.id, orderStatus: fromStatus },
        { orderStatus: toStatus },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during proof approval');
      }

      await historyRepo.insert({
        orderId: locked.id,
        fromStatus,
        toStatus,
        changedByUserId: actor.userId,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason,
          metadata: { source: 'quality.approveProof' },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'client_proof_approve',
          entityType: 'order',
          entityId: String(locked.id),
          orderId: locked.id,
          fromState: fromStatus,
          toState: toStatus,
          reason,
        },
        manager,
      );

      return {
        order: {
          id: locked.id,
          orderId: locked.orderId,
          orderStatus: toStatus,
          fileMetadataId: locked.fileMetadataId ?? null,
          fileName: locked.fileName ?? null,
          fileUrl: locked.fileUrl ?? null,
        },
        fromStatus,
        toStatus,
      };
    });
  }

  /**
   * Client rejects proof → `client_correction` (revise artwork path).
   * Ops may instead send `needs_qa` via Ops QA decision / status tools.
   */
  async rejectProof(
    orderId: number,
    dto: RejectProofDto,
    actor: QualityActor,
  ): Promise<ClientQaActionResult> {
    assertClientOrOpsActor(actor);

    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await ordersRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      this.assertClientOrderAccess(locked, actor);

      if (locked.orderStatus !== OrderStatus.PROOF_APPROVAL) {
        throw new BadRequestException({
          code: 'not_awaiting_proof',
          message: `Order status ${locked.orderStatus} is not open for proof rejection (expected proof_approval)`,
        });
      }

      const fromStatus = OrderStatus.PROOF_APPROVAL;
      const toStatus = OrderStatus.CLIENT_CORRECTION;
      assertTransition(fromStatus, toStatus, actor.role);

      const reason =
        dto.reason?.trim() || 'Client rejected proof; revision required';

      const updateResult = await ordersRepo.update(
        { id: locked.id, orderStatus: fromStatus },
        {
          orderStatus: toStatus,
          adminNotes: reason,
        },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during proof rejection');
      }

      await historyRepo.insert({
        orderId: locked.id,
        fromStatus,
        toStatus,
        changedByUserId: actor.userId,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason,
          metadata: { source: 'quality.rejectProof' },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'client_proof_reject',
          entityType: 'order',
          entityId: String(locked.id),
          orderId: locked.id,
          fromState: fromStatus,
          toState: toStatus,
          reason,
        },
        manager,
      );

      return {
        order: {
          id: locked.id,
          orderId: locked.orderId,
          orderStatus: toStatus,
          fileMetadataId: locked.fileMetadataId ?? null,
          fileName: locked.fileName ?? null,
          fileUrl: locked.fileUrl ?? null,
        },
        fromStatus,
        toStatus,
      };
    });
  }

  /** Clients act only on their own orders; ops may act on any. */
  private assertClientOrderAccess(order: Order, actor: QualityActor): void {
    if (isOpsRole(actor.role)) return;
    if (order.userId !== actor.userId) {
      throw new ForbiddenException({
        code: 'not_order_owner',
        message: 'You can only act on your own orders',
      });
    }
  }

  private async promoteSubmittedToNeedsQa(
    order: Order,
    actor: QualityActor,
  ): Promise<Order> {
    return this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await ordersRepo.findOne({
        where: { id: order.id },
        lock: { mode: 'pessimistic_write' },
        relations: ['user'],
      });
      if (!locked) throw new NotFoundException('Order not found');
      if (locked.orderStatus !== OrderStatus.SUBMITTED) {
        return locked;
      }

      assertTransition(OrderStatus.SUBMITTED, OrderStatus.NEEDS_QA, actor.role);

      const result = await ordersRepo.update(
        { id: locked.id, orderStatus: OrderStatus.SUBMITTED },
        { orderStatus: OrderStatus.NEEDS_QA },
      );
      if (result.affected != null && result.affected !== 1) {
        throw new BadRequestException('Order changed during QA promote');
      }

      await historyRepo.insert({
        orderId: locked.id,
        fromStatus: OrderStatus.SUBMITTED,
        toStatus: OrderStatus.NEEDS_QA,
        changedByUserId: actor.userId,
        notes: 'Auto-promoted to needs_qa on Ops QA workspace open',
      });
      await this.auditService.recordOrderStatusTransition(
        {
          orderId: locked.id,
          fromStatus: OrderStatus.SUBMITTED,
          toStatus: OrderStatus.NEEDS_QA,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason: 'Auto-promoted to needs_qa on Ops QA workspace open',
          metadata: { source: 'quality.getWorkspace' },
        },
        manager,
      );

      locked.orderStatus = OrderStatus.NEEDS_QA;
      return locked;
    });
  }
}
