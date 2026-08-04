import {
  BadRequestException,
  Injectable,
  NotFoundException,
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
  QualityReview,
  QualityReviewDecision,
  QualityReviewRiskLevel,
} from './entities/quality-review.entity';
import {
  QualityDecisionDto,
  QualityDecisionInput,
} from './dto/quality-decision.dto';

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

function mapDecisionInput(
  input: QualityDecisionInput,
): QualityReviewDecision {
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

@Injectable()
export class QualityService {
  constructor(
    @InjectRepository(QualityReview)
    private readonly reviewRepo: Repository<QualityReview>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService,
  ) {}

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

    return this.dataSource.transaction(async (manager) => {
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
        orderUpdates.declineReason =
          correctionText || 'Blocked by Ops QA';
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

      assertTransition(
        OrderStatus.SUBMITTED,
        OrderStatus.NEEDS_QA,
        actor.role,
      );

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
