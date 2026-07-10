import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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
  orderDeliveryAssignmentsByRoute,
  SHOP_LOCATION,
  toGeoPoint,
} from './delivery-route';

// Valid state transitions for delivery status
const VALID_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  [DeliveryStatus.ASSIGNED]: [DeliveryStatus.ACCEPTED, DeliveryStatus.DECLINED],
  [DeliveryStatus.ACCEPTED]: [DeliveryStatus.PICKED_UP],
  [DeliveryStatus.DECLINED]: [],
  [DeliveryStatus.PICKED_UP]: [DeliveryStatus.ON_THE_WAY],
  [DeliveryStatus.ON_THE_WAY]: [DeliveryStatus.ARRIVED],
  [DeliveryStatus.ARRIVED]: [DeliveryStatus.DELIVERED],
  [DeliveryStatus.DELIVERED]: [],
};

const ORDER_STATUS_BY_DELIVERY_STATUS: Partial<
  Record<DeliveryStatus, OrderStatus>
> = {
  [DeliveryStatus.ACCEPTED]: OrderStatus.RIDER_ASSIGNED,
  [DeliveryStatus.PICKED_UP]: OrderStatus.PICKED_UP,
  [DeliveryStatus.ON_THE_WAY]: OrderStatus.ON_THE_WAY,
  [DeliveryStatus.ARRIVED]: OrderStatus.ARRIVED_AT_DESTINATION,
  [DeliveryStatus.DELIVERED]: OrderStatus.DELIVERED,
};

type DeliveryProofMetadata = {
  proofType: ProofOfDeliveryType;
  proofFileId: number | null;
  proofObjectKey: string | null;
  proofSignatureData: string | null;
};

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
    private ordersService: OrdersService,
    private dataSource: DataSource,
  ) {}

  async assignOrderToRider(
    orderId: number,
    riderId: number,
    adminUserId: number,
  ): Promise<RiderAssignmentResult> {
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
        const assignment = assignmentRepo.create({
          orderId,
          riderId,
          status: DeliveryStatus.ASSIGNED,
          isCurrent: true,
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
        await manager.getRepository(OrderStatusHistory).insert({
          orderId,
          fromStatus: order.orderStatus,
          toStatus: OrderStatus.RIDER_ASSIGNED,
          changedByUserId: adminUserId,
          notes: `Admin assigned rider ${riderId}`,
        });

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
      order = await this.dataSource
        .getRepository(Order)
        .findOneOrFail({ where: { id: orderId } });
    }
    return {
      order,
      assignment: assignmentResult.assignment,
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
    profile.lastLatitude = dto.latitude;
    profile.lastLongitude = dto.longitude;
    profile.lastLocationUpdate = new Date();
    const saved = await this.profileRepo.save(profile);

    const [currentStop] = await this.getActiveAssignments(userId);
    if (
      currentStop &&
      [DeliveryStatus.ON_THE_WAY, DeliveryStatus.ARRIVED].includes(
        currentStop.status,
      )
    ) {
      this.locationGateway.broadcastLocation(String(currentStop.id), {
        latitude: dto.latitude,
        longitude: dto.longitude,
        timestamp: profile.lastLocationUpdate,
      });
    }

    return saved;
  }

  async getAssignments(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    return this.assignmentRepo.find({
      where: { riderId: profile.id },
      relations: ['order'],
      order: { createdAt: 'DESC' },
    });
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
        statuses: [DeliveryStatus.DELIVERED, DeliveryStatus.DECLINED],
      })
      .orderBy('da.createdAt', 'DESC')
      .getMany();

    return this.orderAssignmentsByRoute(assignments, profile);
  }

  private orderAssignmentsByRoute(
    assignments: DeliveryAssignment[],
    profile: RiderProfile,
  ): DeliveryAssignment[] {
    const startPoint =
      toGeoPoint(profile.lastLatitude, profile.lastLongitude) ?? SHOP_LOCATION;
    return orderDeliveryAssignmentsByRoute(assignments, startPoint);
  }

  async updateDeliveryStatus(
    userId: number,
    assignmentId: number,
    newStatus: DeliveryStatus,
    declineReason?: string,
    proof?: ProofOfDeliveryDto,
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

      if (newStatus === DeliveryStatus.ARRIVED) {
        const [currentStop] = await this.getActiveAssignments(userId);
        if (currentStop?.id !== assignment.id) {
          throw new BadRequestException(
            'Complete the current route stop before advancing this delivery',
          );
        }
      }

      const now = new Date();
      const proofMetadata =
        newStatus === DeliveryStatus.DELIVERED
          ? this.validateProofOfDelivery(proof)
          : null;

      assignment.status = newStatus;

      switch (newStatus) {
        case DeliveryStatus.ACCEPTED:
          assignment.acceptedAt = now;
          break;
        case DeliveryStatus.DECLINED:
          assignment.declineReason = declineReason || '';
          assignment.isCurrent = false;
          break;
        case DeliveryStatus.PICKED_UP:
          assignment.pickedUpAt = now;
          break;
        case DeliveryStatus.ON_THE_WAY:
          assignment.onTheWayAt = now;
          break;
        case DeliveryStatus.ARRIVED:
          assignment.arrivedAt = now;
          break;
        case DeliveryStatus.DELIVERED:
          assignment.deliveredAt = now;
          assignment.proofType = proofMetadata!.proofType;
          assignment.proofFileId = proofMetadata!.proofFileId;
          assignment.proofObjectKey = proofMetadata!.proofObjectKey;
          assignment.proofSignatureData = proofMetadata!.proofSignatureData;
          assignment.proofCapturedAt = now;
          assignment.proofCapturedByRiderId = profile.id;
          break;
      }

      const savedAssignment = await manager
        .getRepository(DeliveryAssignment)
        .save(assignment);
      const orderStatus =
        ORDER_STATUS_BY_DELIVERY_STATUS[newStatus] ??
        (newStatus === DeliveryStatus.DECLINED
          ? OrderStatus.READY_FOR_DISPATCH
          : undefined);
      const previous = orderStatus
        ? await this.applyOrderStatusChange(
            manager,
            order,
            orderStatus,
            userId,
            newStatus === DeliveryStatus.DECLINED
              ? `Rider declined assignment: ${declineReason?.trim() || 'No reason provided'}`
              : `Rider updated delivery to ${newStatus}`,
            newStatus === DeliveryStatus.DECLINED
              ? { assignedRiderId: null }
              : {},
          )
        : null;

      return { savedAssignment, orderStatus, previous };
    });

    if (result.orderStatus && result.previous) {
      try {
        await this.ordersService.publishStatusUpdate(
          result.previous,
          result.previous.id,
          result.orderStatus,
        );
      } catch (error) {
        this.logger.warn(
          `Post-commit delivery publication failed for order ${result.previous.id}: ${error}`,
        );
      }
    }

    return result.savedAssignment;
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
    return order;
  }

  private validateProofOfDelivery(
    proof?: ProofOfDeliveryDto,
  ): DeliveryProofMetadata {
    if (!proof) {
      throw new BadRequestException('Proof of delivery is required');
    }

    if (proof.type === ProofOfDeliveryType.PHOTO) {
      if (proof.fileId == null && !proof.objectKey?.trim()) {
        throw new BadRequestException(
          'Photo proof requires a file id or object key',
        );
      }
      return {
        proofType: ProofOfDeliveryType.PHOTO,
        proofFileId: proof.fileId ?? null,
        proofObjectKey: proof.objectKey?.trim() || null,
        proofSignatureData: null,
      };
    }

    if (proof.type === ProofOfDeliveryType.SIGNATURE) {
      const signatureData = proof.signatureData?.trim();
      if (!signatureData) {
        throw new BadRequestException('Signature proof is required');
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
    return this.assignmentRepo.find({
      where: { riderId: profile.id, status: DeliveryStatus.DELIVERED },
      relations: ['order', 'order.destination', 'order.user'],
      order: { deliveredAt: 'DESC' },
    });
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
