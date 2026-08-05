import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from '../users/entities/user.entity';
import { AuditEvent } from '../audit/entities/audit-event.entity';
import { AuditService } from '../audit/audit.service';
import {
  RiderProfile,
  RiderVerificationStatus,
} from '../riders/entities/rider-profile.entity';
import { Order } from '../orders/entities/order.entity';
import {
  CodCollection,
  CodCollectionStatus,
} from '../payments/entities/cod-collection.entity';
import {
  Payout,
  PayoutSettlementState,
} from '../payouts/entities/payout.entity';
import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { DataSource } from 'typeorm';

export type AuditListQuery = {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
  orderId?: number;
  actorId?: number;
};

@Injectable()
export class SuperService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(AuditEvent)
    private readonly auditRepo: Repository<AuditEvent>,
    @InjectRepository(RiderProfile)
    private readonly riderRepo: Repository<RiderProfile>,
    @InjectRepository(Order)
    private readonly ordersRepo: Repository<Order>,
    @InjectRepository(CodCollection)
    private readonly codRepo: Repository<CodCollection>,
    @InjectRepository(Payout)
    private readonly payoutRepo: Repository<Payout>,
    @InjectRepository(SupplierProfile)
    private readonly supplierRepo: Repository<SupplierProfile>,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Super-admin-only role change. Blocks demoting the last super_admin
   * and self-lockout demotion of the acting super admin to non-admin.
   */
  async updateUserRole(
    targetUserId: number,
    role: UserRole,
    actorUserId: number,
    actorRole: string,
  ): Promise<User> {
    if (actorRole !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super_admin can change roles');
    }

    const user = await this.usersRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const previousRole = user.role;

    if (
      previousRole === UserRole.SUPER_ADMIN &&
      role !== UserRole.SUPER_ADMIN
    ) {
      const superCount = await this.usersRepo.count({
        where: { role: UserRole.SUPER_ADMIN, isActive: true },
      });
      if (superCount <= 1) {
        throw new BadRequestException(
          'Cannot demote the last active super_admin',
        );
      }
    }

    if (targetUserId === actorUserId && role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Cannot demote your own super_admin role',
      );
    }

    user.role = role;
    const saved = await this.usersRepo.save(user);

    await this.auditService.append({
      actorId: actorUserId,
      actorRole,
      action: 'role_change',
      entityType: 'user',
      entityId: String(targetUserId),
      fromState: previousRole,
      toState: role,
      reason: 'super_admin_role_console',
      metadata: { targetUserId, email: user.email },
    });

    return saved;
  }

  async listAudit(query: AuditListQuery) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 25));
    const qb = this.auditRepo
      .createQueryBuilder('a')
      .orderBy('a.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (query.action) {
      qb.andWhere('a.action = :action', { action: query.action });
    }
    if (query.entityType) {
      qb.andWhere('a.entityType = :entityType', {
        entityType: query.entityType,
      });
    }
    if (query.orderId != null) {
      qb.andWhere('a.orderId = :orderId', { orderId: query.orderId });
    }
    if (query.actorId != null) {
      qb.andWhere('a.actorId = :actorId', { actorId: query.actorId });
    }

    const [items, total] = await qb.getManyAndCount();
    return {
      items,
      total,
      page,
      limit,
      pageCount: Math.ceil(total / limit) || 1,
    };
  }

  async platformHealth() {
    let dbStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await this.dataSource.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      /* probe failed */
    }

    const [
      usersTotal,
      clients,
      suppliers,
      riders,
      opsAdmins,
      superAdmins,
      ordersTotal,
      openCodRecon,
      heldPayouts,
      pendingSupplierVerification,
      pendingRiderVerification,
      recentAudit,
    ] = await Promise.all([
      this.usersRepo.count(),
      this.usersRepo.count({ where: { role: UserRole.CLIENT } }),
      this.usersRepo.count({ where: { role: UserRole.SUPPLIER } }),
      this.usersRepo.count({ where: { role: UserRole.RIDER } }),
      this.usersRepo.count({ where: { role: UserRole.OPS_ADMIN } }),
      this.usersRepo.count({ where: { role: UserRole.SUPER_ADMIN } }),
      this.ordersRepo.count(),
      this.codRepo.count({ where: { status: CodCollectionStatus.COLLECTED } }),
      this.payoutRepo.count({
        where: { settlementState: PayoutSettlementState.HELD },
      }),
      this.supplierRepo
        .createQueryBuilder('s')
        .leftJoin('s.verification', 'v')
        .where('v.status IN (:...st)', {
          st: ['pending', 'under_review'],
        })
        .getCount()
        .catch(() => 0),
      this.riderRepo.count({
        where: [
          { verificationStatus: RiderVerificationStatus.PENDING },
          { verificationStatus: RiderVerificationStatus.UNDER_REVIEW },
        ],
      }),
      this.auditRepo.count(),
    ]);

    return {
      status: dbStatus === 'connected' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      database: dbStatus,
      counts: {
        usersTotal,
        clients,
        suppliers,
        riders,
        opsAdmins,
        superAdmins,
        ordersTotal,
        openCodRecon,
        heldPayouts,
        pendingSupplierVerification,
        pendingRiderVerification,
        auditEvents: recentAudit,
      },
    };
  }

  async setRiderVerification(
    riderProfileId: number,
    status: RiderVerificationStatus,
    reviewedBy: number,
    notes?: string | null,
  ): Promise<RiderProfile> {
    const profile = await this.riderRepo.findOne({
      where: { id: riderProfileId },
      relations: { user: true },
    });
    if (!profile) {
      throw new NotFoundException(`Rider profile ${riderProfileId} not found`);
    }

    const previous = profile.verificationStatus;
    profile.verificationStatus = status;
    profile.verificationNotes = notes ?? null;
    profile.verificationReviewedBy = reviewedBy;
    profile.verificationReviewedAt = new Date();

    // Unverified riders should not appear available for assignment.
    if (status !== RiderVerificationStatus.VERIFIED) {
      profile.isAvailable = false;
    }

    const saved = await this.riderRepo.save(profile);

    await this.auditService.append({
      actorId: reviewedBy,
      actorRole: UserRole.SUPER_ADMIN,
      action: 'rider_verification',
      entityType: 'rider_profile',
      entityId: String(riderProfileId),
      fromState: previous,
      toState: status,
      reason: notes ?? null,
      metadata: { userId: profile.userId },
    });

    return saved;
  }

  async listRidersForVerification() {
    const profiles = await this.riderRepo.find({
      relations: { user: true },
      order: { id: 'ASC' },
    });
    return profiles.map((p) => ({
      id: p.id,
      userId: p.userId,
      fullName: p.user?.fullName ?? null,
      email: p.user?.email ?? null,
      vehicleType: p.vehicleType,
      plateNumber: p.plateNumber,
      isAvailable: p.isAvailable,
      verificationStatus: p.verificationStatus,
      verificationNotes: p.verificationNotes,
      verificationReviewedBy: p.verificationReviewedBy,
      verificationReviewedAt: p.verificationReviewedAt,
      createdAt: p.createdAt,
    }));
  }
}
