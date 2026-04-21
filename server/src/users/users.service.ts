import { Injectable, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findById(id: number): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
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
    await this.usersRepo.update(userId, { fcmToken: token });
  }

  async getFcmToken(userId: number): Promise<string | null> {
    const user = await this.findById(userId);
    return user?.fcmToken ?? null;
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
    if (![null, 1, 7, 30].includes(fileRetentionDays)) {
      throw new BadRequestException('fileRetentionDays must be null, 1, 7, or 30');
    }
    await this.usersRepo.findOneOrFail({ where: { id: userId } });
    await this.usersRepo.update(userId, { fileRetentionDays });
    return { fileRetentionDays };
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
