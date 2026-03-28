import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DriverProfile } from './entities/driver-profile.entity';
import { DeliveryAssignment, DeliveryStatus } from './entities/delivery-assignment.entity';
import { Order } from '../orders/entities/order.entity';
import { UpdateDriverProfileDto } from './dto/update-profile.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationGateway } from './location.gateway';

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

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(DriverProfile) private profileRepo: Repository<DriverProfile>,
    @InjectRepository(DeliveryAssignment) private assignmentRepo: Repository<DeliveryAssignment>,
    @InjectRepository(Order) private orderRepo: Repository<Order>,
    private locationGateway: LocationGateway,
  ) {}

  async getProfile(userId: number): Promise<DriverProfile> {
    const profile = await this.profileRepo.findOne({ where: { userId } });
    if (!profile) throw new NotFoundException('Driver profile not found');
    return profile;
  }

  async updateProfile(userId: number, dto: UpdateDriverProfileDto): Promise<DriverProfile> {
    const profile = await this.getProfile(userId);
    Object.assign(profile, dto);
    return this.profileRepo.save(profile);
  }

  async setAvailability(userId: number, isAvailable: boolean): Promise<DriverProfile> {
    const profile = await this.getProfile(userId);
    profile.isAvailable = isAvailable;
    return this.profileRepo.save(profile);
  }

  async updateLocation(userId: number, dto: UpdateLocationDto): Promise<DriverProfile> {
    const profile = await this.getProfile(userId);
    profile.lastLatitude = dto.latitude;
    profile.lastLongitude = dto.longitude;
    profile.lastLocationUpdate = new Date();
    const saved = await this.profileRepo.save(profile);

    // Broadcast location to all active delivery assignments
    const activeAssignments = await this.assignmentRepo.find({
      where: { driverId: profile.id },
    });
    for (const assignment of activeAssignments) {
      if (![DeliveryStatus.DELIVERED, DeliveryStatus.DECLINED].includes(assignment.status)) {
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
      where: { driverId: profile.id },
      relations: ['order'],
      order: { createdAt: 'DESC' },
    });
  }

  async getActiveAssignments(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    return this.assignmentRepo
      .createQueryBuilder('da')
      .leftJoinAndSelect('da.order', 'order')
      .where('da.driverId = :driverId', { driverId: profile.id })
      .andWhere('da.status NOT IN (:...statuses)', {
        statuses: [DeliveryStatus.DELIVERED, DeliveryStatus.DECLINED],
      })
      .orderBy('da.createdAt', 'DESC')
      .getMany();
  }

  async updateDeliveryStatus(
    userId: number,
    assignmentId: number,
    newStatus: DeliveryStatus,
    declineReason?: string,
  ): Promise<DeliveryAssignment> {
    const profile = await this.getProfile(userId);
    const assignment = await this.assignmentRepo.findOne({
      where: { id: assignmentId, driverId: profile.id },
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

    return this.assignmentRepo.save(assignment);
  }

  async getHistory(userId: number): Promise<DeliveryAssignment[]> {
    const profile = await this.getProfile(userId);
    return this.assignmentRepo.find({
      where: { driverId: profile.id, status: DeliveryStatus.DELIVERED },
      relations: ['order'],
      order: { deliveredAt: 'DESC' },
    });
  }

  async getEarnings(userId: number): Promise<{ total: number; deliveries: number }> {
    const profile = await this.getProfile(userId);
    const deliveredAssignments = await this.assignmentRepo.find({
      where: { driverId: profile.id, status: DeliveryStatus.DELIVERED },
      relations: ['order'],
    });

    const total = deliveredAssignments.reduce((sum, a) => {
      return sum + Number(a.order?.deliveryFee || 0);
    }, 0);

    return { total, deliveries: deliveredAssignments.length };
  }
}
