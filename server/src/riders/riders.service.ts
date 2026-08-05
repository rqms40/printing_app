import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomInt, timingSafeEqual } from 'crypto';
import { DataSource, EntityManager, In, Not, Repository } from 'typeorm';
import { RiderProfile } from './entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
  ProofOfDeliveryType,
} from './entities/delivery-assignment.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { BatchOrder } from '../orders/entities/batch-order.entity';
import { OrderStatusHistory } from '../orders/entities/order-status-history.entity';
import { assertOrderStatusTransition } from '../orders/order-status-transition';
import { User, UserRole } from '../users/entities/user.entity';
import { UpdateRiderProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationGateway } from './location.gateway';
import { OrdersService } from '../orders/orders.service';
import { ProofOfDeliveryDto } from './dto/update-delivery-status.dto';
import {
  Conversation,
  ConversationStatus,
  ConversationType,
} from '../chat/entities/conversation.entity';
import { ChatGateway } from '../chat/chat.gateway';
import { FilesService } from '../files/files.service';
import { MAX_SIGNATURE_PROOF_BYTES } from './dto/update-delivery-status.dto';
import { TamSurveyRequirement } from '../tam-surveys/entities/tam-survey-requirement.entity';
import {
  DispatchPlanService,
  type DispatchPlanProgress,
} from './dispatch-plan.service';
import { DispatchStopStatus } from './entities/dispatch-plan-stop.entity';
import { DispatchPlanStatus } from './entities/dispatch-plan.entity';
import {
  DeliveryQueueUpdatedPayload,
  OrdersGateway,
} from '../orders/orders.gateway';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

const OTP_SECRET_FIELDS = [
  'pickupOtpHash',
  'pickupOtpCode',
  'deliveryOtpHash',
  'deliveryOtpCode',
] as const;

export function generateDeliveryOtpCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashDeliveryOtp(code: string): string {
  return createHash('sha256').update(code.trim()).digest('hex');
}

export function otpCodesMatch(
  submitted: string | undefined,
  expectedHash: string | null | undefined,
): boolean {
  if (!submitted?.trim() || !expectedHash) return false;
  const left = Buffer.from(hashDeliveryOtp(submitted), 'utf8');
  const right = Buffer.from(expectedHash, 'utf8');
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Strip OTP secrets before serializing assignment to riders. */
export function sanitizeAssignmentSecrets<T extends object>(
  assignment: T,
): T {
  const clone = { ...assignment } as T & Record<string, unknown>;
  for (const field of OTP_SECRET_FIELDS) {
    delete clone[field];
  }
  return clone;
}

// Valid state transitions for delivery status
const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.ACCEPTED, DeliveryStatus.DECLINED],
  [DeliveryStatus.ACCEPTED]: [DeliveryStatus.PICKED_UP],
  [DeliveryStatus.DECLINED]: [],
  [DeliveryStatus.PICKED_UP]: [
    DeliveryStatus.ON_THE_WAY,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.ON_THE_WAY]: [
    DeliveryStatus.ARRIVED,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.ARRIVED]: [
    DeliveryStatus.DELIVERED,
    DeliveryStatus.FAILED,
  ],
  [DeliveryStatus.DELIVERED]: [],
  [DeliveryStatus.FAILED]: [],
};

/** Exact live tracking window: confirmed pickup through pre-terminal handoff. */
export const ACTIVE_TRIP_TRACKING_STATUSES: readonly DeliveryStatus[] = [
  DeliveryStatus.PICKED_UP,
  DeliveryStatus.ON_THE_WAY,
  DeliveryStatus.ARRIVED,
];

const ORDER_STATUS_BY_DELIVERY_STATUS: Partial<
  Record<DeliveryStatus, OrderStatus>
> = {
  [DeliveryStatus.ACCEPTED]: OrderStatus.RIDER_ASSIGNED,
  [DeliveryStatus.PICKED_UP]: OrderStatus.PICKED_UP,
  [DeliveryStatus.ON_THE_WAY]: OrderStatus.OUT_FOR_DELIVERY,
  [DeliveryStatus.ARRIVED]: OrderStatus.OUT_FOR_DELIVERY,
  [DeliveryStatus.DELIVERED]: OrderStatus.DELIVERED,
  [DeliveryStatus.FAILED]: OrderStatus.DELIVERY_FAILED,
};

type DeliveryProofMetadata = {
  proofType: ProofOfDeliveryType;
  proofFileId: number | null;
  proofObjectKey: string | null;
  proofSignatureData: string | null;
};

function hasValidSignatureStroke(signatureData: string): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(signatureData);
  } catch {
    return false;
  }
  if (typeof payload !== 'object' || payload === null) return false;

  const candidate = payload as { format?: unknown; points?: unknown };
  if (
    candidate.format !== 'gridgo-signature-v1' ||
    !Array.isArray(candidate.points)
  ) {
    return false;
  }

  let previousPoint: readonly [number, number] | null = null;
  let hasStroke = false;
  for (const entry of candidate.points) {
    if (entry === null) {
      previousPoint = null;
      continue;
    }
    if (
      !Array.isArray(entry) ||
      entry.length !== 2 ||
      typeof entry[0] !== 'number' ||
      typeof entry[1] !== 'number' ||
      !Number.isFinite(entry[0]) ||
      !Number.isFinite(entry[1])
    ) {
      return false;
    }
    const point = [entry[0], entry[1]] as const;
    if (
      previousPoint &&
      (previousPoint[0] !== point[0] || previousPoint[1] !== point[1])
    ) {
      hasStroke = true;
    }
    previousPoint = point;
  }
  return hasStroke;
}

export type RiderAssignmentResult = {
  order: Order;
  assignment: DeliveryAssignment;
  riderProfile: RiderProfile;
};

function isCurrentAssignmentUniqueViolation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const databaseError = error as { code?: unknown; constraint?: unknown };
  return (
    databaseError.code === '23505' &&
    databaseError.constraint === 'uq_delivery_assignments_current_order'
  );
}

@Injectable()
export class RidersService {
  private readonly logger = new Logger(RidersService.name);

  constructor(
    @InjectRepository(RiderProfile)
    private profileRepo: Repository<RiderProfile>,
    @InjectRepository(DeliveryAssignment)
    private assignmentRepo: Repository<DeliveryAssignment>,
    private locationGateway: LocationGateway,
    private ordersGateway: OrdersGateway,
    private ordersService: OrdersService,
    private filesService: FilesService,
    private chatGateway: ChatGateway,
    private dataSource: DataSource,
    private dispatchPlanService: DispatchPlanService,
    private auditService: AuditService,
    private notificationsService: NotificationsService,
  ) {}

  async assignOrderToRider(
    orderId: number,
    riderId: number,
    adminUserId: number,
    actorRole?: string | null,
  ): Promise<RiderAssignmentResult> {
    const auditActorRole =
      actorRole === UserRole.OPS_ADMIN || actorRole === UserRole.SUPER_ADMIN
        ? actorRole
        : UserRole.OPS_ADMIN;
    const candidate = await this.dataSource
      .getRepository(Order)
      .findOneOrFail({ where: { id: orderId } });

    let assignmentResult: {
      assignment: DeliveryAssignment;
      riderProfile: RiderProfile;
      previous: Order;
    };
    try {
      assignmentResult = await this.dataSource.transaction(async (manager) => {
        if (candidate.batchOrderId != null) {
          await manager.getRepository(BatchOrder).findOneOrFail({
            where: { id: candidate.batchOrderId },
            lock: { mode: 'pessimistic_write' },
          });
        }
        const order = await manager.getRepository(Order).findOneOrFail({
          where: { id: orderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (order.batchOrderId !== candidate.batchOrderId) {
          throw new BadRequestException(
            'Order batch changed during rider assignment',
          );
        }
        const assignmentRepo = manager.getRepository(DeliveryAssignment);
        const existing = await assignmentRepo.findOne({
          where: { orderId, isCurrent: true },
          lock: { mode: 'pessimistic_write' },
        });
        if (existing) {
          throw new ConflictException('Order already has an assignment');
        }
        if (order.orderStatus !== OrderStatus.READY_FOR_DISPATCH) {
          throw new BadRequestException('Order is not ready for dispatch');
        }
        if (order.deliveryOption !== 'delivery') {
          throw new BadRequestException(
            'Rider assignment requires a delivery order',
          );
        }

        const riderProfile = await manager.getRepository(RiderProfile).findOne({
          where: { id: riderId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!riderProfile) {
          throw new NotFoundException('Rider profile not found');
        }
        const riderUser = await manager.getRepository(User).findOne({
          where: { id: riderProfile.userId },
          lock: { mode: 'pessimistic_write' },
        });
        if (
          !riderProfile.isAvailable ||
          !riderUser?.isActive ||
          riderUser.role !== UserRole.RIDER
        ) {
          throw new BadRequestException(
            'Rider is not available for assignment',
          );
        }
        riderProfile.user = riderUser;
        const pickupOtpCode = generateDeliveryOtpCode();
        const assignment = assignmentRepo.create({
          orderId,
          riderId,
          status: DeliveryStatus.ASSIGNED,
          isCurrent: true,
          pickupOtpCode,
          pickupOtpHash: hashDeliveryOtp(pickupOtpCode),
          pickupOtpVerifiedAt: null,
          deliveryOtpCode: null,
          deliveryOtpHash: null,
          deliveryOtpVerifiedAt: null,
        });
        const savedAssignment = await assignmentRepo.save(assignment);

        assertOrderStatusTransition(
          order.orderStatus,
          OrderStatus.RIDER_ASSIGNED,
        );
        const updateResult = await manager.getRepository(Order).update(
          { id: orderId, orderStatus: order.orderStatus },
          {
            assignedRiderId: riderProfile.userId,
            orderStatus: OrderStatus.RIDER_ASSIGNED,
          },
        );
        if (updateResult?.affected != null && updateResult.affected !== 1) {
          throw new BadRequestException(
            'Order changed during rider assignment',
          );
        }
        const assignReason = `Admin assigned rider ${riderId}`;
        await manager.getRepository(OrderStatusHistory).insert({
          orderId,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.RIDER_ASSIGNED,
          changedByUserId: adminUserId,
          notes: assignReason,
        });
        await this.auditService.recordOrderStatusTransition(
          {
            orderId,
            fromStatus: order.orderStatus,
            toStatus: OrderStatus.RIDER_ASSIGNED,
            actorUserId: adminUserId,
            actorRole: auditActorRole,
            reason: assignReason,
          },
          manager,
        );

        return { assignment: savedAssignment, riderProfile, previous: order };
      });
    } catch (error) {
      if (isCurrentAssignmentUniqueViolation(error)) {
        throw new ConflictException('Order already has an assignment');
      }
      throw error;
    }

    let order: Order;
    try {
      order = await this.ordersService.publishStatusUpdate(
        assignmentResult.previous,
        orderId,
        OrderStatus.RIDER_ASSIGNED,
      );
    } catch (error) {
      this.logger.warn(
        `Post-commit assignment publication failed for order ${orderId}: ${error}`,
      );
      try {
        order = await this.dataSource
          .getRepository(Order)
          .findOneOrFail({ where: { id: orderId } });
      } catch (reloadError) {
        this.logger.warn(
          `Post-commit assignment reload failed for order ${orderId}: ${reloadError}`,
        );
        order = {
          ...assignmentResult.previous,
          assignedRiderId: assignmentResult.riderProfile.userId,
          orderStatus: OrderStatus.RIDER_ASSIGNED,
        };
      }
    }
    return {
      order,
      assignment: sanitizeAssignmentSecrets(assignmentResult.assignment),
      riderProfile: assignmentResult.riderProfile,
    };
  }

  async getAvailableRiders(): Promise<RiderProfile[]> {
    return this.profileRepo.find({ where: { isAvailable: true } });
  }

  async getAllRidersWithUser() {
    const profiles = await this.profileRepo.find({
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    return profiles.map((p) => ({
      id: p.id,
      user_id: p.userId,
      full_name: p.user?.fullName ?? null,
      email: p.user?.email ?? null,
      vehicle_type: p.vehicleType,
      plate_number: p.plateNumber ?? null,
      license_number: p.licenseNumber ?? null,
      is_available: p.isAvailable,
      assignment_eligible:
        p.isAvailable &&
        p.user?.isActive === true &&
        p.user.role === UserRole.RIDER,
      last_latitude: p.lastLatitude ? Number(p.lastLatitude) : null,
      last_longitude: p.lastLongitude ? Number(p.lastLongitude) : null,
      last_location_update: p.lastLocationUpdate ?? null,
      created_at: p.createdAt,
      updated_at: p.updatedAt,
    }));
  }

  async getProfile(userId: number): Promise<RiderProfile> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: ['user'],
    });
    if (!profile) throw new NotFoundException('Rider profile not found');
    return profile;
  }

  async updateProfile(
    userId: number,
    dto: UpdateRiderProfileDto,
  ): Promise<RiderProfile> {
    const profile = await this.getProfile(userId);
    Object.assign(profile, dto);
    return this.profileRepo.save(profile);
  }

  async setAvailability(
    userId: number,
    isAvailable: boolean,
  ): Promise<RiderProfile> {
    const profile = await this.getProfile(userId);
    profile.isAvailable = isAvailable;
    return this.profileRepo.save(profile);
  }

  async updateLocation(
    userId: number,
    dto: UpdateLocationDto,
  ): Promise<RiderProfile> {
    const profile = await this.getProfile(userId);

    // Hard window: accept GPS pings only while at least one current job is in
    // the active-trip tracking statuses (picked_up / out_for_delivery path).
    const activeTripCount = await this.assignmentRepo.count({
      where: {
        riderId: profile.id,
        isCurrent: true,
        status: In([...ACTIVE_TRIP_TRACKING_STATUSES]),
      },
    });
    if (activeTripCount === 0) {
      throw new BadRequestException({
        code: 'tracking_inactive',
        message:
          'Location pings are accepted only during an active trip (picked_up / out_for_delivery)',
      });
    }

    profile.lastLatitude = dto.latitude;
    profile.lastLongitude = dto.longitude;
    profile.lastLocationUpdate = new Date();
    const saved = await this.profileRepo.save(profile);

    const currentStop =
      await this.dispatchPlanService.getCurrentPendingStopForRider(profile.id);
    const currentAssignment = currentStop
      ? await this.assignmentRepo.findOne({
          where: {
            id: currentStop.stop.assignmentId,
            riderId: profile.id,
            isCurrent: true,
            status: In([...ACTIVE_TRIP_TRACKING_STATUSES]),
          },
        })
      : null;
    if (currentStop && currentAssignment) {
      this.locationGateway.broadcastLocation(String(currentAssignment.id), {
        assignmentId: String(currentAssignment.id),
        planVersion: currentStop.planVersion,
        latitude: dto.latitude,
        longitude: dto.longitude,
        timestamp: saved.lastLocationUpdate.toISOString(),
      });
    }

    return saved;
  }

  async getAssignments(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    const assignments = await this.assignmentRepo.find({
      where: { riderId: profile.id },
      relations: ['order'],
      order: { createdAt: 'DESC' },
    });
    return assignments.map((assignment) =>
      sanitizeAssignmentSecrets(assignment),
    );
  }

  async getActiveAssignments(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    const assignments = await this.assignmentRepo
      .createQueryBuilder('da')
      .leftJoinAndSelect('da.order', 'order')
      .leftJoinAndSelect('order.destination', 'destination')
      .leftJoinAndSelect('order.user', 'customer')
      .where('da.riderId = :riderId', { riderId: profile.id })
      .andWhere('da.isCurrent = true')
      .andWhere('da.status NOT IN (:...statuses)', {
        statuses: [
          DeliveryStatus.DELIVERED,
          DeliveryStatus.DECLINED,
          DeliveryStatus.FAILED,
        ],
      })
      .orderBy('da.createdAt', 'DESC')
      .getMany();

    const plan = await this.dispatchPlanService.getActivePlanForRider(
      profile.id,
    );
    if (!plan) {
      return [...assignments]
        .sort((left, right) => left.id - right.id)
        .map((assignment) =>
          Object.assign(sanitizeAssignmentSecrets(assignment), {
            dispatchPlanState: 'unplanned',
            dispatchPlanVersion: null,
            routePosition: null,
            dispatchPlanStop: null,
          }),
        );
    }

    const assignmentById = new Map(
      assignments.map((assignment) => [assignment.id, assignment]),
    );
    const remainingStops = plan.stops
      .filter((stop) => stop.status === DispatchStopStatus.PENDING)
      .sort((left, right) => left.sequence - right.sequence);
    const planned = remainingStops.flatMap((stop, index) => {
      const assignment = assignmentById.get(stop.assignmentId);
      if (!assignment) return [];
      assignmentById.delete(stop.assignmentId);
      return [
        Object.assign(sanitizeAssignmentSecrets(assignment), {
          dispatchPlanState: 'planned',
          dispatchPlanVersion: plan.version,
          routePosition: index + 1,
          dispatchPlanStop: {
            sequence: stop.sequence,
            status: stop.status,
            destinationLatitude: stop.destinationLatitude,
            destinationLongitude: stop.destinationLongitude,
            legDurationSeconds: stop.legDurationSeconds,
            legDistanceMeters: stop.legDistanceMeters,
            legGeometry: stop.legGeometry,
          },
        }),
      ];
    });
    const unplanned = [...assignmentById.values()]
      .sort((left, right) => left.id - right.id)
      .map((assignment) =>
        Object.assign(sanitizeAssignmentSecrets(assignment), {
          dispatchPlanState: 'unplanned',
          dispatchPlanVersion: null,
          routePosition: null,
          dispatchPlanStop: null,
        }),
      );
    return [...planned, ...unplanned];
  }

  async createDispatchPlan(riderId: number, assignmentIds: number[]) {
    const plan = await this.dispatchPlanService.createPlan(
      riderId,
      assignmentIds,
    );
    await this.publishDispatchPlanUpdated(plan, 'created');
    return plan;
  }

  getDispatchPlanForRider(riderId: number) {
    return this.dispatchPlanService.getActivePlanForRider(riderId);
  }

  getDispatchPlan(userId: number) {
    return this.dispatchPlanService.getActivePlanForRiderUser(userId);
  }

  async reoptimizeOwnDispatchPlan(userId: number) {
    const profile = await this.getProfile(userId);
    const active = await this.dispatchPlanService.getActivePlanForRider(
      profile.id,
    );
    if (!active) throw new NotFoundException('Active dispatch plan not found');

    const pendingAssignmentIds = (active.stops ?? [])
      .filter((stop) => stop.status === DispatchStopStatus.PENDING)
      .sort((left, right) => left.sequence - right.sequence)
      .map((stop) => stop.assignmentId);
    if (pendingAssignmentIds.length === 0) {
      throw new NotFoundException(
        'Active dispatch plan has no remaining stops',
      );
    }

    return this.reoptimizeDispatchPlan(
      profile.id,
      pendingAssignmentIds,
      active.id,
    );
  }

  async reoptimizeDispatchPlan(
    riderId: number,
    assignmentIds?: number[],
    expectedActivePlanId?: number,
  ) {
    const plan = await this.dispatchPlanService.reoptimizePlan(
      riderId,
      assignmentIds,
      expectedActivePlanId,
    );
    await this.publishDispatchPlanUpdated(plan, 'reoptimized');
    return plan;
  }

  private async publishDispatchPlanUpdated(
    plan: { id: number; riderId: number; version: number },
    change: 'created' | 'reoptimized',
  ): Promise<void> {
    try {
      const profile = await this.profileRepo.findOne({
        where: { id: plan.riderId },
      });
      if (!profile) {
        this.logger.warn(
          `Dispatch plan ${plan.id} persisted without rider profile ${plan.riderId}`,
        );
        return;
      }
      await Promise.resolve(
        this.ordersGateway.notifyRiderDispatchPlanUpdated(profile.userId, {
          riderProfileId: profile.id,
          planId: plan.id,
          planVersion: plan.version,
          change,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Dispatch plan ${plan.id} WS notification failed for rider ${plan.riderId}: ${error}`,
      );
    }
  }

  async updateDeliveryStatus(
    userId: number,
    assignmentId: number,
    newStatus: DeliveryStatus,
    declineReason?: string,
    proof?: ProofOfDeliveryDto,
    otp?: string,
  ): Promise<DeliveryAssignment> {
    const profile = await this.getProfile(userId);
    const candidateAssignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, riderId: profile.id, isCurrent: true },
    });
    if (!candidateAssignment) {
      throw new NotFoundException('Assignment not found');
    }
    const candidateOrder = await this.dataSource
      .getRepository(Order)
      .findOneOrFail({ where: { id: candidateAssignment.orderId } });

    const result = await this.dataSource.transaction(async (manager) => {
      if (candidateOrder.batchOrderId != null) {
        await manager.getRepository(BatchOrder).findOneOrFail({
          where: { id: candidateOrder.batchOrderId },
          lock: { mode: 'pessimistic_write' },
        });
      }
      const order = await manager.getRepository(Order).findOneOrFail({
        where: { id: candidateAssignment.orderId },
        lock: { mode: 'pessimistic_write' },
      });
      if (order.batchOrderId !== candidateOrder.batchOrderId) {
        throw new BadRequestException(
          'Order batch changed during rider update',
        );
      }
      const assignment = await manager
        .getRepository(DeliveryAssignment)
        .findOne({
          where: { id: assignmentId, riderId: profile.id, isCurrent: true },
          lock: { mode: 'pessimistic_write' },
        });
      if (!assignment) {
        throw new NotFoundException('Assignment not found');
      }
      const lockedProfile = await manager.getRepository(RiderProfile).findOne({
        where: { id: profile.id, userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!lockedProfile) {
        throw new NotFoundException('Rider profile not found');
      }

      const allowedNext = VALID_TRANSITIONS[assignment.status];
      if (!allowedNext.includes(newStatus)) {
        throw new BadRequestException(
          `Cannot transition from '${assignment.status}' to '${newStatus}'`,
        );
      }

      const riderConversations =
        newStatus === DeliveryStatus.DECLINED ||
        newStatus === DeliveryStatus.FAILED
          ? await manager.getRepository(Conversation).find({
              where: {
                orderId: order.id,
                type: ConversationType.RIDER,
                assignedRiderId: userId,
                status: Not(ConversationStatus.CLOSED),
              },
              lock: { mode: 'pessimistic_write' },
              order: { id: 'ASC' },
            })
          : [];

      if (
        newStatus === DeliveryStatus.ARRIVED ||
        newStatus === DeliveryStatus.DELIVERED
      ) {
        await this.dispatchPlanService.assertCurrentStop(
          manager,
          profile.id,
          assignment.id,
        );
      }

      const now = new Date();
      let pickupProofMetadata: DeliveryProofMetadata | null = null;
      let deliveryProofMetadata: DeliveryProofMetadata | null = null;
      let failureProofMetadata: DeliveryProofMetadata | null = null;

      if (newStatus === DeliveryStatus.PICKED_UP) {
        this.assertOtp(
          otp,
          assignment.pickupOtpHash,
          assignment.pickupOtpVerifiedAt,
          'pickup',
        );
        // Pickup requires photo; signature is optional extra on the photo path.
        pickupProofMetadata = await this.validateProofOfDelivery(proof, userId, {
          manager,
          requirePhoto: true,
          allowOptionalSignatureWithPhoto: true,
        });
      }

      if (newStatus === DeliveryStatus.DELIVERED) {
        this.assertOtp(
          otp,
          assignment.deliveryOtpHash,
          assignment.deliveryOtpVerifiedAt,
          'delivery',
        );
        // Delivery: photo required; signature optional alongside photo, or
        // signature-only still accepted for legacy clients until Phase 7 exit.
        deliveryProofMetadata = await this.validateProofOfDelivery(
          proof,
          userId,
          {
            manager,
            requirePhoto: false,
            allowOptionalSignatureWithPhoto: true,
          },
        );
      }

      if (newStatus === DeliveryStatus.FAILED) {
        const reason = declineReason?.trim() ?? '';
        if (!reason) {
          throw new BadRequestException({
            code: 'failed_delivery_reason_required',
            message: 'Failed delivery requires a reason',
          });
        }
        // Evidence photo is mandatory — no unattended / empty failure close.
        failureProofMetadata = await this.validateProofOfDelivery(
          proof,
          userId,
          {
            manager,
            requirePhoto: true,
            allowOptionalSignatureWithPhoto: true,
          },
        );
      }

      assignment.status = newStatus;

      switch (newStatus) {
        case DeliveryStatus.ACCEPTED:
          assignment.acceptedAt = now;
          break;
        case DeliveryStatus.DECLINED:
          assignment.declineReason = declineReason || '';
          assignment.isCurrent = false;
          break;
        case DeliveryStatus.PICKED_UP: {
          assignment.pickedUpAt = now;
          assignment.pickupOtpVerifiedAt = now;
          assignment.pickupProofFileId = pickupProofMetadata!.proofFileId;
          assignment.pickupProofObjectKey =
            pickupProofMetadata!.proofObjectKey;
          assignment.pickupProofSignatureData =
            pickupProofMetadata!.proofSignatureData;
          assignment.pickupProofCapturedAt = now;
          // Issue delivery OTP at confirmed pickup window.
          const deliveryOtpCode = generateDeliveryOtpCode();
          assignment.deliveryOtpCode = deliveryOtpCode;
          assignment.deliveryOtpHash = hashDeliveryOtp(deliveryOtpCode);
          assignment.deliveryOtpVerifiedAt = null;
          break;
        }
        case DeliveryStatus.ON_THE_WAY:
          assignment.onTheWayAt = now;
          break;
        case DeliveryStatus.ARRIVED:
          assignment.arrivedAt = now;
          break;
        case DeliveryStatus.DELIVERED:
          assignment.deliveredAt = now;
          assignment.deliveryOtpVerifiedAt = now;
          assignment.proofType = deliveryProofMetadata!.proofType;
          assignment.proofFileId = deliveryProofMetadata!.proofFileId;
          assignment.proofObjectKey = deliveryProofMetadata!.proofObjectKey;
          assignment.proofSignatureData =
            deliveryProofMetadata!.proofSignatureData;
          assignment.proofCapturedAt = now;
          assignment.proofCapturedByRiderId = profile.id;
          break;
        case DeliveryStatus.FAILED:
          assignment.failedAt = now;
          assignment.declineReason = declineReason?.trim() || '';
          assignment.isCurrent = false;
          assignment.proofType = failureProofMetadata!.proofType;
          assignment.proofFileId = failureProofMetadata!.proofFileId;
          assignment.proofObjectKey = failureProofMetadata!.proofObjectKey;
          assignment.proofSignatureData =
            failureProofMetadata!.proofSignatureData;
          assignment.proofCapturedAt = now;
          assignment.proofCapturedByRiderId = profile.id;
          break;
      }

      const savedAssignment = await manager
        .getRepository(DeliveryAssignment)
        .save(assignment);
      const closedConversationIds = riderConversations.map(
        (conversation) => conversation.id,
      );
      if (closedConversationIds.length > 0) {
        const closeResult = await manager.getRepository(Conversation).update(
          {
            id: In(closedConversationIds),
            status: Not(ConversationStatus.CLOSED),
          },
          {
            status: ConversationStatus.CLOSED,
            closedAt: now,
          },
        );
        if (
          closeResult?.affected != null &&
          closeResult.affected !== closedConversationIds.length
        ) {
          throw new BadRequestException(
            'Rider conversation changed during decline',
          );
        }
      }
      const orderStatus =
        ORDER_STATUS_BY_DELIVERY_STATUS[newStatus] ??
        (newStatus === DeliveryStatus.DECLINED
          ? OrderStatus.READY_FOR_DISPATCH
          : undefined);
      let previous: Order | null = null;
      let surveyRequirement: TamSurveyRequirement | null = null;
      if (newStatus === DeliveryStatus.DELIVERED) {
        const completion = await this.ordersService.completeDelivery(
          manager,
          order.id,
          userId,
        );
        previous = completion.previous;
        surveyRequirement = completion.surveyRequirement;
      } else if (orderStatus) {
        previous = await this.applyOrderStatusChange(
          manager,
          order,
          orderStatus,
          userId,
          newStatus === DeliveryStatus.DECLINED
            ? `Rider declined assignment: ${declineReason?.trim() || 'No reason provided'}`
            : newStatus === DeliveryStatus.FAILED
              ? `Failed delivery (return path): ${declineReason?.trim() || 'No reason provided'}. Redelivery requires new fee approval (ops).`
              : `Rider updated delivery to ${newStatus}`,
          newStatus === DeliveryStatus.DECLINED ||
          newStatus === DeliveryStatus.FAILED
            ? { assignedRiderId: null }
            : {},
        );
      }

      if (newStatus === DeliveryStatus.DELIVERED) {
        const dispatchPlanProgress = await this.dispatchPlanService.advanceStop(
          manager,
          profile.id,
          assignment.id,
          DispatchStopStatus.COMPLETED,
        );
        return {
          savedAssignment,
          orderStatus,
          previous,
          surveyRequirement,
          closedConversationIds,
          dispatchPlanProgress,
          orderRef: order.orderId,
          notifyOpsFailedDelivery: false as const,
          failureReason: null as string | null,
        };
      } else if (
        newStatus === DeliveryStatus.DECLINED ||
        newStatus === DeliveryStatus.FAILED
      ) {
        const dispatchPlanProgress =
          await this.dispatchPlanService.skipStopIfPlanned(
            manager,
            profile.id,
            assignment.id,
          );
        return {
          savedAssignment,
          orderStatus,
          previous,
          surveyRequirement,
          closedConversationIds,
          dispatchPlanProgress,
          orderRef: order.orderId,
          notifyOpsFailedDelivery: newStatus === DeliveryStatus.FAILED,
          failureReason:
            newStatus === DeliveryStatus.FAILED
              ? declineReason?.trim() || null
              : null,
        };
      }

      return {
        savedAssignment,
        orderStatus,
        previous,
        surveyRequirement,
        closedConversationIds,
        dispatchPlanProgress: null,
        orderRef: order.orderId,
        notifyOpsFailedDelivery: false as const,
        failureReason: null as string | null,
      };
    });

    await this.publishRiderAssignmentUpdated(
      userId,
      result.savedAssignment,
      result.orderRef,
    );
    if (result.notifyOpsFailedDelivery) {
      try {
        await this.notificationsService.createForAllAdmins({
          title: 'Failed delivery — return path',
          message: `Order ${result.orderRef} failed delivery. Reason: ${result.failureReason ?? 'n/a'}. Redelivery requires new fee approval before redispatch.`,
          type: 'failed_delivery',
          orderRef: result.orderRef,
          metadata: {
            assignmentId: result.savedAssignment.id,
            orderId: result.savedAssignment.orderId,
            failureReason: result.failureReason,
            redeliveryFeeRequired: true,
            redeliveryFeeApproval: 'ops_stub',
          },
        });
      } catch (error) {
        this.logger.warn(
          `Ops failed-delivery notification failed for order ${result.orderRef}: ${error}`,
        );
      }
    }
    if (result.dispatchPlanProgress) {
      await this.publishDispatchPlanProgress(
        userId,
        profile.id,
        result.dispatchPlanProgress,
      );
    }

    if (
      result.savedAssignment.status === DeliveryStatus.DELIVERED ||
      result.savedAssignment.status === DeliveryStatus.FAILED
    ) {
      try {
        await this.publishCurrentDeliveryQueue(profile.id);
      } catch (error) {
        this.logger.warn(
          `Post-commit queue promotion failed after assignment ${assignmentId}: ${error}`,
        );
      }
    }

    if (result.closedConversationIds.length > 0) {
      try {
        this.chatGateway.notifyConversationClosed(result.closedConversationIds);
      } catch (error) {
        this.logger.warn(
          `Rider chat room revocation failed for assignment ${assignmentId}: ${error}`,
        );
      }
    }

    if (result.orderStatus && result.previous) {
      try {
        if (result.surveyRequirement) {
          await this.ordersService.publishStatusUpdate(
            result.previous,
            result.previous.id,
            result.orderStatus,
            result.surveyRequirement,
          );
        } else {
          await this.ordersService.publishStatusUpdate(
            result.previous,
            result.previous.id,
            result.orderStatus,
          );
        }
      } catch (error) {
        this.logger.warn(
          `Post-commit delivery publication failed for order ${result.previous.id}: ${error}`,
        );
      }
    }

    return sanitizeAssignmentSecrets(result.savedAssignment);
  }

  private assertOtp(
    submitted: string | undefined,
    expectedHash: string | null | undefined,
    alreadyVerifiedAt: Date | null | undefined,
    kind: 'pickup' | 'delivery',
  ): void {
    if (alreadyVerifiedAt) {
      throw new BadRequestException(
        `${kind === 'pickup' ? 'Pickup' : 'Delivery'} already completed`,
      );
    }
    if (!submitted?.trim()) {
      throw new BadRequestException(
        `${kind === 'pickup' ? 'Pickup' : 'Delivery'} OTP is required`,
      );
    }
    if (!expectedHash) {
      throw new BadRequestException(
        `${kind === 'pickup' ? 'Pickup' : 'Delivery'} OTP is not available`,
      );
    }
    if (!otpCodesMatch(submitted, expectedHash)) {
      throw new BadRequestException('Invalid OTP');
    }
  }

  private async publishRiderAssignmentUpdated(
    riderUserId: number,
    assignment: DeliveryAssignment,
    orderRef: string,
  ): Promise<void> {
    try {
      await Promise.resolve(
        this.ordersGateway.notifyRiderAssignment(riderUserId, {
          assignmentId: assignment.id,
          orderId: assignment.orderId,
          orderRef,
          status: assignment.status,
          change:
            assignment.status === DeliveryStatus.DECLINED
              ? 'unassigned'
              : 'statusUpdated',
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Rider assignment WS notification failed for assignment ${assignment.id}: ${error}`,
      );
    }
  }

  private async publishDispatchPlanProgress(
    riderUserId: number,
    riderProfileId: number,
    progress: DispatchPlanProgress,
  ): Promise<void> {
    try {
      await Promise.resolve(
        this.ordersGateway.notifyRiderDispatchPlanUpdated(riderUserId, {
          riderProfileId,
          planId: progress.planId,
          planVersion: progress.planVersion,
          change:
            progress.planStatus === DispatchPlanStatus.COMPLETED
              ? 'completed'
              : progress.stopStatus === DispatchStopStatus.SKIPPED
                ? 'stopSkipped'
                : 'stopCompleted',
          assignmentId: progress.assignmentId,
          stopStatus: progress.stopStatus,
          planStatus: progress.planStatus,
        }),
      );
    } catch (error) {
      this.logger.warn(
        `Dispatch plan ${progress.planId} progress WS notification failed for rider ${riderProfileId}: ${error}`,
      );
    }
  }

  private async publishCurrentDeliveryQueue(riderId: number): Promise<void> {
    const plan = await this.dispatchPlanService.getActivePlanForRider(riderId);
    const pendingStops = (plan?.stops ?? [])
      .filter((stop) => stop.status === DispatchStopStatus.PENDING)
      .sort((left, right) => left.sequence - right.sequence);
    const currentStop = pendingStops[0];
    if (!plan || !currentStop) return;

    const assignment = await this.assignmentRepo.findOne({
      where: {
        id: currentStop.assignmentId,
        riderId,
        isCurrent: true,
        status: In([
          DeliveryStatus.ASSIGNED,
          DeliveryStatus.ACCEPTED,
          DeliveryStatus.PICKED_UP,
          DeliveryStatus.ON_THE_WAY,
          DeliveryStatus.ARRIVED,
        ]),
      },
      relations: ['order'],
    });
    if (!assignment?.order) return;

    const canTrackDelivery = [
      DeliveryStatus.ON_THE_WAY,
      DeliveryStatus.ARRIVED,
    ].includes(assignment.status);
    const payload: DeliveryQueueUpdatedPayload = {
      orderId: assignment.order.id,
      orderRef: assignment.order.orderId,
      queuePosition: 1,
      queueSize: pendingStops.length,
      canTrackDelivery,
      assignmentId: canTrackDelivery ? assignment.id : null,
      planVersion: plan.version,
    };
    this.ordersGateway.notifyDeliveryQueueUpdated(
      assignment.order.userId,
      payload,
    );
  }

  private async applyOrderStatusChange(
    manager: EntityManager,
    order: Order,
    toStatus: OrderStatus,
    actorUserId: number,
    reason: string,
    updates: Partial<Order>,
  ): Promise<Order | null> {
    assertOrderStatusTransition(order.orderStatus, toStatus);
    if (order.orderStatus === toStatus) return null;

    const updateResult = await manager
      .getRepository(Order)
      .update(
        { id: order.id, orderStatus: order.orderStatus },
        { ...updates, orderStatus: toStatus },
      );
    if (updateResult?.affected != null && updateResult.affected !== 1) {
      throw new BadRequestException('Order changed during rider update');
    }
    await manager.getRepository(OrderStatusHistory).insert({
      orderId: order.id,
      fromStatus: order.orderStatus,
      toStatus,
      changedByUserId: actorUserId,
      notes: reason,
    });
    await this.auditService.recordOrderStatusTransition(
      {
        orderId: order.id,
        fromStatus: order.orderStatus,
        toStatus,
        actorUserId,
        actorRole: UserRole.RIDER,
        reason,
      },
      manager,
    );
    return order;
  }

  private async validateProofOfDelivery(
    proof: ProofOfDeliveryDto | undefined,
    riderUserId: number | undefined,
    options: {
      manager?: EntityManager;
      requirePhoto: boolean;
      allowOptionalSignatureWithPhoto: boolean;
    },
  ): Promise<DeliveryProofMetadata> {
    if (!proof) {
      throw new BadRequestException('Proof of delivery is required');
    }

    if (proof.type === ProofOfDeliveryType.PHOTO) {
      if (!Number.isInteger(proof.fileId) || proof.fileId! <= 0) {
        throw new BadRequestException('Photo proof requires a file id');
      }
      if (!riderUserId || !options.manager) {
        throw new BadRequestException('Proof validation context is required');
      }
      const file = await this.filesService.resolveDeliveryProofFile(
        proof.fileId!,
        riderUserId,
        options.manager,
      );

      let signatureData: string | null = null;
      if (proof.signatureData != null) {
        if (!options.allowOptionalSignatureWithPhoto) {
          throw new BadRequestException('Unsupported mixed proof payload');
        }
        const trimmed = proof.signatureData.trim();
        if (!trimmed) {
          throw new BadRequestException('Signature proof is required');
        }
        if (Buffer.byteLength(trimmed, 'utf8') > MAX_SIGNATURE_PROOF_BYTES) {
          throw new BadRequestException('Signature proof is too large');
        }
        if (!hasValidSignatureStroke(trimmed)) {
          throw new BadRequestException('Invalid signature proof');
        }
        signatureData = trimmed;
      }

      return {
        proofType: ProofOfDeliveryType.PHOTO,
        proofFileId: file.id,
        proofObjectKey: file.objectKey,
        proofSignatureData: signatureData,
      };
    }

    if (proof.type === ProofOfDeliveryType.SIGNATURE) {
      if (options.requirePhoto) {
        throw new BadRequestException('Photo proof is required');
      }
      if (proof.fileId != null || proof.objectKey != null) {
        throw new BadRequestException('Unsupported mixed proof payload');
      }
      const signatureData = proof.signatureData?.trim();
      if (!signatureData) {
        throw new BadRequestException('Signature proof is required');
      }
      if (
        Buffer.byteLength(signatureData, 'utf8') > MAX_SIGNATURE_PROOF_BYTES
      ) {
        throw new BadRequestException('Signature proof is too large');
      }
      if (!hasValidSignatureStroke(signatureData)) {
        throw new BadRequestException('Invalid signature proof');
      }
      return {
        proofType: ProofOfDeliveryType.SIGNATURE,
        proofFileId: null,
        proofObjectKey: null,
        proofSignatureData: signatureData,
      };
    }

    throw new BadRequestException('Unsupported proof of delivery type');
  }

  async getHistory(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    const history = await this.assignmentRepo.find({
      where: { riderId: profile.id, status: DeliveryStatus.DELIVERED },
      relations: ['order', 'order.destination', 'order.user'],
      order: { deliveredAt: 'DESC' },
    });
    return history.map((assignment) => sanitizeAssignmentSecrets(assignment));
  }

  async getEarnings(
    userId: number,
  ): Promise<{ total: number; deliveries: number }> {
    const profile = await this.getProfile(userId);
    const deliveredAssignments = await this.assignmentRepo.find({
      where: { riderId: profile.id, status: DeliveryStatus.DELIVERED },
      relations: ['order'],
    });

    const total = deliveredAssignments.reduce((sum, a) => {
      return sum + Number(a.order?.deliveryFee || 0);
    }, 0);

    return { total, deliveries: deliveredAssignments.length };
  }
}
