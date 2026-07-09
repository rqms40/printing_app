import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RiderProfile } from './entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
  ProofOfDeliveryType,
} from './entities/delivery-assignment.entity';
import { OrderStatus } from '../orders/entities/order.entity';
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

@Injectable()
export class RidersService {
  constructor(
    @InjectRepository(RiderProfile)
    private profileRepo: Repository<RiderProfile>,
    @InjectRepository(DeliveryAssignment)
    private assignmentRepo: Repository<DeliveryAssignment>,
    private locationGateway: LocationGateway,
    private ordersService: OrdersService,
  ) {}

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
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, riderId: profile.id },
    });

    if (!assignment) {
      throw new NotFoundException('Assignment not found');
    }

    // Validate state machine transition
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

    // Set timestamp for the status
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

    const orderStatus = ORDER_STATUS_BY_DELIVERY_STATUS[newStatus];
    if (orderStatus) {
      await this.ordersService.updateStatus(assignment.orderId, orderStatus);
    } else if (newStatus === DeliveryStatus.DECLINED) {
      await this.ordersService.updateStatus(
        assignment.orderId,
        OrderStatus.READY_FOR_DISPATCH,
        { assignedRiderId: null },
      );
    }

    return this.assignmentRepo.save(assignment);
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
