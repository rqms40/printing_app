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
} from './entities/delivery-assignment.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { UpdateRiderProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationGateway } from './location.gateway';
import { OrdersGateway } from '../orders/orders.gateway';

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

const SHOP_LOCATION = {
  latitude: 7.064,
  longitude: 125.6079,
};

type GeoPoint = {
  latitude: number;
  longitude: number;
};

@Injectable()
export class RidersService {
  constructor(
    @InjectRepository(RiderProfile)
    private profileRepo: Repository<RiderProfile>,
    @InjectRepository(DeliveryAssignment)
    private assignmentRepo: Repository<DeliveryAssignment>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private locationGateway: LocationGateway,
    private ordersGateway: OrdersGateway,
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
    const profile = await this.profileRepo.findOne({ where: { userId } });
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

    // Broadcast location to all active delivery assignments
    const activeAssignments = await this.assignmentRepo.find({
      where: { riderId: profile.id },
    });
    for (const assignment of activeAssignments) {
      if (
        ![DeliveryStatus.DELIVERED, DeliveryStatus.DECLINED].includes(
          assignment.status,
        )
      ) {
        this.locationGateway.broadcastLocation(String(assignment.id), {
          latitude: dto.latitude,
          longitude: dto.longitude,
          timestamp: profile.lastLocationUpdate,
        });
      }
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
      this.toGeoPoint(profile.lastLatitude, profile.lastLongitude) ??
      SHOP_LOCATION;

    const routeable = assignments
      .map((assignment, index) => ({
        assignment,
        index,
        point: this.toGeoPoint(
          assignment.order?.destination?.latitude,
          assignment.order?.destination?.longitude,
        ),
      }))
      .filter(
        (
          candidate,
        ): candidate is {
          assignment: DeliveryAssignment;
          index: number;
          point: GeoPoint;
        } => candidate.point !== null,
      );

    const missingCoordinates = assignments.filter(
      (assignment) =>
        !this.toGeoPoint(
          assignment.order?.destination?.latitude,
          assignment.order?.destination?.longitude,
        ),
    );

    const ordered: DeliveryAssignment[] = [];
    let currentPoint = startPoint;
    const remaining = [...routeable];

    while (remaining.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;

      for (let i = 0; i < remaining.length; i += 1) {
        const distance = this.distanceKm(currentPoint, remaining[i].point);
        if (
          distance < nearestDistance ||
          (distance === nearestDistance &&
            remaining[i].index < remaining[nearestIndex].index)
        ) {
          nearestIndex = i;
          nearestDistance = distance;
        }
      }

      const [nearest] = remaining.splice(nearestIndex, 1);
      ordered.push(nearest.assignment);
      currentPoint = nearest.point;
    }

    return [...ordered, ...missingCoordinates];
  }

  private toGeoPoint(
    latitude: number | string | null | undefined,
    longitude: number | string | null | undefined,
  ): GeoPoint | null {
    if (latitude == null || longitude == null) return null;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return { latitude: lat, longitude: lng };
  }

  private distanceKm(from: GeoPoint, to: GeoPoint): number {
    const toRadians = (value: number) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRadians(to.latitude - from.latitude);
    const dLng = toRadians(to.longitude - from.longitude);
    const fromLat = toRadians(from.latitude);
    const toLat = toRadians(to.latitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLng / 2) ** 2;
    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async updateDeliveryStatus(
    userId: number,
    assignmentId: number,
    newStatus: DeliveryStatus,
    declineReason?: string,
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

    assignment.status = newStatus;

    // Set timestamp for the status
    const now = new Date();
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
        break;
    }

    const orderStatus = ORDER_STATUS_BY_DELIVERY_STATUS[newStatus];
    if (orderStatus) {
      await this.orderRepo.update(assignment.orderId, { orderStatus });
      const order = await this.orderRepo.findOne({
        where: { id: assignment.orderId },
      });
      if (order) {
        void this.ordersGateway.notifyOrderUpdate(order.orderId, order);
      }
    }

    return this.assignmentRepo.save(assignment);
  }

  async getHistory(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    return this.assignmentRepo.find({
      where: { riderId: profile.id, status: DeliveryStatus.DELIVERED },
      relations: ['order'],
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
