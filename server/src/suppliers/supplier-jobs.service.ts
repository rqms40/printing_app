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
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
} from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import {
  assertTransition,
  type TransitionActor,
} from '../orders/order-status-transition';
import {
  normalizeMinor,
  pesosToMinor,
} from '../orders/order-authorization-snapshot';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../matching/entities/supplier-assignment.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { AcceptSupplierJobDto } from './dto/accept-supplier-job.dto';
import { DeclineSupplierJobDto } from './dto/decline-supplier-job.dto';
import {
  ProductionMilestone,
  ProductionStatusDto,
} from './dto/production-status.dto';
import { SelfQcDto } from './dto/self-qc.dto';

export type SupplierJobActor = {
  userId: number;
  role: TransitionActor;
};

/** List filter for supplier job inbox. */
export type SupplierJobListFilter =
  | 'assigned'
  | 'accepted'
  | 'in_production'
  | 'all';

const ASSIGNED_ORDER_STATUSES: OrderStatus[] = [OrderStatus.SUPPLIER_ASSIGNED];

const ACCEPTED_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.SUPPLIER_ACCEPTED,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.PAYMENT_AUTHORIZED,
];

const IN_PRODUCTION_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PRODUCTION,
  OrderStatus.SUPPLIER_SELF_QC,
  OrderStatus.READY_FOR_DISPATCH,
];

/** Statuses where a supplier may view approved artwork (QA already done). */
const ARTWORK_VISIBLE_STATUSES: OrderStatus[] = [
  OrderStatus.SUPPLIER_ASSIGNED,
  OrderStatus.SUPPLIER_ACCEPTED,
  OrderStatus.AWAITING_PAYMENT,
  OrderStatus.PAYMENT_AUTHORIZED,
  OrderStatus.PRODUCTION,
  OrderStatus.SUPPLIER_SELF_QC,
  OrderStatus.READY_FOR_DISPATCH,
  OrderStatus.RIDER_ASSIGNED,
  OrderStatus.PICKED_UP,
  OrderStatus.OUT_FOR_DELIVERY,
  OrderStatus.DELIVERED,
  OrderStatus.COLLECTED_BY_CUSTOMER,
  OrderStatus.ISSUE_WINDOW_OPEN,
  OrderStatus.COMPLETED,
];

const ACTIVE_LIST_DECISIONS: SupplierAssignmentDecision[] = [
  SupplierAssignmentDecision.PENDING,
  SupplierAssignmentDecision.ACCEPTED,
];

/** Decisions that may be viewed via GET job detail (historical declined/expired blocked). */
const VIEWABLE_JOB_DECISIONS: SupplierAssignmentDecision[] = [
  SupplierAssignmentDecision.PENDING,
  SupplierAssignmentDecision.ACCEPTED,
];

export type SupplierJobListItem = {
  id: number;
  orderId: number;
  orderPublicId: string;
  orderStatus: OrderStatus;
  decision: SupplierAssignmentDecision;
  acceptanceDeadline: Date;
  finalPriceMinor: string | null;
  promisedDate: Date | null;
  category: string;
  quantity: number;
  rankPosition: number;
  decidedAt: Date | null;
  createdAt: Date;
  paymentAuthorizationStatus: PaymentAuthorizationStatus;
};

export type SupplierJobSpecValue = {
  key: string;
  label: string;
  value: string;
  displayValue: string;
  optionId: number | null;
  optionLabel: string | null;
};

export type SupplierJobDetail = {
  assignment: {
    id: number;
    orderId: number;
    supplierId: number;
    decision: SupplierAssignmentDecision;
    decisionReason: string | null;
    acceptanceDeadline: Date;
    finalPriceMinor: string | null;
    promisedDate: Date | null;
    rankPosition: number;
    decidedAt: Date | null;
    createdAt: Date;
  };
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
    category: string;
    quantity: number;
    totalPrice: number;
    deliveryFee: number;
    finalTotalMinor: string | null;
    deliveryFeeMinor: string | null;
    paymentMethod: string;
    paymentAuthorizationStatus: PaymentAuthorizationStatus;
    deliveryOption: string;
    estimatedCompletionAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  /** Approved artwork only — never exposed before supplier assignment / QA. */
  artwork: {
    fileMetadataId: number | null;
    fileName: string | null;
    signedUrl: string | null;
  };
  /** Spec snapshot for production (items + item-level production attributes). */
  specs: {
    category: string;
    quantity: number;
    items: Array<{
      id: number;
      category: string;
      categoryName: string | null;
      quantity: number;
      /** Customer item notes only — never order.adminNotes. */
      specialInstructions: string | null;
      fileName: string | null;
      fileMetadataId: number | null;
      specs: SupplierJobSpecValue[];
    }>;
  };
  allowedActions: string[];
};

export type SupplierJobActionResult = {
  assignment: {
    id: number;
    decision: SupplierAssignmentDecision;
    finalPriceMinor: string | null;
    promisedDate: Date | null;
    decisionReason: string | null;
    decidedAt: Date | null;
  };
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
  };
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  milestone?: string | null;
  evidenceFileIds?: number[];
};

function assertSupplierActor(actor: SupplierJobActor): void {
  if (actor.role !== 'supplier') {
    throw new BadRequestException({
      code: 'supplier_role_required',
      message: `Actor ${actor.role} cannot perform supplier job actions`,
    });
  }
  if (!Number.isInteger(actor.userId) || actor.userId <= 0) {
    throw new BadRequestException('Supplier actor user id is required');
  }
}

function parseListFilter(raw?: string): SupplierJobListFilter {
  const value = (raw ?? 'all').trim().toLowerCase().replace(/-/g, '_');
  if (
    value === 'assigned' ||
    value === 'accepted' ||
    value === 'in_production' ||
    value === 'all'
  ) {
    return value;
  }
  throw new BadRequestException({
    code: 'invalid_job_filter',
    message:
      "filter must be one of: assigned, accepted, in_production, all",
  });
}

function orderStatusesForFilter(filter: SupplierJobListFilter): OrderStatus[] {
  switch (filter) {
    case 'assigned':
      return ASSIGNED_ORDER_STATUSES;
    case 'accepted':
      return ACCEPTED_ORDER_STATUSES;
    case 'in_production':
      return IN_PRODUCTION_ORDER_STATUSES;
    case 'all':
      return [
        ...ASSIGNED_ORDER_STATUSES,
        ...ACCEPTED_ORDER_STATUSES,
        ...IN_PRODUCTION_ORDER_STATUSES,
      ];
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

function decisionsForFilter(
  filter: SupplierJobListFilter,
): SupplierAssignmentDecision[] {
  if (filter === 'assigned') return [SupplierAssignmentDecision.PENDING];
  if (filter === 'accepted' || filter === 'in_production') {
    return [SupplierAssignmentDecision.ACCEPTED];
  }
  return ACTIVE_LIST_DECISIONS;
}

@Injectable()
export class SupplierJobsService {
  private readonly logger = new Logger(SupplierJobsService.name);

  constructor(
    @InjectRepository(SupplierAssignment)
    private readonly assignmentRepo: Repository<SupplierAssignment>,
    @InjectRepository(SupplierProfile)
    private readonly profileRepo: Repository<SupplierProfile>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly filesService: FilesService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  /**
   * List jobs for the authenticated supplier (own assignments only).
   * filter: assigned | accepted | in_production | all (default).
   */
  async listJobs(
    actor: SupplierJobActor,
    filterRaw?: string,
  ): Promise<SupplierJobListItem[]> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);
    const filter = parseListFilter(filterRaw);
    const statuses = orderStatusesForFilter(filter);
    const decisions = decisionsForFilter(filter);

    const rows = await this.assignmentRepo.find({
      where: {
        supplierId: profile.id,
        decision: In(decisions),
      },
      relations: { order: true },
      order: { id: 'DESC' },
    });

    return rows
      .filter(
        (row) => row.order != null && statuses.includes(row.order.orderStatus),
      )
      .map((row) => this.toListItem(row, row.order));
  }

  /**
   * Job detail with approved artwork + production specs.
   * Gate: own assignment with PENDING/ACCEPTED decision; order past Ops QA.
   * Never returns order.adminNotes (ops-only).
   */
  async getJob(
    jobId: number,
    actor: SupplierJobActor,
    requestHostname?: string,
  ): Promise<SupplierJobDetail> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);
    const assignment = await this.loadOwnedAssignment(jobId, profile.id, {
      order: true,
    });
    if (!VIEWABLE_JOB_DECISIONS.includes(assignment.decision)) {
      throw new ForbiddenException({
        code: 'assignment_not_active',
        message:
          'Only pending or accepted assignments can be viewed; declined/expired/cancelled jobs are not available',
      });
    }
    const order = assignment.order;
    if (!order) {
      throw new NotFoundException(`Order for job ${jobId} not found`);
    }

    this.assertArtworkAccess(order);

    const items = await this.ordersRepo.manager.getRepository(OrderItem).find({
      where: { orderId: order.id },
      relations: { specValues: true },
      order: { id: 'ASC' },
    });

    let signedUrl: string | null = null;
    if (order.fileMetadataId != null) {
      signedUrl = await this.signedArtworkUrl(
        order.fileMetadataId,
        requestHostname,
      );
    }

    return {
      assignment: {
        id: assignment.id,
        orderId: assignment.orderId,
        supplierId: assignment.supplierId,
        decision: assignment.decision,
        decisionReason: assignment.decisionReason,
        acceptanceDeadline: assignment.acceptanceDeadline,
        finalPriceMinor: assignment.finalPriceMinor,
        promisedDate: assignment.promisedDate,
        rankPosition: assignment.rankPosition,
        decidedAt: assignment.decidedAt,
        createdAt: assignment.createdAt,
      },
      order: {
        id: order.id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        category: order.category,
        quantity: order.quantity,
        totalPrice: Number(order.totalPrice),
        deliveryFee: Number(order.deliveryFee),
        finalTotalMinor: order.finalTotalMinor,
        deliveryFeeMinor: order.deliveryFeeMinor,
        paymentMethod: order.paymentMethod,
        paymentAuthorizationStatus:
          order.paymentAuthorizationStatus ?? PaymentAuthorizationStatus.NONE,
        deliveryOption: order.deliveryOption,
        estimatedCompletionAt: order.estimatedCompletionAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
      artwork: {
        fileMetadataId: order.fileMetadataId ?? null,
        fileName: order.fileName ?? null,
        signedUrl,
      },
      specs: {
        category: order.category,
        quantity: order.quantity,
        items: items.map((item) => ({
          id: item.id,
          category: item.category,
          categoryName: item.categoryName,
          quantity: item.quantity,
          specialInstructions: item.specialInstructions,
          fileName: item.fileName ?? null,
          fileMetadataId: item.fileMetadataId ?? null,
          specs: this.mapItemSpecValues(item.specValues),
        })),
      },
      allowedActions: this.computeAllowedActions(assignment, order),
    };
  }

  /**
   * Accept pending assignment: final price + promised date → ACCEPTED,
   * order supplier_assigned → supplier_accepted.
   */
  async acceptJob(
    jobId: number,
    dto: AcceptSupplierJobDto,
    actor: SupplierJobActor,
  ): Promise<SupplierJobActionResult> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);
    const now = new Date();

    const promisedDate = new Date(dto.promisedDate);
    if (Number.isNaN(promisedDate.getTime())) {
      throw new BadRequestException({
        code: 'invalid_promised_date',
        message: 'promisedDate must be a valid ISO-8601 date',
      });
    }
    if (promisedDate.getTime() < now.getTime() - 60_000) {
      throw new BadRequestException({
        code: 'promised_date_in_past',
        message: 'promisedDate must be now or in the future',
      });
    }

    let finalPriceMinor: string;
    try {
      finalPriceMinor = normalizeMinor(dto.finalPriceMinor, 'finalPriceMinor');
    } catch {
      throw new BadRequestException({
        code: 'invalid_final_price',
        message: 'finalPriceMinor must be a positive integer (centavos)',
      });
    }
    if (Number(finalPriceMinor) <= 0) {
      throw new BadRequestException({
        code: 'invalid_final_price',
        message: 'finalPriceMinor must be a positive integer (centavos)',
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await assignmentRepo.findOne({
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(`Job ${jobId} not found`);
      if (locked.supplierId !== profile.id) {
        throw new ForbiddenException({
          code: 'not_own_assignment',
          message: 'You can only accept your own assigned jobs',
        });
      }
      if (locked.decision !== SupplierAssignmentDecision.PENDING) {
        throw new BadRequestException({
          code: 'assignment_not_pending',
          message: `Assignment decision is ${locked.decision} (expected pending)`,
        });
      }
      if (new Date(locked.acceptanceDeadline).getTime() < now.getTime()) {
        throw new BadRequestException({
          code: 'acceptance_sla_expired',
          message: 'Acceptance SLA has expired; wait for re-matching',
        });
      }

      const order = await ordersRepo.findOne({
        where: { id: locked.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');
      if (order.orderStatus !== OrderStatus.SUPPLIER_ASSIGNED) {
        throw new BadRequestException({
          code: 'order_not_supplier_assigned',
          message: `Order status ${order.orderStatus} is not open for accept (expected supplier_assigned)`,
        });
      }

      assertTransition(
        OrderStatus.SUPPLIER_ASSIGNED,
        OrderStatus.SUPPLIER_ACCEPTED,
        actor.role,
      );

      locked.decision = SupplierAssignmentDecision.ACCEPTED;
      locked.finalPriceMinor = finalPriceMinor;
      locked.promisedDate = promisedDate;
      locked.decidedAt = now;
      locked.decisionReason = null;
      const savedAssignment = await assignmentRepo.save(locked);

      const deliveryFeeMinor =
        order.deliveryFeeMinor != null && order.deliveryFeeMinor !== ''
          ? normalizeMinor(order.deliveryFeeMinor, 'deliveryFeeMinor')
          : pesosToMinor(order.deliveryFee ?? 0);
      // finalTotalMinor = goods (supplier quote) + delivery fee
      const finalTotalMinor = String(
        Number(finalPriceMinor) + Number(deliveryFeeMinor),
      );

      const fromStatus = OrderStatus.SUPPLIER_ASSIGNED;
      const toStatus = OrderStatus.SUPPLIER_ACCEPTED;
      const updateResult = await ordersRepo.update(
        { id: order.id, orderStatus: fromStatus },
        {
          orderStatus: toStatus,
          finalTotalMinor,
          deliveryFeeMinor,
          estimatedCompletionAt: promisedDate,
        },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during accept');
      }

      const reason = `Supplier accepted job with final price ${finalPriceMinor} centavos, promised ${promisedDate.toISOString()}`;
      await historyRepo.insert({
        orderId: order.id,
        fromStatus,
        toStatus,
        changedByUserId: actor.userId,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: order.id,
          fromStatus,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason,
          metadata: {
            source: 'supplierJobs.acceptJob',
            assignmentId: savedAssignment.id,
            supplierId: profile.id,
            finalPriceMinor,
            promisedDate: promisedDate.toISOString(),
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'supplier_job_accepted',
          entityType: 'supplier_assignment',
          entityId: String(savedAssignment.id),
          orderId: order.id,
          fromState: SupplierAssignmentDecision.PENDING,
          toState: SupplierAssignmentDecision.ACCEPTED,
          reason,
          metadata: {
            finalPriceMinor,
            promisedDate: promisedDate.toISOString(),
            finalTotalMinor,
          },
        },
        manager,
      );

      return {
        assignment: savedAssignment,
        order: {
          id: order.id,
          orderId: order.orderId,
          orderStatus: toStatus,
          userId: order.userId,
        },
        fromStatus,
        toStatus,
      };
    });

    await this.notifyClientAccepted(result.order.userId, result);

    return {
      assignment: {
        id: result.assignment.id,
        decision: result.assignment.decision,
        finalPriceMinor: result.assignment.finalPriceMinor,
        promisedDate: result.assignment.promisedDate,
        decisionReason: result.assignment.decisionReason,
        decidedAt: result.assignment.decidedAt,
      },
      order: {
        id: result.order.id,
        orderId: result.order.orderId,
        orderStatus: result.order.orderStatus,
      },
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
    };
  }

  /**
   * Decline pending assignment → DECLINED; re-queue order to approved_for_matching.
   */
  async declineJob(
    jobId: number,
    dto: DeclineSupplierJobDto,
    actor: SupplierJobActor,
  ): Promise<SupplierJobActionResult> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);
    const reason = dto.reason.trim();
    if (!reason) {
      throw new BadRequestException({
        code: 'decline_reason_required',
        message: 'reason is required when declining a job',
      });
    }
    const now = new Date();

    const result = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await assignmentRepo.findOne({
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(`Job ${jobId} not found`);
      if (locked.supplierId !== profile.id) {
        throw new ForbiddenException({
          code: 'not_own_assignment',
          message: 'You can only decline your own assigned jobs',
        });
      }
      if (locked.decision !== SupplierAssignmentDecision.PENDING) {
        throw new BadRequestException({
          code: 'assignment_not_pending',
          message: `Assignment decision is ${locked.decision} (expected pending)`,
        });
      }

      const order = await ordersRepo.findOne({
        where: { id: locked.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      locked.decision = SupplierAssignmentDecision.DECLINED;
      locked.decisionReason = reason;
      locked.decidedAt = now;
      const savedAssignment = await assignmentRepo.save(locked);

      let fromStatus = order.orderStatus;
      let toStatus = order.orderStatus;

      // Re-queue only while still waiting on this supplier.
      if (order.orderStatus === OrderStatus.SUPPLIER_ASSIGNED) {
        assertTransition(
          OrderStatus.SUPPLIER_ASSIGNED,
          OrderStatus.APPROVED_FOR_MATCHING,
          'system',
        );
        fromStatus = OrderStatus.SUPPLIER_ASSIGNED;
        toStatus = OrderStatus.APPROVED_FOR_MATCHING;

        const updateResult = await ordersRepo.update(
          { id: order.id, orderStatus: fromStatus },
          { orderStatus: toStatus },
        );
        if (updateResult.affected != null && updateResult.affected !== 1) {
          throw new BadRequestException('Order changed during decline');
        }

        const historyNote = `Supplier declined: ${reason}`;
        await historyRepo.insert({
          orderId: order.id,
          fromStatus,
          toStatus,
          changedByUserId: actor.userId,
          notes: historyNote,
        });

        await this.auditService.recordOrderStatusTransition(
          {
            orderId: order.id,
            fromStatus,
            toStatus,
            actorUserId: actor.userId,
            actorRole: actor.role,
            reason: historyNote,
            metadata: {
              source: 'supplierJobs.declineJob',
              assignmentId: savedAssignment.id,
              supplierId: profile.id,
            },
          },
          manager,
        );
      }

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'supplier_job_declined',
          entityType: 'supplier_assignment',
          entityId: String(savedAssignment.id),
          orderId: order.id,
          fromState: SupplierAssignmentDecision.PENDING,
          toState: SupplierAssignmentDecision.DECLINED,
          reason,
          metadata: {
            orderFromStatus: fromStatus,
            orderToStatus: toStatus,
          },
        },
        manager,
      );

      return {
        assignment: savedAssignment,
        order: {
          id: order.id,
          orderId: order.orderId,
          orderStatus: toStatus,
        },
        fromStatus,
        toStatus,
      };
    });

    return {
      assignment: {
        id: result.assignment.id,
        decision: result.assignment.decision,
        finalPriceMinor: result.assignment.finalPriceMinor,
        promisedDate: result.assignment.promisedDate,
        decisionReason: result.assignment.decisionReason,
        decidedAt: result.assignment.decidedAt,
      },
      order: result.order,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
    };
  }

  /**
   * Production milestone updates. Entering production requires payment auth.
   */
  async updateProductionStatus(
    jobId: number,
    dto: ProductionStatusDto,
    actor: SupplierJobActor,
  ): Promise<SupplierJobActionResult> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);

    const milestone =
      dto.milestone ??
      (dto.status?.trim().toLowerCase() === 'production'
        ? ProductionMilestone.IN_PRODUCTION
        : undefined);

    if (!milestone && !dto.status?.trim()) {
      throw new BadRequestException({
        code: 'milestone_required',
        message: 'milestone or status is required',
      });
    }

    const resolvedMilestone =
      milestone ??
      (dto.status?.trim().toLowerCase() as ProductionMilestone | string);

    const result = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await assignmentRepo.findOne({
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(`Job ${jobId} not found`);
      if (locked.supplierId !== profile.id) {
        throw new ForbiddenException({
          code: 'not_own_assignment',
          message: 'You can only update production on your own jobs',
        });
      }
      if (locked.decision !== SupplierAssignmentDecision.ACCEPTED) {
        throw new BadRequestException({
          code: 'assignment_not_accepted',
          message: 'Job must be accepted before production updates',
        });
      }

      const order = await ordersRepo.findOne({
        where: { id: locked.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      let fromStatus = order.orderStatus;
      let toStatus = order.orderStatus;
      const notes =
        dto.notes?.trim() ||
        `Supplier production milestone: ${String(resolvedMilestone)}`;

      // Enter production from payment_authorized.
      if (order.orderStatus === OrderStatus.PAYMENT_AUTHORIZED) {
        this.assertPaymentAuthorizedForProduction(order);
        assertTransition(
          OrderStatus.PAYMENT_AUTHORIZED,
          OrderStatus.PRODUCTION,
          actor.role,
        );
        fromStatus = OrderStatus.PAYMENT_AUTHORIZED;
        toStatus = OrderStatus.PRODUCTION;

        const updateResult = await ordersRepo.update(
          { id: order.id, orderStatus: fromStatus },
          { orderStatus: toStatus },
        );
        if (updateResult.affected != null && updateResult.affected !== 1) {
          throw new BadRequestException(
            'Order changed during production start',
          );
        }

        await historyRepo.insert({
          orderId: order.id,
          fromStatus,
          toStatus,
          changedByUserId: actor.userId,
          notes,
        });

        await this.auditService.recordOrderStatusTransition(
          {
            orderId: order.id,
            fromStatus,
            toStatus,
            actorUserId: actor.userId,
            actorRole: actor.role,
            reason: notes,
            metadata: {
              source: 'supplierJobs.updateProductionStatus',
              assignmentId: locked.id,
              milestone: resolvedMilestone,
            },
          },
          manager,
        );
      } else if (order.orderStatus === OrderStatus.PRODUCTION) {
        // Milestone-only audit while already in production.
        fromStatus = OrderStatus.PRODUCTION;
        toStatus = OrderStatus.PRODUCTION;
      } else {
        throw new BadRequestException({
          code: 'not_open_for_production',
          message: `Order status ${order.orderStatus} is not open for production milestones (expected payment_authorized or production)`,
        });
      }

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'supplier_production_milestone',
          entityType: 'supplier_assignment',
          entityId: String(locked.id),
          orderId: order.id,
          fromState: fromStatus,
          toState: toStatus,
          reason: notes,
          metadata: {
            milestone: resolvedMilestone,
            paymentAuthorizationStatus: order.paymentAuthorizationStatus,
          },
        },
        manager,
      );

      return {
        assignment: locked,
        order: {
          id: order.id,
          orderId: order.orderId,
          orderStatus: toStatus,
        },
        fromStatus,
        toStatus,
        milestone: String(resolvedMilestone),
      };
    });

    return {
      assignment: {
        id: result.assignment.id,
        decision: result.assignment.decision,
        finalPriceMinor: result.assignment.finalPriceMinor,
        promisedDate: result.assignment.promisedDate,
        decisionReason: result.assignment.decisionReason,
        decidedAt: result.assignment.decidedAt,
      },
      order: result.order,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      milestone: result.milestone,
    };
  }

  /**
   * Self-QC with evidence (file refs and/or freshly uploaded multipart file).
   * production → supplier_self_qc.
   */
  async submitSelfQc(
    jobId: number,
    dto: SelfQcDto,
    actor: SupplierJobActor,
    uploadedFile?: Express.Multer.File,
  ): Promise<SupplierJobActionResult> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);

    // Optional multipart: store via FilesService first (outside TX).
    let uploadedFileId: number | null = null;
    if (uploadedFile) {
      const meta = await this.filesService.storeMetadata(
        uploadedFile,
        actor.userId,
        FilePurpose.GENERAL,
      );
      uploadedFileId = meta.id;
    }

    const evidenceIds = [
      ...(dto.evidenceFileIds ?? []),
      ...(uploadedFileId != null ? [uploadedFileId] : []),
    ];
    const uniqueEvidenceIds = [...new Set(evidenceIds)].filter(
      (id) => Number.isInteger(id) && id > 0,
    );

    if (uniqueEvidenceIds.length === 0) {
      throw new BadRequestException({
        code: 'self_qc_evidence_required',
        message:
          'Self-QC requires evidenceFileIds and/or a multipart evidence file',
      });
    }

    const result = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);
      const fileRepo = manager.getRepository(FileMetadata);

      const locked = await assignmentRepo.findOne({
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(`Job ${jobId} not found`);
      if (locked.supplierId !== profile.id) {
        throw new ForbiddenException({
          code: 'not_own_assignment',
          message: 'You can only submit self-QC on your own jobs',
        });
      }
      if (locked.decision !== SupplierAssignmentDecision.ACCEPTED) {
        throw new BadRequestException({
          code: 'assignment_not_accepted',
          message: 'Job must be accepted before self-QC',
        });
      }

      const order = await ordersRepo.findOne({
        where: { id: locked.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      // Payment gate still applies if somehow production was skipped.
      this.assertPaymentAuthorizedForProduction(order);

      if (order.orderStatus !== OrderStatus.PRODUCTION) {
        throw new BadRequestException({
          code: 'not_in_production',
          message: `Order status ${order.orderStatus} is not open for self-QC (expected production)`,
        });
      }

      // Validate evidence files belong to this supplier.
      for (const fileId of uniqueEvidenceIds) {
        const file = await fileRepo.findOne({
          where: { id: fileId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!file) {
          throw new BadRequestException({
            code: 'invalid_evidence_file',
            message: `Evidence file ${fileId} not found`,
          });
        }
        if (file.uploadedBy !== actor.userId) {
          throw new ForbiddenException({
            code: 'evidence_not_owned',
            message: 'Self-QC evidence files must be uploaded by you',
          });
        }
        if (!file.objectKey?.trim()) {
          throw new BadRequestException({
            code: 'evidence_missing_storage',
            message: `Evidence file ${fileId} has no storage object`,
          });
        }
      }

      assertTransition(
        OrderStatus.PRODUCTION,
        OrderStatus.SUPPLIER_SELF_QC,
        actor.role,
      );

      const fromStatus = OrderStatus.PRODUCTION;
      const toStatus = OrderStatus.SUPPLIER_SELF_QC;
      const reason =
        dto.notes?.trim() ||
        `Supplier self-QC submitted with ${uniqueEvidenceIds.length} evidence file(s)`;

      const updateResult = await ordersRepo.update(
        { id: order.id, orderStatus: fromStatus },
        { orderStatus: toStatus },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during self-QC');
      }

      await historyRepo.insert({
        orderId: order.id,
        fromStatus,
        toStatus,
        changedByUserId: actor.userId,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: order.id,
          fromStatus,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason,
          metadata: {
            source: 'supplierJobs.submitSelfQc',
            assignmentId: locked.id,
            evidenceFileIds: uniqueEvidenceIds,
            checklist: dto.checklist ?? {},
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'supplier_self_qc',
          entityType: 'supplier_assignment',
          entityId: String(locked.id),
          orderId: order.id,
          fromState: fromStatus,
          toState: toStatus,
          reason,
          metadata: {
            evidenceFileIds: uniqueEvidenceIds,
            checklist: dto.checklist ?? {},
          },
        },
        manager,
      );

      return {
        assignment: locked,
        order: {
          id: order.id,
          orderId: order.orderId,
          orderStatus: toStatus,
        },
        fromStatus,
        toStatus,
        evidenceFileIds: uniqueEvidenceIds,
      };
    });

    return {
      assignment: {
        id: result.assignment.id,
        decision: result.assignment.decision,
        finalPriceMinor: result.assignment.finalPriceMinor,
        promisedDate: result.assignment.promisedDate,
        decisionReason: result.assignment.decisionReason,
        decidedAt: result.assignment.decidedAt,
      },
      order: result.order,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      evidenceFileIds: result.evidenceFileIds,
    };
  }

  /**
   * Mark ready for rider pickup: supplier_self_qc → ready_for_dispatch.
   */
  async readyForPickup(
    jobId: number,
    actor: SupplierJobActor,
  ): Promise<SupplierJobActionResult> {
    assertSupplierActor(actor);
    const profile = await this.requireProfileForUser(actor.userId);

    const result = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await assignmentRepo.findOne({
        where: { id: jobId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException(`Job ${jobId} not found`);
      if (locked.supplierId !== profile.id) {
        throw new ForbiddenException({
          code: 'not_own_assignment',
          message: 'You can only mark ready-for-pickup on your own jobs',
        });
      }
      if (locked.decision !== SupplierAssignmentDecision.ACCEPTED) {
        throw new BadRequestException({
          code: 'assignment_not_accepted',
          message: 'Job must be accepted before ready-for-pickup',
        });
      }

      const order = await ordersRepo.findOne({
        where: { id: locked.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) throw new NotFoundException('Order not found');

      if (order.orderStatus !== OrderStatus.SUPPLIER_SELF_QC) {
        throw new BadRequestException({
          code: 'not_in_self_qc',
          message: `Order status ${order.orderStatus} is not open for ready-for-pickup (expected supplier_self_qc)`,
        });
      }

      assertTransition(
        OrderStatus.SUPPLIER_SELF_QC,
        OrderStatus.READY_FOR_DISPATCH,
        actor.role,
      );

      const fromStatus = OrderStatus.SUPPLIER_SELF_QC;
      const toStatus = OrderStatus.READY_FOR_DISPATCH;
      const reason = 'Supplier marked job ready for pickup / dispatch';

      const updateResult = await ordersRepo.update(
        { id: order.id, orderStatus: fromStatus },
        { orderStatus: toStatus },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException(
          'Order changed during ready-for-pickup',
        );
      }

      await historyRepo.insert({
        orderId: order.id,
        fromStatus,
        toStatus,
        changedByUserId: actor.userId,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: order.id,
          fromStatus,
          toStatus,
          actorUserId: actor.userId,
          actorRole: actor.role,
          reason,
          metadata: {
            source: 'supplierJobs.readyForPickup',
            assignmentId: locked.id,
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'supplier_ready_for_pickup',
          entityType: 'supplier_assignment',
          entityId: String(locked.id),
          orderId: order.id,
          fromState: fromStatus,
          toState: toStatus,
          reason,
        },
        manager,
      );

      return {
        assignment: locked,
        order: {
          id: order.id,
          orderId: order.orderId,
          orderStatus: toStatus,
        },
        fromStatus,
        toStatus,
      };
    });

    return {
      assignment: {
        id: result.assignment.id,
        decision: result.assignment.decision,
        finalPriceMinor: result.assignment.finalPriceMinor,
        promisedDate: result.assignment.promisedDate,
        decisionReason: result.assignment.decisionReason,
        decidedAt: result.assignment.decidedAt,
      },
      order: result.order,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
    };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async requireProfileForUser(userId: number): Promise<SupplierProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) {
      throw new NotFoundException(
        `Supplier profile for user ${userId} not found`,
      );
    }
    return profile;
  }

  private async loadOwnedAssignment(
    jobId: number,
    supplierId: number,
    relations?: { order?: boolean },
  ): Promise<SupplierAssignment> {
    const assignment = await this.assignmentRepo.findOne({
      where: { id: jobId },
      relations: relations?.order ? { order: true } : undefined,
    });
    if (!assignment) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    if (assignment.supplierId !== supplierId) {
      throw new ForbiddenException({
        code: 'not_own_assignment',
        message: 'You can only access your own assigned jobs',
      });
    }
    return assignment;
  }

  /**
   * Suppliers only see artwork after Ops QA and assignment
   * (order is supplier_assigned or later production path).
   */
  private assertArtworkAccess(order: Order): void {
    if (!ARTWORK_VISIBLE_STATUSES.includes(order.orderStatus)) {
      throw new ForbiddenException({
        code: 'artwork_not_released',
        message:
          'Artwork is not available until Ops QA is complete and the job is assigned to you',
      });
    }
  }

  /**
   * Production requires both order status path and independent auth flag.
   */
  private assertPaymentAuthorizedForProduction(order: Order): void {
    if (
      order.paymentAuthorizationStatus !== PaymentAuthorizationStatus.AUTHORIZED
    ) {
      throw new BadRequestException({
        code: 'payment_not_authorized',
        message:
          'Cannot enter production without payment authorization (payment_authorized)',
      });
    }
  }

  private async signedArtworkUrl(
    fileMetadataId: number,
    requestHostname?: string,
  ): Promise<string | null> {
    try {
      const file = await this.filesService.findById(fileMetadataId);
      if (!file.objectKey) return null;
      // Supplier is not the uploader — use key-based signing after assignment gate.
      return await this.filesService.getPresignedUrlForKey(
        file.objectKey,
        3600,
        requestHostname,
      );
    } catch (err) {
      this.logger.warn(
        `Could not sign artwork for file ${fileMetadataId}: ${err}`,
      );
      return null;
    }
  }

  private toListItem(
    assignment: SupplierAssignment,
    order: Order,
  ): SupplierJobListItem {
    return {
      id: assignment.id,
      orderId: order.id,
      orderPublicId: order.orderId,
      orderStatus: order.orderStatus,
      decision: assignment.decision,
      acceptanceDeadline: assignment.acceptanceDeadline,
      finalPriceMinor: assignment.finalPriceMinor,
      promisedDate: assignment.promisedDate,
      category: order.category,
      quantity: order.quantity,
      rankPosition: assignment.rankPosition,
      decidedAt: assignment.decidedAt,
      createdAt: assignment.createdAt,
      paymentAuthorizationStatus:
        order.paymentAuthorizationStatus ?? PaymentAuthorizationStatus.NONE,
    };
  }

  /** Production attributes from order_item_spec_values (no pricing internals). */
  private mapItemSpecValues(
    values:
      | {
          specKey: string;
          specLabel: string;
          value: string;
          displayValue: string;
          optionId: number | null;
          optionLabel: string | null;
        }[]
      | undefined
      | null,
  ): SupplierJobSpecValue[] {
    return (values ?? []).map((sv) => ({
      key: sv.specKey,
      label: sv.specLabel,
      value: sv.value,
      displayValue: sv.displayValue,
      optionId: sv.optionId ?? null,
      optionLabel: sv.optionLabel ?? null,
    }));
  }

  private computeAllowedActions(
    assignment: SupplierAssignment,
    order: Order,
  ): string[] {
    const actions: string[] = [];
    if (
      assignment.decision === SupplierAssignmentDecision.PENDING &&
      order.orderStatus === OrderStatus.SUPPLIER_ASSIGNED
    ) {
      actions.push('accept', 'decline');
    }
    if (assignment.decision === SupplierAssignmentDecision.ACCEPTED) {
      if (
        order.orderStatus === OrderStatus.PAYMENT_AUTHORIZED &&
        order.paymentAuthorizationStatus ===
          PaymentAuthorizationStatus.AUTHORIZED
      ) {
        actions.push('production-status');
      }
      if (order.orderStatus === OrderStatus.PRODUCTION) {
        actions.push('production-status', 'self-qc');
      }
      if (order.orderStatus === OrderStatus.SUPPLIER_SELF_QC) {
        actions.push('ready-for-pickup');
      }
    }
    return actions;
  }

  private async notifyClientAccepted(
    clientUserId: number,
    result: {
      order: { id: number; orderId: string };
      assignment: SupplierAssignment;
    },
  ): Promise<void> {
    if (!this.notificationsService) return;
    try {
      await this.notificationsService.create({
        userId: clientUserId,
        title: 'Supplier accepted your order',
        message: `A supplier accepted order ${result.order.orderId}. Complete payment to start production.`,
        type: 'supplier_accepted',
        orderRef: result.order.orderId,
        metadata: {
          assignmentId: result.assignment.id,
          finalPriceMinor: result.assignment.finalPriceMinor,
          promisedDate: result.assignment.promisedDate,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Client accept notification failed for order ${result.order.id}: ${err}`,
      );
    }
  }
}
