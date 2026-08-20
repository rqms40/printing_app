import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { SupplierCapability } from './entities/supplier-capability.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from './entities/supplier-verification.entity';
import { CreateSupplierProfileDto } from './dto/create-supplier-profile.dto';
import {
  SUPPLIER_SERVICE_FOCUS_KEYS,
  UpdateSupplierProfileDto,
} from './dto/update-supplier-profile.dto';
import { SetSupplierVerificationDto } from './dto/set-supplier-verification.dto';
import { CreateSupplierCapabilityDto } from './dto/create-supplier-capability.dto';
import {
  FileMetadata,
  FilePurpose,
} from '../files/entities/file-metadata.entity';
import { FilesService } from '../files/files.service';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../matching/entities/supplier-assignment.entity';

export type SupplierProfileView = SupplierProfile & {
  logoUrl?: string | null;
};

/** Human labels for onboarding service-focus catalog keys. */
export const SUPPLIER_SERVICE_FOCUS_LABELS: Record<string, string> = {
  signages: 'Signages',
  tarpaulins: 'Tarpaulins',
  document_printing: 'Document Printing',
  apparel: 'Apparel / Shirt Printing',
  stickers_labels: 'Stickers & Labels',
  large_format: 'Large Format',
  '3d_printing': '3D Printing',
  invitations_cards: 'Invitations & Cards',
};

export type RankedServiceFocus = {
  rank: number;
  key: string;
  label: string;
};

export type SupplierDirectoryEntry = {
  id: number;
  userId: number;
  businessName: string;
  description: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  logoUrl: string | null;
  serviceZones: string[];
  serviceFocusRanks: string[];
  rankedServices: RankedServiceFocus[];
  isActive: boolean;
  verificationStatus: string | null;
  ratingAverage: number;
  ratingCount: number;
  ordersReceived: number;
  ordersAccepted: number;
  capabilities: Array<{
    id: number;
    productFamily: string;
    materials: string[];
    maxCapacity: number;
    leadTimeDays: number;
  }>;
  updatedAt: Date;
};

export type SupplierLeaderboardEntry = {
  rank: number;
  supplierId: number;
  userId: number;
  businessName: string;
  logoUrl: string | null;
  verificationStatus: string | null;
  ratingAverage: number;
  ratingCount: number;
  ordersReceived: number;
  ordersAccepted: number;
  topService: RankedServiceFocus | null;
};

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierProfile)
    private readonly profileRepo: Repository<SupplierProfile>,
    @InjectRepository(SupplierCapability)
    private readonly capabilityRepo: Repository<SupplierCapability>,
    @InjectRepository(SupplierVerification)
    private readonly verificationRepo: Repository<SupplierVerification>,
    @InjectRepository(FileMetadata)
    private readonly fileRepo: Repository<FileMetadata>,
    @InjectRepository(SupplierAssignment)
    private readonly assignmentRepo: Repository<SupplierAssignment>,
    @Optional() private readonly filesService?: FilesService,
  ) {}

  async createProfile(dto: CreateSupplierProfileDto): Promise<SupplierProfile> {
    const existing = await this.profileRepo.findOne({
      where: { userId: dto.userId },
    });
    if (existing) {
      throw new ConflictException(
        `Supplier profile already exists for user ${dto.userId}`,
      );
    }

    let serviceFocusRanks: string[] = [];
    if (
      Array.isArray(dto.serviceFocusRanks) &&
      dto.serviceFocusRanks.length > 0
    ) {
      serviceFocusRanks = this.sanitizeServiceFocusRanks(dto.serviceFocusRanks);
    }

    const profile = this.profileRepo.create({
      userId: dto.userId,
      businessName: dto.businessName,
      serviceZones: dto.serviceZones ?? [],
      serviceFocusRanks,
      isActive: dto.isActive ?? true,
      ratingAverage: 0,
      ratingCount: 0,
    });
    const saved = await this.profileRepo.save(profile);

    const verification = this.verificationRepo.create({
      supplierId: saved.id,
      status: SupplierVerificationStatus.PENDING,
      payoutDetailsRef: null,
      reviewedBy: null,
      reviewedAt: null,
      notes: null,
    });
    await this.verificationRepo.save(verification);

    return this.findById(saved.id);
  }

  async findAll(): Promise<SupplierProfileView[]> {
    const rows = await this.profileRepo.find({
      relations: { verification: true, capabilities: true },
      order: { id: 'ASC' },
    });
    return Promise.all(rows.map((row) => this.withLogoUrl(row)));
  }

  /**
   * Ops directory: every supplier profile with ranked service focus + order stats.
   */
  async listDirectory(): Promise<SupplierDirectoryEntry[]> {
    const rows = await this.findAll();
    const stats = await this.loadAssignmentStats(rows.map((r) => r.id));
    return rows.map((profile) =>
      this.toDirectoryEntry(profile, stats.get(profile.id)),
    );
  }

  /**
   * Leaderboard by reviews (rating count, then average) or orders received.
   */
  async leaderboard(
    metric: 'reviews' | 'orders' = 'reviews',
    limit = 20,
  ): Promise<SupplierLeaderboardEntry[]> {
    const directory = await this.listDirectory();
    const sorted = [...directory].sort((a, b) => {
      if (metric === 'orders') {
        if (b.ordersReceived !== a.ordersReceived) {
          return b.ordersReceived - a.ordersReceived;
        }
        if (b.ordersAccepted !== a.ordersAccepted) {
          return b.ordersAccepted - a.ordersAccepted;
        }
        return b.ratingCount - a.ratingCount;
      }
      // reviews: most ratings, then highest average, then orders as tie-break
      if (b.ratingCount !== a.ratingCount) {
        return b.ratingCount - a.ratingCount;
      }
      if (Number(b.ratingAverage) !== Number(a.ratingAverage)) {
        return Number(b.ratingAverage) - Number(a.ratingAverage);
      }
      return b.ordersReceived - a.ordersReceived;
    });

    const take = Math.min(100, Math.max(1, limit));
    return sorted.slice(0, take).map((entry, index) => ({
      rank: index + 1,
      supplierId: entry.id,
      userId: entry.userId,
      businessName: entry.businessName,
      logoUrl: entry.logoUrl,
      verificationStatus: entry.verificationStatus,
      ratingAverage: entry.ratingAverage,
      ratingCount: entry.ratingCount,
      ordersReceived: entry.ordersReceived,
      ordersAccepted: entry.ordersAccepted,
      topService: entry.rankedServices[0] ?? null,
    }));
  }

  /** Ranked service-focus list (1-based) from onboarding ranks. */
  rankedServicesFromKeys(
    ranks: string[] | null | undefined,
  ): RankedServiceFocus[] {
    const keys = Array.isArray(ranks) ? ranks : [];
    const seen = new Set<string>();
    const out: RankedServiceFocus[] = [];
    for (const raw of keys) {
      const key = String(raw ?? '').trim();
      if (!key || seen.has(key)) continue;
      if (
        !(SUPPLIER_SERVICE_FOCUS_KEYS as readonly string[]).includes(key) &&
        !SUPPLIER_SERVICE_FOCUS_LABELS[key]
      ) {
        // Still show unknown keys so ops can debug bad data.
      }
      seen.add(key);
      out.push({
        rank: out.length + 1,
        key,
        label: SUPPLIER_SERVICE_FOCUS_LABELS[key] ?? key.replace(/_/g, ' '),
      });
    }
    return out;
  }

  private async loadAssignmentStats(
    supplierIds: number[],
  ): Promise<Map<number, { ordersReceived: number; ordersAccepted: number }>> {
    const map = new Map<
      number,
      { ordersReceived: number; ordersAccepted: number }
    >();
    for (const id of supplierIds) {
      map.set(id, { ordersReceived: 0, ordersAccepted: 0 });
    }
    if (supplierIds.length === 0) return map;

    const rows = await this.assignmentRepo
      .createQueryBuilder('a')
      .select('a.supplier_id', 'supplierId')
      .addSelect('COUNT(*)', 'ordersReceived')
      .addSelect(
        `SUM(CASE WHEN a.decision = :accepted THEN 1 ELSE 0 END)`,
        'ordersAccepted',
      )
      .where('a.supplier_id IN (:...ids)', { ids: supplierIds })
      .setParameter('accepted', SupplierAssignmentDecision.ACCEPTED)
      .groupBy('a.supplier_id')
      .getRawMany<{
        supplierId: string;
        ordersReceived: string;
        ordersAccepted: string;
      }>();

    for (const row of rows) {
      const id = Number(row.supplierId);
      map.set(id, {
        ordersReceived: Number(row.ordersReceived) || 0,
        ordersAccepted: Number(row.ordersAccepted) || 0,
      });
    }
    return map;
  }

  private toDirectoryEntry(
    profile: SupplierProfileView,
    stats?: { ordersReceived: number; ordersAccepted: number },
  ): SupplierDirectoryEntry {
    const ranks = Array.isArray(profile.serviceFocusRanks)
      ? profile.serviceFocusRanks
      : [];
    return {
      id: profile.id,
      userId: profile.userId,
      businessName: profile.businessName,
      description: profile.description ?? null,
      contactPhone: profile.contactPhone ?? null,
      contactEmail: profile.contactEmail ?? null,
      address: profile.address ?? null,
      latitude: profile.latitude != null ? Number(profile.latitude) : null,
      longitude: profile.longitude != null ? Number(profile.longitude) : null,
      logoUrl: profile.logoUrl ?? null,
      serviceZones: profile.serviceZones ?? [],
      serviceFocusRanks: ranks,
      rankedServices: this.rankedServicesFromKeys(ranks),
      isActive: profile.isActive,
      verificationStatus: profile.verification?.status ?? null,
      ratingAverage: Number(profile.ratingAverage ?? 0),
      ratingCount: Number(profile.ratingCount ?? 0),
      ordersReceived: stats?.ordersReceived ?? 0,
      ordersAccepted: stats?.ordersAccepted ?? 0,
      capabilities: (profile.capabilities ?? []).map((cap) => ({
        id: cap.id,
        productFamily: cap.productFamily,
        materials: cap.materials ?? [],
        maxCapacity: cap.maxCapacity,
        leadTimeDays: cap.leadTimeDays,
      })),
      updatedAt: profile.updatedAt,
    };
  }

  async findById(id: number): Promise<SupplierProfileView> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: { verification: true, capabilities: true },
    });
    if (!profile) {
      throw new NotFoundException(`Supplier profile ${id} not found`);
    }
    return this.withLogoUrl(profile);
  }

  async findByUserId(userId: number): Promise<SupplierProfileView> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: { verification: true, capabilities: true },
    });
    if (!profile) {
      throw new NotFoundException(
        `Supplier profile for user ${userId} not found`,
      );
    }
    return this.withLogoUrl(profile);
  }

  /** Soft lookup for admin user detail (null when no supplier shell yet). */
  async findByUserIdOrNull(
    userId: number,
  ): Promise<SupplierProfileView | null> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: { verification: true, capabilities: true },
    });
    if (!profile) return null;
    return this.withLogoUrl(profile);
  }

  /** Admin-facing snapshot of supplier self-edited shop details. */
  toAdminSupplierSnapshot(profile: SupplierProfileView) {
    const ranks = Array.isArray(profile.serviceFocusRanks)
      ? profile.serviceFocusRanks
      : [];
    return {
      id: profile.id,
      user_id: profile.userId,
      business_name: profile.businessName,
      description: profile.description ?? null,
      contact_phone: profile.contactPhone ?? null,
      contact_email: profile.contactEmail ?? null,
      address: profile.address ?? null,
      latitude: profile.latitude != null ? Number(profile.latitude) : null,
      longitude: profile.longitude != null ? Number(profile.longitude) : null,
      logo_file_id: profile.logoFileId ?? null,
      logo_url: profile.logoUrl ?? null,
      attributes: profile.attributes ?? {},
      service_zones: profile.serviceZones ?? [],
      service_focus_ranks: ranks,
      ranked_services: this.rankedServicesFromKeys(ranks),
      is_active: profile.isActive,
      verification_status: profile.verification?.status ?? null,
      rating_average: Number(profile.ratingAverage ?? 0),
      rating_count: Number(profile.ratingCount ?? 0),
      capabilities: (profile.capabilities ?? []).map((cap) => ({
        id: cap.id,
        product_family: cap.productFamily,
        materials: cap.materials ?? [],
        max_capacity: cap.maxCapacity,
        lead_time_days: cap.leadTimeDays,
      })),
      updated_at: profile.updatedAt,
    };
  }

  /**
   * Access status for supplier UI (always allowed to call so clients can
   * show a pending/rejected wall without using job APIs).
   */
  async getAccessStatus(userId: number): Promise<{
    hasProfile: boolean;
    isActive: boolean;
    verificationStatus: SupplierVerificationStatus | 'missing';
    canAccessSupplierInterface: boolean;
    message: string;
    profileId: number | null;
    needsServiceFocusSetup: boolean;
    serviceFocusRanks: string[];
  }> {
    try {
      const profile = await this.findByUserId(userId);
      const status =
        profile.verification?.status ?? SupplierVerificationStatus.PENDING;
      const canAccess =
        profile.isActive && status === SupplierVerificationStatus.VERIFIED;
      const ranks = Array.isArray(profile.serviceFocusRanks)
        ? profile.serviceFocusRanks
        : [];
      return {
        hasProfile: true,
        isActive: profile.isActive,
        verificationStatus: status,
        canAccessSupplierInterface: canAccess,
        profileId: profile.id,
        needsServiceFocusSetup: ranks.length === 0,
        serviceFocusRanks: ranks,
        message: canAccess
          ? 'Supplier interface available'
          : status === SupplierVerificationStatus.REJECTED
            ? 'Your supplier account was rejected. Contact Super Admin.'
            : `Your supplier account is ${String(status).replace(/_/g, ' ')}. You cannot access jobs until Super Admin verifies you.`,
      };
    } catch (e) {
      if (e instanceof NotFoundException) {
        return {
          hasProfile: false,
          isActive: false,
          verificationStatus: 'missing',
          canAccessSupplierInterface: false,
          profileId: null,
          needsServiceFocusSetup: false,
          serviceFocusRanks: [],
          message:
            'No supplier profile yet. Super Admin must promote your role and complete onboarding.',
        };
      }
      throw e;
    }
  }

  /** Blocks operational supplier APIs unless verified + active. */
  async assertVerifiedOperationalAccess(
    userId: number,
  ): Promise<SupplierProfile> {
    const profile = await this.findByUserId(userId);
    if (!profile.isActive) {
      throw new ForbiddenException({
        code: 'supplier_inactive',
        message: 'Supplier profile is inactive. Contact support.',
      });
    }
    const status =
      profile.verification?.status ?? SupplierVerificationStatus.PENDING;
    if (status !== SupplierVerificationStatus.VERIFIED) {
      throw new ForbiddenException({
        code: 'supplier_not_verified',
        message:
          status === SupplierVerificationStatus.REJECTED
            ? 'Your supplier account was rejected. Contact Super Admin.'
            : `Your supplier account is ${String(status).replace(/_/g, ' ')}. You cannot access the supplier interface until Super Admin verifies your profile.`,
        verificationStatus: status,
      });
    }
    return profile;
  }

  async updateProfile(
    id: number,
    dto: UpdateSupplierProfileDto,
    options?: { allowIsActive?: boolean; actorUserId?: number },
  ): Promise<SupplierProfileView> {
    const profile = await this.findById(id);
    if (dto.businessName !== undefined) profile.businessName = dto.businessName;
    if (dto.description !== undefined) profile.description = dto.description;
    if (dto.contactPhone !== undefined) profile.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) profile.contactEmail = dto.contactEmail;
    if (dto.address !== undefined) profile.address = dto.address;
    if (dto.latitude !== undefined || dto.longitude !== undefined) {
      const nextLat =
        dto.latitude === undefined ? profile.latitude : dto.latitude;
      const nextLng =
        dto.longitude === undefined ? profile.longitude : dto.longitude;
      if (nextLat == null && nextLng == null) {
        profile.latitude = null;
        profile.longitude = null;
      } else {
        const lat = Number(nextLat);
        const lng = Number(nextLng);
        if (
          !Number.isFinite(lat) ||
          !Number.isFinite(lng) ||
          lat < -90 ||
          lat > 90 ||
          lng < -180 ||
          lng > 180 ||
          (lat === 0 && lng === 0)
        ) {
          throw new BadRequestException({
            code: 'invalid_supplier_location',
            message: 'Supplier shop pin must be a valid latitude/longitude pair',
          });
        }
        profile.latitude = lat;
        profile.longitude = lng;
      }
    }
    if (dto.serviceZones !== undefined) profile.serviceZones = dto.serviceZones;
    if (dto.serviceFocusRanks !== undefined) {
      profile.serviceFocusRanks = this.sanitizeServiceFocusRanks(
        dto.serviceFocusRanks,
      );
    }
    if (dto.attributes !== undefined) {
      profile.attributes = this.sanitizeAttributes(dto.attributes);
    }
    if (dto.logoFileId !== undefined) {
      if (dto.logoFileId === null) {
        profile.logoFileId = null;
      } else {
        await this.assertLogoFileOwned(
          dto.logoFileId,
          options?.actorUserId ?? profile.userId,
        );
        profile.logoFileId = dto.logoFileId;
      }
    }
    if (dto.isActive !== undefined) {
      if (!options?.allowIsActive) {
        throw new ForbiddenException(
          'Suppliers cannot change isActive on their own profile',
        );
      }
      profile.isActive = dto.isActive;
    }
    await this.profileRepo.save(profile);
    return this.withLogoUrl(await this.findById(id));
  }

  /** Supplier self-service update (verified account required). */
  async updateOwnProfile(
    userId: number,
    dto: UpdateSupplierProfileDto,
  ): Promise<SupplierProfileView> {
    const profile = await this.assertVerifiedOperationalAccess(userId);
    // Strip isActive if client sends it
    const { isActive: _ignored, ...safe } = dto;
    return this.updateProfile(profile.id, safe, {
      allowIsActive: false,
      actorUserId: userId,
    });
  }

  /**
   * Onboarding / settings: set ordered service focuses without requiring
   * verification (pending suppliers still complete this step).
   */
  async updateOwnServiceFocusRanks(
    userId: number,
    ranks: string[],
  ): Promise<SupplierProfileView> {
    const profile = await this.findByUserId(userId);
    if (!profile.isActive) {
      throw new ForbiddenException({
        code: 'supplier_inactive',
        message: 'Supplier profile is inactive. Contact support.',
      });
    }
    profile.serviceFocusRanks = this.sanitizeServiceFocusRanks(ranks);
    await this.profileRepo.save(profile);
    return this.withLogoUrl(await this.findById(profile.id));
  }

  async addOwnCapability(
    userId: number,
    dto: CreateSupplierCapabilityDto,
  ): Promise<SupplierCapability> {
    const profile = await this.assertVerifiedOperationalAccess(userId);
    return this.addCapability(profile.id, dto);
  }

  async removeOwnCapability(
    userId: number,
    capabilityId: number,
  ): Promise<void> {
    const profile = await this.assertVerifiedOperationalAccess(userId);
    const cap = await this.capabilityRepo.findOne({
      where: { id: capabilityId, supplierId: profile.id },
    });
    if (!cap) {
      throw new NotFoundException(`Capability ${capabilityId} not found`);
    }
    await this.capabilityRepo.remove(cap);
  }

  private sanitizeAttributes(
    raw: Record<string, string>,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      const key = String(k).trim().slice(0, 80);
      if (!key) continue;
      out[key] = String(v ?? '')
        .trim()
        .slice(0, 500);
    }
    return out;
  }

  private sanitizeServiceFocusRanks(raw: string[]): string[] {
    const allowed = new Set([
      'signages',
      'tarpaulins',
      'document_printing',
      'apparel',
      'stickers_labels',
      'large_format',
      '3d_printing',
      'invitations_cards',
    ]);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const item of raw ?? []) {
      const key = String(item ?? '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
      if (!key || !allowed.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.push(key);
    }
    if (out.length === 0) {
      throw new BadRequestException({
        code: 'service_focus_required',
        message:
          'Select at least one service focus (e.g. signages, tarpaulins, document_printing, apparel).',
      });
    }
    return out;
  }

  private async assertLogoFileOwned(
    fileId: number,
    userId: number,
  ): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });
    if (!file) {
      throw new BadRequestException({
        code: 'logo_file_not_found',
        message: `File ${fileId} not found`,
      });
    }
    if (file.uploadedBy != null && file.uploadedBy !== userId) {
      throw new ForbiddenException({
        code: 'logo_file_not_owned',
        message: 'Logo file must be uploaded by the supplier account',
      });
    }
    if (
      file.purpose &&
      file.purpose !== FilePurpose.GENERAL &&
      file.purpose !== FilePurpose.PAPER
    ) {
      throw new BadRequestException({
        code: 'logo_file_invalid_purpose',
        message: 'Logo must be a general image upload',
      });
    }
  }

  private async withLogoUrl(
    profile: SupplierProfile,
  ): Promise<SupplierProfileView> {
    if (!profile.logoFileId || !this.filesService) {
      return Object.assign(profile, { logoUrl: null });
    }
    try {
      const file = await this.fileRepo.findOne({
        where: { id: profile.logoFileId },
      });
      if (!file?.objectKey) {
        return Object.assign(profile, { logoUrl: file?.url ?? null });
      }
      const signed = await this.filesService.getPresignedUrlForKey(
        file.objectKey,
        3600,
      );
      return Object.assign(profile, { logoUrl: signed });
    } catch {
      return Object.assign(profile, { logoUrl: null });
    }
  }

  async setVerification(
    supplierId: number,
    dto: SetSupplierVerificationDto,
    reviewedBy: number,
  ): Promise<SupplierVerification> {
    // Ensure supplier exists
    await this.findById(supplierId);

    let verification = await this.verificationRepo.findOne({
      where: { supplierId },
    });
    if (!verification) {
      verification = this.verificationRepo.create({
        supplierId,
        status: SupplierVerificationStatus.PENDING,
      });
    }

    verification.status = dto.status;
    if (dto.payoutDetailsRef !== undefined) {
      verification.payoutDetailsRef = dto.payoutDetailsRef;
    }
    if (dto.notes !== undefined) {
      verification.notes = dto.notes;
    }
    verification.reviewedBy = reviewedBy;
    verification.reviewedAt = new Date();

    if (
      dto.status === SupplierVerificationStatus.VERIFIED &&
      !verification.payoutDetailsRef
    ) {
      // Verified suppliers should have a payout ref before going live;
      // allow empty only when explicitly set to null in the same call is not intended —
      // require a non-empty ref for verified.
      throw new BadRequestException(
        'payoutDetailsRef is required when setting status to verified',
      );
    }

    return this.verificationRepo.save(verification);
  }

  async addCapability(
    supplierId: number,
    dto: CreateSupplierCapabilityDto,
  ): Promise<SupplierCapability> {
    await this.findById(supplierId);
    const capability = this.capabilityRepo.create({
      supplierId,
      productFamily: dto.productFamily,
      materials: dto.materials ?? [],
      maxCapacity: dto.maxCapacity ?? 0,
      leadTimeDays: dto.leadTimeDays ?? 1,
    });
    return this.capabilityRepo.save(capability);
  }

  async listCapabilities(supplierId: number): Promise<SupplierCapability[]> {
    await this.findById(supplierId);
    return this.capabilityRepo.find({
      where: { supplierId },
      order: { id: 'ASC' },
    });
  }
}
