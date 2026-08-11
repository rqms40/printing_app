import { Request } from 'express';
import { UserRole } from '../../users/entities/user.entity';

export interface JwtPayload {
  sub: number;
  email: string;
  role: UserRole;
  betaTestimonialPending?: boolean;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
