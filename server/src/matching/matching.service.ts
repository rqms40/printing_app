import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Address } from '../addresses/entities/address.entity';
import { UsersService } from '../users/users.service';
import {
  ROUTING_PROVIDER,
  type RoutingProvider,
} from '../riders/routing/routing-provider';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import {
  assertTransition,
  type TransitionActor,
} from '../orders/order-status-transition';
import { AuditService } from '../audit/audit.service';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { DeliverySettingsService } from '../delivery-slots/delivery-settings.service';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from './entities/supplier-assignment.entity';
import {
  CAPACITY_HOLDING_DECISIONS,
  DEFAULT_ACCEPTANCE_SLA_HOURS,
  MATCHING_WEIGHTS,
  OrderMatchContext,
  quoteDistanceFeePesos,
  rankSupplierCandidates,
  RankedSupplierCandidate,
  resolveMatchingPreference,
  sortByMatchingPreference,
  SupplierAcceptanceStats,
  type GeoPoint,
  type MatchingPreference,
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
    @Optional()
    @InjectRepository(Address)
    private readonly addressRepo?: Repository<Address>,
    @Optional() private readonly usersService?: UsersService,
    @Optional()
    @Inject(ROUTING_PROVIDER)
    private readonly routingProvider?: RoutingProvider,
    @Optional() private readonly deliverySettingsService?: DeliverySettingsService,
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

  async previewForClient(
    userId: number,
    input: {
      category: string;
      destinationId?: number;
      latitude?: number;
      longitude?: number;
    },
  ): Promise<{
    preference: MatchingPreference;
    supplier: {
      supplierId: number;
      businessName: string;
      address: string | null;
      latitude: number;
      longitude: number;
      ratingAverage: number;
      leadTimeDays: number;
    };
    distanceMeters: number | null;
    deliveryFeePesos: number;
    deliveryFeeMinor: string;
    feeIsEstimate: boolean;
  }> {
    const category = String(input.category ?? '').trim();
    if (!category) {
      throw new BadRequestException({
        code: 'invalid_category',
        message: 'Category is required',
      });
    }

    const user = this.usersService
      ? await this.usersService.findById(userId)
      : null;
    const preference = resolveMatchingPreference(user?.matchingPreference);
    const destination = await this.resolvePreviewDestination(userId, input);
    const zoneTokens = destination?.zoneTokens ?? [];
    const ctx: OrderMatchContext = {
      orderId: 0,
      category,
      quantity: 1,
      zoneTokens,
    };
    const { candidates } = await this.rankForOrder(ctx, {
      requireShopPin: true,
    });
    const ranked = sortByMatchingPreference(
      candidates,
      preference,
      destination?.point ?? null,
    );
    const top = ranked[0];
    if (!top) {
      throw new BadRequestException({
        code: 'no_eligible_suppliers',
        message: 'No verified print shop is available for this product yet',
      });
    }
    const shopPoint = {
      latitude: top.rankingInputs.shopLatitude as number,
      longitude: top.rankingInputs.shopLongitude as number,
    };
    const quoted = await this.quoteShopDelivery(
      shopPoint,
      destination?.point ?? null,
      false,
    );
    const profile = await this.supplierRepo.findOne({
      where: { id: top.supplierId },
    });

    return {
      preference,
      supplier: {
        supplierId: top.supplierId,
        businessName: top.businessName,
        address: profile?.address ?? null,
        latitude: shopPoint.latitude,
        longitude: shopPoint.longitude,
        ratingAverage: top.rankingInputs.ratingAverage,
        leadTimeDays: top.rankingInputs.leadTimeDays,
      },
      distanceMeters: quoted.distanceMeters,
      deliveryFeePesos: quoted.deliveryFeePesos,
      deliveryFeeMinor: String(Math.round(quoted.deliveryFeePesos * 100)),
      feeIsEstimate: quoted.feeIsEstimate,
    };
  }

  async quoteShopDelivery(
    shop: GeoPoint,
    destination: GeoPoint | null,
    isPickup: boolean,
  ): Promise<{
    distanceMeters: number | null;
    deliveryFeePesos: number;
    feeIsEstimate: boolean;
  }> {
    if (isPickup) {
      return { distanceMeters: null, deliveryFeePesos: 0, feeIsEstimate: false };
    }
    if (!destination) {
      return { distanceMeters: null, deliveryFeePesos: 25, feeIsEstimate: true };
    }
    if (!this.routingProvider) {
      return { distanceMeters: null, deliveryFeePesos: 25, feeIsEstimate: true };
    }
    try {
      const legs = await this.routingProvider.getRoute([shop, destination]);
      const meters = legs[0]?.distanceMeters;
      if (!Number.isFinite(meters) || (meters as number) < 0) {
        return {
          distanceMeters: null,
          deliveryFeePesos: 25,
          feeIsEstimate: true,
        };
      }
      return {
        distanceMeters: meters as number,
        deliveryFeePesos: quoteDistanceFeePesos(meters as number),
        feeIsEstimate: false,
      };
    } catch {
      return { distanceMeters: null, deliveryFeePesos: 25, feeIsEstimate: true };
    }
  }

  async autoMatchPreferred(orderId: number): Promise<AssignResult | null> {
    const order = await this.loadOrderForMatching(orderId);
    if (order.orderStatus !== OrderStatus.APPROVED_FOR_MATCHING) {
      return null;
    }
    const user = this.usersService
      ? await this.usersService.findById(order.userId)
      : null;
    const preference = resolveMatchingPreference(user?.matchingPreference);
    const destPoint = this.destinationPointFromOrder(order);
    const ctx = this.toMatchContext(order);
    const { candidates } = await this.rankForOrder(ctx, {
      requireShopPin: true,
    });
    const ranked = sortByMatchingPreference(candidates, preference, destPoint);
    const blocked = await this.assignmentRepo.find({
      where: {
        orderId,
        decision: In([
          SupplierAssignmentDecision.DECLINED,
          SupplierAssignmentDecision.EXPIRED,
        ]),
      },
    });
    const blockedIds = new Set(blocked.map((row) => row.supplierId));
    const available = ranked.filter((row) => !blockedIds.has(row.supplierId));
    const preferredId = order.preferredSupplierId;
    const candidate =
      (preferredId != null
        ? available.find((row) => row.supplierId === preferredId)
        : undefined) ?? available[0];
    if (!candidate) {
      this.logger.warn(
        `No eligible suppliers to auto-match for order ${orderId}`,
      );
      return null;
    }
    return this.createAssignment(
      orderId,
      candidate,
      { userId: 0, role: 'system' },
      'client_preference_auto_match',
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

    let extraFeeMinor = 0n;
    try {
      const orderForDistance = await this.loadOrderForMatching(orderId);
      const destPoint = this.destinationPointFromOrder(orderForDistance);
      const shopPoint = candidate.rankingInputs.shopLatitude != null && candidate.rankingInputs.shopLongitude != null 
        ? { latitude: candidate.rankingInputs.shopLatitude as number, longitude: candidate.rankingInputs.shopLongitude as number } 
        : null;

      if (destPoint && shopPoint && this.routingProvider && this.deliverySettingsService) {
        const legs = await this.routingProvider.getRoute([shopPoint, destPoint]);
        const meters = legs[0]?.distanceMeters;
        if (meters != null && meters >= 0) {
          const settings = await this.deliverySettingsService.getSettings();
          const perKm = Number(settings.deliveryFeePerKm);
          if (perKm > 0) {
             const pesos = Math.round((meters / 1000) * perKm);
             extraFeeMinor = BigInt(pesos * 100);
          }
        }
      }
    } catch (err) {
      this.logger.warn(`Failed to calculate distance fee for assignment: ${err}`);
    }

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

      const newDeliveryFeeMinor = ((locked.deliveryFeeMinor ? BigInt(locked.deliveryFeeMinor) : 0n) + extraFeeMinor).toString();
      const newDeliveryFee = Number(newDeliveryFeeMinor) / 100;

      const fromStatus = locked.orderStatus;
      const toStatus = OrderStatus.SUPPLIER_ASSIGNED;
      const updateResult = await ordersRepo.update(
        { id: locked.id, orderStatus: OrderStatus.APPROVED_FOR_MATCHING },
        {
          orderStatus: toStatus,
          preferredSupplierId: candidate.supplierId,
          deliveryFeeMinor: newDeliveryFeeMinor,
          deliveryFee: newDeliveryFee,
        },
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
      relations: { deliveryAddress: true, destination: true },
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
        shopLatitude: Number(profile.latitude) || null,
        shopLongitude: Number(profile.longitude) || null,
        distanceMeters: null,
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

  private destinationPointFromOrder(order: Order): GeoPoint | null {
    const dest = order.destination;
    if (dest?.latitude != null && dest?.longitude != null) {
      const lat = Number(dest.latitude);
      const lng = Number(dest.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    const addr = order.deliveryAddress;
    if (addr?.latitude != null && addr?.longitude != null) {
      const lat = Number(addr.latitude);
      const lng = Number(addr.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  }

  private async resolvePreviewDestination(
    userId: number,
    input: {
      destinationId?: number;
      latitude?: number;
      longitude?: number;
    },
  ): Promise<{ point: GeoPoint; zoneTokens: string[] } | null> {
    if (input.destinationId != null && this.addressRepo) {
      const address = await this.addressRepo.findOne({
        where: { id: Number(input.destinationId), userId },
      });
      if (!address) {
        throw new BadRequestException({
          code: 'destination_not_found',
          message: 'Delivery address was not found',
        });
      }
      return {
        point: {
          latitude: Number(address.latitude),
          longitude: Number(address.longitude),
        },
        zoneTokens: [address.city, address.barangay, address.province].filter(
          (value): value is string => Boolean(value && String(value).trim()),
        ),
      };
    }
    const lat = Number(input.latitude);
    const lng = Number(input.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { point: { latitude: lat, longitude: lng }, zoneTokens: [] };
    }
    if (this.addressRepo) {
      const fallback = await this.addressRepo.findOne({
        where: { userId, isDefault: true },
        order: { id: 'DESC' },
      });
      if (fallback) {
        return {
          point: {
            latitude: Number(fallback.latitude),
            longitude: Number(fallback.longitude),
          },
          zoneTokens: [
            fallback.city,
            fallback.barangay,
            fallback.province,
          ].filter((value): value is string =>
            Boolean(value && String(value).trim()),
          ),
        };
      }
    }
    return null;
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

  private async rankForOrder(
    ctx: OrderMatchContext,
    options: { requireShopPin?: boolean } = {},
  ) {
    const profiles = await this.supplierRepo.find({
      relations: { verification: true, capabilities: true },
      order: { id: 'ASC' },
    });

    const supplierIds = profiles.map((p) => p.id);
    const openLoads = await this.loadOpenLoads(supplierIds);
    const acceptanceStats = await this.loadAcceptanceStats(supplierIds);

    return rankSupplierCandidates(ctx, profiles, openLoads, acceptanceStats, {
      requireShopPin: options.requireShopPin === true,
    });
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
