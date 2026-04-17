import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import {
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../users/profile.constants';

type RegisterProfileInput = {
  fullName: string;
  profileCategory: ProfileCategory;
  profileField: ProfileField;
  course?: string;
  organization?: string;
  printingPreferences?: PrintingPreference[];
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
  ) {}

  async register(
    email: string,
    password: string,
    profile: RegisterProfileInput,
  ) {
    const user = await this.usersService.create(email, password, profile);

    try {
      await this.notificationsService.createForAllAdmins({
        title: 'New User Registered',
        message: `${email} just signed up.`,
        type: 'new_user',
        metadata: { userId: user.id, email: user.email },
      });
    } catch {
      // notification failure must not break registration
    }

    const { passwordHash: _ph1, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) throw new UnauthorizedException('Invalid credentials');

    const { passwordHash: _ph2, ...result } = user;
    return {
      user: result,
      access_token: this.generateToken(user),
    };
  }

  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
