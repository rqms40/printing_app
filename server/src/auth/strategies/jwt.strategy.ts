import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../../common/interfaces/request-with-user';
import { UsersService } from '../../users/users.service';
import { UserRole } from '../../users/entities/user.entity';

/**
 * Users whose survey is complete are marked isActive=false with this hold
 * reason so they land on the beta-locked screen. They are still allowed to
 * hit authenticated endpoints until they log out (e.g. /files/upload to
 * submit their testimonial photo on BetaSuccessWallScreen).
 */
const BETA_TESTIMONIAL_HOLD_REASON = 'beta_survey_complete';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Account not found');
    }
    // Allow users who just completed the beta survey: they are deactivated so
    // they can't place new orders, but they still need their JWT to upload a
    // testimonial photo on BetaSuccessWallScreen before logging out.
    const isBetaTestimonialPending =
      user.isActive === false &&
      user.role === UserRole.CUSTOMER &&
      user.isBetaUser &&
      !user.isBetaSurveyExempt &&
      user.accountHoldReason === BETA_TESTIMONIAL_HOLD_REASON;
    if (user.isActive === false && !isBetaTestimonialPending) {
      throw new UnauthorizedException('Account is inactive');
    }
    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      ...(isBetaTestimonialPending ? { betaTestimonialPending: true } : {}),
    };
  }
}
