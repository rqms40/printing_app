import {
  Injectable,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';
import {
  AgeRange,
  isProfileComplete,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from './profile.constants';

type UserProfilingInput = {
  fullName?: string;
  nickname?: string;
  phoneNumber?: string;
  gender?: string;
  ageRange?: AgeRange;
  dateOfBirth?: string;
  profileCategory?: ProfileCategory;
  profileField?: ProfileField;
  course?: string;
  organization?: string;
  printingPreferences?: PrintingPreference[];
};

export type SocketIdentity = Pick<User, 'id' | 'role' | 'isActive'>;

@Injectable()
export class UsersService {
  private static readonly MAX_FCM_TOKEN_BYTES = 2048;
  private static readonly VALID_PAYMENT_METHODS = [
    'gcash',
    'maya',
    'cod',
    'credits',
  ] as const;

  constructor(
    @InjectRepository(User) private usersRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findSocketIdentity(id: unknown): Promise<SocketIdentity | null> {
    if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
      return null;
    }
    return this.usersRepo.findOne({
      where: { id },
      select: { id: true, role: true, isActive: true },
    });
  }

  async create(
    email: string,
    password: string,
    profile: UserProfilingInput = {},
    role = 'customer',
  ): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const normalizedProfile = this.normalizeProfilingData(profile);
    const user = this.usersRepo.create({
      email,
      passwordHash: hashed,
      role: role as UserRole,
      ...normalizedProfile,
      isProfileComplete: isProfileComplete(normalizedProfile),
    });
    return this.usersRepo.save(user);
  }

  async updateFcmToken(userId: number, token: string): Promise<void> {
    const normalizedToken = this.normalizeFcmToken(token);
    await this.dataSource.transaction(async (manager) => {
      // A Firebase registration token identifies a device/app installation,
      // not an account. Serialize the complete ownership-transfer operation:
      // token-scoped locks can deadlock when two devices swap accounts/tokens.
      // Registration is infrequent, so one short global lock is the safest
      // deterministic trade-off.
      await manager.query(
        'SELECT pg_advisory_xact_lock($1::bigint)',
        [1777854200000],
      );
      const usersRepo = manager.getRepository(User);
      await usersRepo.update({ fcmToken: normalizedToken }, { fcmToken: null });
      await usersRepo.update(userId, { fcmToken: normalizedToken });
    });
  }

  async clearFcmToken(userId: number, token: string): Promise<void> {
    const normalizedToken = this.normalizeFcmToken(token);
    await this.usersRepo.update(
      { id: userId, fcmToken: normalizedToken },
      { fcmToken: null },
    );
  }

  async getFcmToken(userId: number): Promise<string | null> {
    const user = await this.findById(userId);
    return user?.fcmToken ?? null;
  }

  private normalizeFcmToken(token: string): string {
    const normalized = token?.trim();
    if (
      !normalized ||
      Buffer.byteLength(normalized, 'utf8') > UsersService.MAX_FCM_TOKEN_BYTES
    ) {
      throw new BadRequestException('invalid FCM token');
    }
    return normalized;
  }

  async updateProfile(id: number, data: Partial<User>): Promise<User> {
    const existing = await this.usersRepo.findOne({ where: { id } });
    const normalizedData = this.normalizeProfilingData(data);
    const merged = {
      ...existing,
      ...normalizedData,
    };
    const updateData: Partial<User> = {
      ...data,
      ...normalizedData,
      isProfileComplete: isProfileComplete(merged),
    };

    await this.usersRepo.update(id, updateData);
    return this.usersRepo.findOneOrFail({ where: { id } });
  }

  async findAllByRole(role: string): Promise<User[]> {
    return this.usersRepo.find({ where: { role: role as UserRole } });
  }

  async findAll(): Promise<User[]> {
    return this.usersRepo.find();
  }

  async getStorageSettings(
    userId: number,
  ): Promise<{ fileRetentionDays: number | null }> {
    const user = await this.usersRepo.findOneOrFail({ where: { id: userId } });
    return { fileRetentionDays: user.fileRetentionDays };
  }

  async updateStorageSettings(
    userId: number,
    fileRetentionDays: number | null,
  ): Promise<{ fileRetentionDays: number | null }> {
    await this.usersRepo.update(userId, { fileRetentionDays });
    return { fileRetentionDays };
  }

  async setDefaultPaymentMethod(
    userId: number,
    method: 'gcash' | 'maya' | 'cod' | 'credits',
  ): Promise<void> {
    if (!UsersService.VALID_PAYMENT_METHODS.includes(method)) {
      throw new BadRequestException('invalid payment method');
    }
    await this.usersRepo.update(userId, { defaultPaymentMethod: method });
  }

  async updateTutorialSeenKeys(userId: number, keys: string[]): Promise<void> {
    await this.usersRepo.update(userId, { tutorialSeenKeys: keys });
  }

  private normalizeProfilingData(data: Partial<UserProfilingInput | User>) {
    const normalized: Partial<User> = {};

    if (data.fullName !== undefined) {
      normalized.fullName = data.fullName?.trim() || null;
    }

    if (data.nickname !== undefined) {
      normalized.nickname = data.nickname?.trim() || null;
    }

    if (data.phoneNumber !== undefined) {
      normalized.phoneNumber = data.phoneNumber?.trim() || null;
    }

    if (data.gender !== undefined) {
      normalized.gender = data.gender?.trim() || null;
    }

    if (data.ageRange !== undefined) {
      normalized.ageRange = data.ageRange ?? null;
    }

    if (data.dateOfBirth !== undefined) {
      normalized.dateOfBirth = data.dateOfBirth
        ? new Date(data.dateOfBirth)
        : null;
    }

    if (data.profileCategory !== undefined) {
      normalized.profileCategory = data.profileCategory ?? null;
    }

    if (data.profileField !== undefined) {
      normalized.profileField = data.profileField ?? null;
    }

    if (data.course !== undefined) {
      normalized.course = data.course?.trim() || null;
    }

    if (data.organization !== undefined) {
      normalized.organization = data.organization?.trim() || null;
    }

    if (data.printingPreferences !== undefined) {
      normalized.printingPreferences = Array.from(
        new Set(data.printingPreferences),
      );
    }

    return normalized;
  }
}
