import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
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
import { UpdateSupplierProfileDto } from './dto/update-supplier-profile.dto';
import { SetSupplierVerificationDto } from './dto/set-supplier-verification.dto';
import { CreateSupplierCapabilityDto } from './dto/create-supplier-capability.dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierProfile)
    private readonly profileRepo: Repository<SupplierProfile>,
    @InjectRepository(SupplierCapability)
    private readonly capabilityRepo: Repository<SupplierCapability>,
    @InjectRepository(SupplierVerification)
    private readonly verificationRepo: Repository<SupplierVerification>,
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

    const profile = this.profileRepo.create({
      userId: dto.userId,
      businessName: dto.businessName,
      serviceZones: dto.serviceZones ?? [],
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

  async findAll(): Promise<SupplierProfile[]> {
    return this.profileRepo.find({
      relations: { verification: true, capabilities: true },
      order: { id: 'ASC' },
    });
  }

  async findById(id: number): Promise<SupplierProfile> {
    const profile = await this.profileRepo.findOne({
      where: { id },
      relations: { verification: true, capabilities: true },
    });
    if (!profile) {
      throw new NotFoundException(`Supplier profile ${id} not found`);
    }
    return profile;
  }

  async findByUserId(userId: number): Promise<SupplierProfile> {
    const profile = await this.profileRepo.findOne({
      where: { userId },
      relations: { verification: true, capabilities: true },
    });
    if (!profile) {
      throw new NotFoundException(
        `Supplier profile for user ${userId} not found`,
      );
    }
    return profile;
  }

  async updateProfile(
    id: number,
    dto: UpdateSupplierProfileDto,
  ): Promise<SupplierProfile> {
    const profile = await this.findById(id);
    if (dto.businessName !== undefined) profile.businessName = dto.businessName;
    if (dto.serviceZones !== undefined) profile.serviceZones = dto.serviceZones;
    if (dto.isActive !== undefined) profile.isActive = dto.isActive;
    await this.profileRepo.save(profile);
    return this.findById(id);
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
