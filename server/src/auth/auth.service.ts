import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BetaModeService } from '../beta-mode/beta-mode.service';
import { User, UserRole } from '../users/entities/user.entity';
import * as bcrypt from 'bcrypt';
import {
  AgeRange,
  ClientAccountType,
  PrintingPreference,
  ProfileCategory,
  ProfileField,
} from '../users/profile.constants';

type RegisterProfileInput = {
  fullName: string;
  nickname?: string;
  phoneNumber?: string;
  gender?: string;
  ageRange?: AgeRange;
  dateOfBirth?: string;
  profileCategory: ProfileCategory;
  profileField: ProfileField;
  course?: string;
  organization?: string;
  clientAccountType?: ClientAccountType;
  printingPreferences?: PrintingPreference[];
};

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private notificationsService: NotificationsService,
    private betaModeService: BetaModeService,
  ) {}

  async register(
    email: string,
    password: string,
    profile: RegisterProfileInput,
  ) {
    let user = await this.usersService.create(email, password, profile);
    user = await this.ensureBetaEnrollment(user);

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

    if (user.isActive === false) {
      if (
        user.role === UserRole.CLIENT &&
        user.isBetaUser &&
        !user.isBetaSurveyExempt &&
        user.accountHoldReason === 'beta_survey_complete'
      ) {
        const betaSettings = await this.betaModeService.getSettings();
        if (!betaSettings.isEnabled) {
          await this.betaModeService.reopenCompletedBetaSurveyHolds(user.id);
          const reopenedUser = {
            ...user,
            isActive: true,
            accountHoldReason: null,
            accountHeldAt: null,
          } as User;
          const { passwordHash: _ph, ...result } = reopenedUser;
          return {
            user: result,
            access_token: this.generateToken(reopenedUser),
          };
        }
        throw new ForbiddenException({
          code: 'beta_held',
          message:
            'Beta testing completed. Your account will reopen at full release.',
          user: {
            fullName: user.fullName,
            email: user.email,
          },
          betaPhotoUploaded: user.betaPhotoUploadedAt != null,
          betaSharedOnSocial: user.betaSharedOnSocial,
          betaCompletedAt: user.betaCompletedAt?.toISOString() ?? null,
          access_token: this.generateToken(user),
        });
      }
      throw new UnauthorizedException('Account is inactive');
    }

    const enrolledUser = await this.ensureBetaEnrollment(user);
    const { passwordHash: _ph2, ...result } = enrolledUser;
    return {
      user: result,
      access_token: this.generateToken(enrolledUser),
    };
  }

  private async ensureBetaEnrollment(user: User): Promise<User> {
    const betaSettings = await this.betaModeService.getSettings();
    if (!betaSettings.isEnabled || user.role !== UserRole.CLIENT) return user;

    await this.betaModeService.enrollUser(user.id);
    return (await this.usersService.findById(user.id)) ?? user;
  }

  private generateToken(user: User): string {
    return this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
}
