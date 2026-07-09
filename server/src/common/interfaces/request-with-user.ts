import { Request } from 'express';

export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
  betaTestimonialPending?: boolean;
}

export interface RequestWithUser extends Request {
  user: JwtPayload;
}
