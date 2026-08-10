import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import {
  assertTransition,
  type TransitionActor,
} from '../orders/order-status-transition';
import { AuditService } from '../audit/audit.service';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from './entities/supplier-assignment.entity';
import {
  CAPACITY_HOLDING_DECISIONS,
  DEFAULT_ACCEPTANCE_SLA_HOURS,
  MATCHING_WEIGHTS,
  OrderMatchContext,
  rankSupplierCandidates,
  RankedSupplierCandidate,
  SupplierAcceptanceStats,
} from './matching.ranking';
import { SupplierVerificationStatus } from '../suppliers/entities/supplier-verification.entity';

export type MatchingActor = {
  userId: number;
  role: TransitionActor;
};

export type AssignResult = {
  assignment: SupplierAssignment;
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
  };
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  candidate: RankedSupplierCandidate;
};

export type CandidatesResult = {
  order: {
    id: number;
    orderId: string;
    orderStatus: OrderStatus;
    category: string;
    quantity: number;
    zoneTokens: string[];
  };
  /** Ranked eligible suppliers (capability + zone + capacity filters). */
  candidates: RankedSupplierCandidate[];
  excludedCount: number;
  /**
   * All verified active suppliers for ops manual assign UI.
   * Includes suppliers that ranking may have excluded (capability/zone).
   */
  verifiedSuppliers: Array<{
    supplierId: number;
    businessName: string;
    userId: number;
    isEligibleCandidate: boolean;
    score: number | null;
    rankPosition: number | null;
    excludeReason: string | null;
    serviceZones: string[];
    capabilities: string[];
  }>;
};

function assertOpsActor(actor: MatchingActor): void {
  if (actor.role !== 'ops_admin' && actor.role !== 'super_admin') {
    throw new BadRequestException(
      `Actor ${actor.role} cannot perform matching operations`,
    );
  }
  if (!Number.isInteger(actor.userId) || actor.userId <= 0) {
    throw new BadRequestException('Matching actor user id is required');
  }
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(SupplierAssignment)
    private readonly assignmentRepo: Repository<SupplierAssignment>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(SupplierProfile)
    private readonly supplierRepo: Repository<SupplierProfile>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  acceptanceSlaHours(): number {
    const raw = this.configService.get<string | number>(
      'MATCHING_ACCEPTANCE_SLA_HOURS',
    );
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0) return n;
    return DEFAULT_ACCEPTANCE_SLA_HOURS;
  }

  async getCandidates(orderId: number): Promise<CandidatesResult> {
    const order = await this.loadOrderForMatching(orderId);
    if (order.orderStatus !== OrderStatus.APPROVED_FOR_MATCHING) {
      throw new BadRequestException({
        code: 'not_in_matching_queue',
        message: `Order status ${order.orderStatus} is not open for matching (expected approved_for_matching)`,
      });
    }

    const ctx = this.toMatchContext(order);
    const { candidates, excluded } = await this.rankForOrder(ctx);
    const verifiedSuppliers = await this.listVerifiedSuppliersForOrder(
      ctx,
      candidates,
      excluded,
    );

    return {
      order: {
        id: order.id,
        orderId: order.orderId,
        orderStatus: order.orderStatus,
        category: order.category,
        quantity: order.quantity,
        zoneTokens: ctx.zoneTokens,
      },
      candidates,
      excludedCount: excluded.length,
      verifiedSuppliers,
    };
  }

  async getAssignmentForOrder(
    orderId: number,
  ): Promise<SupplierAssignment | null> {
    await this.loadOrderForMatching(orderId);
    return this.assignmentRepo.findOne({
      where: { orderId },
      relations: { supplier: true },
      order: { id: 'DESC' },
    });
  }

  /**
   * Ops selects a verified supplier and creates a pending assignment.
   * Prefers ranked candidates; allows ops override for any verified active shop.
   */
  async assign(
    orderId: number,
    supplierId: number,
    actor: MatchingActor,
    notes?: string,
  ): Promise<AssignResult> {
    assertOpsActor(actor);

    const ranked = await this.getCandidates(orderId);
    let candidate = ranked.candidates.find((c) => c.supplierId === supplierId);
    if (!candidate) {
      candidate = await this.buildOpsOverrideCandidate(orderId, supplierId);
    }

    return this.createAssignment(orderId, candidate, actor, notes);
  }

  /**
   * Auto-match: assign the top-ranked eligible supplier.
   */
  async autoMatch(
    orderId: number,
    actor: MatchingActor,
  ): Promise<AssignResult> {
    assertOpsActor(actor);

    const ranked = await this.getCandidates(orderId);
    const top = ranked.candidates[0];
    if (!top) {
      throw new BadRequestException({
        code: 'no_eligible_suppliers',
        message: `No eligible suppliers for order ${orderId}`,
      });
    }

    return this.createAssignment(
      orderId,
      top,
      actor,
      'auto_match top candidate',
    );
  }

  /**
   * Expire pending assignments past acceptanceDeadline.
   * Releases soft capacity (decision → expired) and returns order to
   * approved_for_matching for re-queue.
   */
  async expireStaleAssignments(
    now: Date = new Date(),
  ): Promise<{ expiredAssignmentIds: number[]; scanned: number }> {
    const pending = await this.assignmentRepo.find({
      where: { decision: SupplierAssignmentDecision.PENDING },
      order: { id: 'ASC' },
    });

    const expiredAssignmentIds: number[] = [];
    for (const row of pending) {
      if (new Date(row.acceptanceDeadline).getTime() > now.getTime()) {
        continue;
      }
      try {
        await this.expireAssignment(row.id, now);
        expiredAssignmentIds.push(row.id);
      } catch (err) {
        this.logger.warn(
          `Matching expiry failed for assignment ${row.id}: ${err}`,
        );
      }
    }

    return { expiredAssignmentIds, scanned: pending.length };
  }

  async expireAssignment(
    assignmentId: number,
    now: Date = new Date(),
  ): Promise<SupplierAssignment> {
    const systemActor: MatchingActor = { userId: 0, role: 'system' };
    const reason = `Supplier acceptance SLA expired (${now.toISOString()})`;

    const result = await this.dataSource.transaction(async (manager) => {
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const ordersRepo = manager.getRepository(Order);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await assignmentRepo.findOne({
        where: { id: assignmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) {
        throw new NotFoundException(`Assignment ${assignmentId} not found`);
      }
      if (locked.decision !== SupplierAssignmentDecision.PENDING) {
        return { assignment: locked, orderChanged: false as const };
      }
      if (new Date(locked.acceptanceDeadline).getTime() > now.getTime()) {
        return { assignment: locked, orderChanged: false as const };
      }

      locked.decision = SupplierAssignmentDecision.EXPIRED;
      locked.decisionReason = reason;
      locked.decidedAt = now;
      const savedAssignment = await assignmentRepo.save(locked);

      const order = await ordersRepo.findOne({
        where: { id: locked.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!order) {
        return { assignment: savedAssignment, orderChanged: false as const };
      }

      // Only re-queue when still waiting on this supplier accept.
      if (order.orderStatus !== OrderStatus.SUPPLIER_ASSIGNED) {
        await this.auditService.append(
          {
            actorId: null,
            actorRole: 'system',
            action: 'supplier_assignment_expired',
            entityType: 'supplier_assignment',
            entityId: String(savedAssignment.id),
            orderId: locked.orderId,
            fromState: SupplierAssignmentDecision.PENDING,
            toState: SupplierAssignmentDecision.EXPIRED,
            reason,
            metadata: {
              source: 'matching.expireAssignment',
              orderStatusUnchanged: order.orderStatus,
            },
          },
          manager,
        );
        return { assignment: savedAssignment, orderChanged: false as const };
      }

      assertTransition(
        OrderStatus.SUPPLIER_ASSIGNED,
        OrderStatus.APPROVED_FOR_MATCHING,
        systemActor.role,
      );

      const fromStatus = order.orderStatus;
      const updateResult = await ordersRepo.update(
        { id: order.id, orderStatus: OrderStatus.SUPPLIER_ASSIGNED },
        { orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during assignment expiry');
      }

      await historyRepo.insert({
        orderId: order.id,
        fromStatus,
        toStatus: OrderStatus.APPROVED_FOR_MATCHING,
        changedByUserId: 0,
        notes: reason,
      });

      await this.auditService.recordOrderStatusTransition(
        {
          orderId: order.id,
          fromStatus,
          toStatus: OrderStatus.APPROVED_FOR_MATCHING,
          actorUserId: 0,
          actorRole: 'system',
          reason,
          metadata: {
            source: 'matching.expireAssignment',
            assignmentId: savedAssignment.id,
            supplierId: savedAssignment.supplierId,
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: null,
          actorRole: 'system',
          action: 'supplier_assignment_expired',
          entityType: 'supplier_assignment',
          entityId: String(savedAssignment.id),
          orderId: order.id,
          fromState: SupplierAssignmentDecision.PENDING,
          toState: SupplierAssignmentDecision.EXPIRED,
          reason,
          metadata: {
            source: 'matching.expireAssignment',
            supplierId: savedAssignment.supplierId,
          },
        },
        manager,
      );

      return {
        assignment: savedAssignment,
        orderChanged: true as const,
        orderId: order.id,
        orderPublicId: order.orderId,
      };
    });

    return result.assignment;
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private async createAssignment(
    orderId: number,
    candidate: RankedSupplierCandidate,
    actor: MatchingActor,
    notes?: string,
  ): Promise<AssignResult> {
    const slaHours = this.acceptanceSlaHours();
    const deadline = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const result = await this.dataSource.transaction(async (manager) => {
      const ordersRepo = manager.getRepository(Order);
      const assignmentRepo = manager.getRepository(SupplierAssignment);
      const historyRepo = manager.getRepository(OrderStatusHistory);

      const locked = await ordersRepo.findOne({
        where: { id: orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new NotFoundException('Order not found');

      if (locked.orderStatus !== OrderStatus.APPROVED_FOR_MATCHING) {
        throw new BadRequestException({
          code: 'not_in_matching_queue',
          message: `Order status ${locked.orderStatus} is not open for matching (expected approved_for_matching)`,
        });
      }

      assertTransition(
        OrderStatus.APPROVED_FOR_MATCHING,
        OrderStatus.SUPPLIER_ASSIGNED,
        actor.role,
      );

      // Cancel any prior open assignments so capacity is released.
      await assignmentRepo
        .createQueryBuilder()
        .update(SupplierAssignment)
        .set({
          decision: SupplierAssignmentDecision.CANCELLED,
          decisionReason: 'superseded_by_new_assignment',
          decidedAt: new Date(),
        })
        .where('order_id = :orderId', { orderId: locked.id })
        .andWhere('decision IN (:...decisions)', {
          decisions: CAPACITY_HOLDING_DECISIONS,
        })
        .execute();

      const assignment = assignmentRepo.create({
        orderId: locked.id,
        supplierId: candidate.supplierId,
        rankingInputs: candidate.rankingInputs as Record<string, unknown>,
        rankPosition: candidate.rankPosition,
        acceptanceDeadline: deadline,
        decision: SupplierAssignmentDecision.PENDING,
        decisionReason: notes?.trim() || null,
        finalPriceMinor: null,
        promisedDate: null,
        decidedAt: null,
      });
      const savedAssignment = await assignmentRepo.save(assignment);

      const fromStatus = locked.orderStatus;
      const toStatus = OrderStatus.SUPPLIER_ASSIGNED;
      const updateResult = await ordersRepo.update(
        { id: locked.id, orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
        { orderStatus: toStatus },
      );
      if (updateResult.affected != null && updateResult.affected !== 1) {
        throw new BadRequestException('Order changed during supplier assign');
      }

      const reason = `Supplier assigned: ${candidate.businessName} (id=${candidate.supplierId})`;
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
          metadata: {
            source: 'matching.createAssignment',
            assignmentId: savedAssignment.id,
            supplierId: candidate.supplierId,
            rankPosition: candidate.rankPosition,
            score: candidate.score,
            acceptanceDeadline: deadline.toISOString(),
          },
        },
        manager,
      );

      await this.auditService.append(
        {
          actorId: actor.userId,
          actorRole: actor.role,
          action: 'supplier_assigned',
          entityType: 'supplier_assignment',
          entityId: String(savedAssignment.id),
          orderId: locked.id,
          fromState: fromStatus,
          toState: toStatus,
          reason,
          metadata: {
            supplierId: candidate.supplierId,
            rankPosition: candidate.rankPosition,
            rankingInputs: candidate.rankingInputs,
            notes: notes?.trim() || null,
          },
        },
        manager,
      );

      return {
        assignment: savedAssignment,
        order: {
          id: locked.id,
          orderId: locked.orderId,
          orderStatus: toStatus,
        },
        fromStatus,
        toStatus,
        candidate,
        supplierUserId: candidate.userId,
      };
    });

    // Best-effort supplier notification (outside TX).
    await this.notifySupplierAssigned(result.supplierUserId, result);

    return {
      assignment: result.assignment,
      order: result.order,
      fromStatus: result.fromStatus,
      toStatus: result.toStatus,
      candidate: result.candidate,
    };
  }

  private async notifySupplierAssigned(
    supplierUserId: number,
    result: {
      assignment: SupplierAssignment;
      order: { id: number; orderId: string };
      candidate: RankedSupplierCandidate;
    },
  ): Promise<void> {
    if (!this.notificationsService) return;
    try {
      await this.notificationsService.create({
        userId: supplierUserId,
        title: 'New order assignment',
        message: `Order ${result.order.orderId} was assigned to you. Accept within the SLA window.`,
        type: 'supplier_assignment',
        orderRef: result.order.orderId,
        metadata: {
          assignmentId: result.assignment.id,
          supplierId: result.candidate.supplierId,
          acceptanceDeadline: result.assignment.acceptanceDeadline,
          rankPosition: result.candidate.rankPosition,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Supplier assignment notification failed for user ${supplierUserId}: ${err}`,
      );
    }
  }

  private async loadOrderForMatching(orderId: number): Promise<Order> {
    const order = await this.ordersRepo.findOne({
      where: { id: orderId },
      relations: { deliveryAddress: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    return order;
  }

  /**
   * Build assignable list for ops UI: every verified active supplier, with
   * eligibility flags from ranking.
   */
  private async listVerifiedSuppliersForOrder(
    ctx: OrderMatchContext,
    candidates: RankedSupplierCandidate[],
    excluded: Array<{ supplierId: number; reason: string }>,
  ): Promise<CandidatesResult['verifiedSuppliers']> {
    const profiles = await this.supplierRepo.find({
      relations: { verification: true, capabilities: true },
      order: { id: 'ASC' },
    });
    const candidateById = new Map(candidates.map((c) => [c.supplierId, c]));
    const excludeById = new Map(excluded.map((e) => [e.supplierId, e.reason]));

    const rows: CandidatesResult['verifiedSuppliers'] = [];
    for (const profile of profiles) {
      if (!profile.isActive) continue;
      const status = profile.verification?.status;
      if (status !== SupplierVerificationStatus.VERIFIED) continue;

      const ranked = candidateById.get(profile.id);
      rows.push({
        supplierId: profile.id,
        businessName: profile.businessName,
        userId: profile.userId,
        isEligibleCandidate: ranked != null,
        score: ranked?.score ?? null,
        rankPosition: ranked?.rankPosition ?? null,
        excludeReason: ranked ? null : (excludeById.get(profile.id) ?? null),
        serviceZones: profile.serviceZones ?? [],
        capabilities: (profile.capabilities ?? []).map((c) => c.productFamily),
      });
    }

    // Eligible first (by rank), then remaining alphabetically.
    rows.sort((a, b) => {
      if (a.isEligibleCandidate !== b.isEligibleCandidate) {
        return a.isEligibleCandidate ? -1 : 1;
      }
      if (
        a.rankPosition != null &&
        b.rankPosition != null &&
        a.rankPosition !== b.rankPosition
      ) {
        return a.rankPosition - b.rankPosition;
      }
      return a.businessName.localeCompare(b.businessName);
    });
    return rows;
  }

  /** Ops override: assign any verified active supplier even if ranking excluded them. */
  private async buildOpsOverrideCandidate(
    orderId: number,
    supplierId: number,
  ): Promise<RankedSupplierCandidate> {
    const profile = await this.supplierRepo.findOne({
      where: { id: supplierId },
      relations: { verification: true, capabilities: true },
    });
    if (!profile) {
      throw new NotFoundException(`Supplier ${supplierId} not found`);
    }
    if (!profile.isActive) {
      throw new BadRequestException({
        code: 'supplier_inactive',
        message: `Supplier ${supplierId} is inactive`,
      });
    }
    if (profile.verification?.status !== SupplierVerificationStatus.VERIFIED) {
      throw new BadRequestException({
        code: 'supplier_not_verified',
        message: `Supplier ${supplierId} is not verified`,
      });
    }

    const order = await this.loadOrderForMatching(orderId);
    const ctx = this.toMatchContext(order);
    const cap = profile.capabilities?.[0];

    return {
      supplierId: profile.id,
      businessName: profile.businessName,
      userId: profile.userId,
      score: 0,
      rankPosition: 0,
      rankingInputs: {
        formula: 'ops_manual_override',
        weights: MATCHING_WEIGHTS,
        capabilityFit: cap ? 1 : 0,
        zoneFit: 1,
        capacityFit: 1,
        qualityScore: 0,
        acceptanceRate: 0.5,
        matchedProductFamily:
          cap?.productFamily ?? order.category ?? 'ops_override',
        maxCapacity: cap?.maxCapacity ?? 0,
        openLoad: 0,
        remainingCapacity: null,
        leadTimeDays: cap?.leadTimeDays ?? 1,
        serviceZones: profile.serviceZones ?? [],
        ratingAverage: Number(profile.ratingAverage ?? 0),
        acceptanceStats: { accepted: 0, declined: 0, expired: 0 },
        zoneTokens: ctx.zoneTokens,
      },
      capability: {
        id: cap?.id ?? 0,
        productFamily: cap?.productFamily ?? order.category ?? 'ops_override',
        maxCapacity: cap?.maxCapacity ?? 0,
        leadTimeDays: cap?.leadTimeDays ?? 1,
      },
    };
  }

  private toMatchContext(order: Order): OrderMatchContext {
    return {
      orderId: order.id,
      category: order.category ?? '',
      quantity: order.quantity ?? 1,
      zoneTokens: this.extractZoneTokens(order),
    };
  }

  private extractZoneTokens(order: Order): string[] {
    const tokens = new Set<string>();
    const addr = order.deliveryAddress;
    if (addr) {
      for (const raw of [addr.city, addr.barangay, addr.province]) {
        if (raw && String(raw).trim()) tokens.add(String(raw).trim());
      }
    }
    return [...tokens];
  }

  private async rankForOrder(ctx: OrderMatchContext) {
    const profiles = await this.supplierRepo.find({
      relations: { verification: true, capabilities: true },
      order: { id: 'ASC' },
    });

    const supplierIds = profiles.map((p) => p.id);
    const openLoads = await this.loadOpenLoads(supplierIds);
    const acceptanceStats = await this.loadAcceptanceStats(supplierIds);

    return rankSupplierCandidates(ctx, profiles, openLoads, acceptanceStats);
  }

  private async loadOpenLoads(
    supplierIds: number[],
  ): Promise<Map<number, number>> {
    const map = new Map<number, number>();
    if (supplierIds.length === 0) return map;

    const rows = await this.assignmentRepo
      .createQueryBuilder('a')
      .select('a.supplier_id', 'supplierId')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.supplier_id IN (:...ids)', { ids: supplierIds })
      .andWhere('a.decision IN (:...decisions)', {
        decisions: CAPACITY_HOLDING_DECISIONS,
      })
      .groupBy('a.supplier_id')
      .getRawMany<{ supplierId: string; cnt: string }>();

    for (const row of rows) {
      map.set(Number(row.supplierId), Number(row.cnt));
    }
    return map;
  }

  private async loadAcceptanceStats(
    supplierIds: number[],
  ): Promise<Map<number, SupplierAcceptanceStats>> {
    const map = new Map<number, SupplierAcceptanceStats>();
    for (const id of supplierIds) {
      map.set(id, {
        supplierId: id,
        accepted: 0,
        declined: 0,
        expired: 0,
      });
    }
    if (supplierIds.length === 0) return map;

    const rows = await this.assignmentRepo.find({
      where: {
        supplierId: In(supplierIds),
        decision: In([
          SupplierAssignmentDecision.ACCEPTED,
          SupplierAssignmentDecision.DECLINED,
          SupplierAssignmentDecision.EXPIRED,
        ]),
      },
      select: ['supplierId', 'decision'],
    });

    for (const row of rows) {
      const stats = map.get(row.supplierId);
      if (!stats) continue;
      if (row.decision === SupplierAssignmentDecision.ACCEPTED) {
        stats.accepted += 1;
      } else if (row.decision === SupplierAssignmentDecision.DECLINED) {
        stats.declined += 1;
      } else if (row.decision === SupplierAssignmentDecision.EXPIRED) {
        stats.expired += 1;
      }
    }
    return map;
  }
}
