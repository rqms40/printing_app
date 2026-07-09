import {
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtPayload } from '../../common/interfaces/request-with-user';

export const ALLOW_BETA_HELD_KEY = 'allowBetaHeld';
export const AllowBetaHeld = () => SetMetadata(ALLOW_BETA_HELD_KEY, true);

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUser = JwtPayload>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const authenticated: unknown = super.handleRequest(
      err,
      user,
      info,
      context,
      status,
    );
    const payload = authenticated as JwtPayload;
    const allowBetaHeld = this.reflector.getAllAndOverride<boolean>(
      ALLOW_BETA_HELD_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (payload.betaTestimonialPending && !allowBetaHeld) {
      throw new UnauthorizedException('Account is inactive');
    }
    return authenticated as TUser;
  }
}
