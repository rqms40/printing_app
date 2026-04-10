import { Injectable, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

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
    role = 'customer',
  ): Promise<User> {
    const existing = await this.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(password, 10);
    const user = this.usersRepo.create({
      email,
      passwordHash: hashed,
      role: role as UserRole,
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
    await this.usersRepo.update(id, data);
    return this.usersRepo.findOneOrFail({ where: { id } });
  }

  async findAllByRole(role: string): Promise<User[]> {
    return this.usersRepo.find({ where: { role: role as any } });
  }
}
