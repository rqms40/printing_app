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
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../suppliers/entities/supplier-verification.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
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
    @InjectRepository(SupplierVerification)
    private readonly supplierVerificationRepo: Repository<SupplierVerification>,
    @InjectRepository(SupplierCapability)
    private readonly supplierCapabilityRepo: Repository<SupplierCapability>,
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

    // Super Admin is a singular platform role: not assignable via this console.
    // The seeded/existing super_admin account is the only intended holder.
    if (role === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'super_admin cannot be assigned through role management. There is only one Super Admin account.',
      );
    }

    const user = await this.usersRepo.findOne({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException(`User ${targetUserId} not found`);
    }

    const previousRole = user.role;

    // Never reassign the Super Admin account away from super_admin via this API.
    if (previousRole === UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'The Super Admin role cannot be changed on this account. It is limited to a single platform owner.',
      );
    }

    if (targetUserId === actorUserId && role !== UserRole.SUPER_ADMIN) {
      throw new BadRequestException(
        'Cannot demote your own super_admin role',
      );
    }

    user.role = role;
    const saved = await this.usersRepo.save(user);

    // Verification queues list *profiles*, not bare user roles.
    // Role change alone never created supplier_profiles / rider_profiles,
    // so Super → Verification stayed empty. Ensure pending shells exist.
    const provision = await this.ensureVerificationShellForRole(
      saved,
      previousRole,
    );

    await this.auditService.append({
      actorId: actorUserId,
      actorRole,
      action: 'role_change',
      entityType: 'user',
      entityId: String(targetUserId),
      fromState: previousRole,
      toState: role,
      reason: 'super_admin_role_console',
      metadata: {
        targetUserId,
        email: user.email,
        verificationShell: provision,
      },
    });

    return saved;
  }

  /**
   * Creates pending supplier/rider verification rows when promoting a user.
   * Does not auto-verify — Super still decides on the Verification console.
   */
  private async ensureVerificationShellForRole(
    user: User,
    previousRole: UserRole,
  ): Promise<Record<string, unknown>> {
    if (user.role === UserRole.SUPPLIER) {
      return this.ensurePendingSupplierShell(user);
    }
    if (user.role === UserRole.RIDER) {
      return this.ensurePendingRiderShell(user);
    }
    return {
      action: 'none',
      previousRole,
      role: user.role,
      note: 'No verification shell required for this role',
    };
  }

  private async ensurePendingSupplierShell(
    user: User,
  ): Promise<Record<string, unknown>> {
    let profile = await this.supplierRepo.findOne({
      where: { userId: user.id },
    });
    let createdProfile = false;
    if (!profile) {
      const businessName =
        (user.organization && user.organization.trim()) ||
        (user.fullName && `${user.fullName.trim()} Prints`) ||
        `Supplier ${user.id}`;
      profile = this.supplierRepo.create({
        userId: user.id,
        businessName,
        serviceZones: ['Davao City'],
        isActive: true,
        ratingAverage: 0,
        ratingCount: 0,
      });
      profile = await this.supplierRepo.save(profile);
      createdProfile = true;
    } else if (!profile.isActive) {
      profile.isActive = true;
      profile = await this.supplierRepo.save(profile);
    }

    let verification = await this.supplierVerificationRepo.findOne({
      where: { supplierId: profile.id },
    });
    let createdVerification = false;
    if (!verification) {
      verification = this.supplierVerificationRepo.create({
        supplierId: profile.id,
        status: SupplierVerificationStatus.PENDING,
        payoutDetailsRef: null,
        reviewedBy: null,
        reviewedAt: null,
        notes: 'Auto-created when user role set to supplier — pending Super review',
      });
      verification = await this.supplierVerificationRepo.save(verification);
      createdVerification = true;
    }

    // Matching requires a product family; seed a broad default if none.
    const capabilityCount = await this.supplierCapabilityRepo.count({
      where: { supplierId: profile.id },
    });
    let createdCapability = false;
    if (capabilityCount === 0) {
      await this.supplierCapabilityRepo.save(
        this.supplierCapabilityRepo.create({
          supplierId: profile.id,
          productFamily: 'flyers',
          materials: ['glossy', 'matte'],
          maxCapacity: 50,
          leadTimeDays: 2,
        }),
      );
      createdCapability = true;
    }

    return {
      action: 'supplier_shell',
      supplierProfileId: profile.id,
      createdProfile,
      createdVerification,
      createdCapability,
      verificationStatus: verification.status,
    };
  }

  private async ensurePendingRiderShell(
    user: User,
  ): Promise<Record<string, unknown>> {
    let profile = await this.riderRepo.findOne({ where: { userId: user.id } });
    let createdProfile = false;
    if (!profile) {
      profile = this.riderRepo.create({
        userId: user.id,
        vehicleType: 'motorcycle',
        plateNumber: '',
        licenseNumber: '',
        isAvailable: false,
        verificationStatus: RiderVerificationStatus.PENDING,
        verificationNotes:
          'Auto-created when user role set to rider — pending Super review',
        verificationReviewedBy: null,
        verificationReviewedAt: null,
      });
      profile = await this.riderRepo.save(profile);
      createdProfile = true;
    } else if (
      profile.verificationStatus !== RiderVerificationStatus.VERIFIED &&
      profile.verificationStatus !== RiderVerificationStatus.REJECTED
    ) {
      // Keep existing verified/rejected; otherwise ensure visible as pending/under_review
      if (!profile.verificationStatus) {
        profile.verificationStatus = RiderVerificationStatus.PENDING;
        profile = await this.riderRepo.save(profile);
      }
    }

    return {
      action: 'rider_shell',
      riderProfileId: profile.id,
      createdProfile,
      verificationStatus: profile.verificationStatus,
    };
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
