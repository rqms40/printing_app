import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ALLOW_BETA_HELD_KEY, JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard beta-held access', () => {
  const makeContext = (allowBetaHeld = false) => {
    const handler = () => undefined;
    if (allowBetaHeld) {
      Reflect.defineMetadata(ALLOW_BETA_HELD_KEY, true, handler);
    }
    return {
      getHandler: () => handler,
      getClass: () => class TestController {},
    } as unknown as ExecutionContext;
  };

  it('rejects beta-held identities on ordinary authenticated endpoints', () => {
    const guard = new JwtAuthGuard(new Reflector());

    expect(() =>
      guard.handleRequest(
        null,
        {
          sub: 1,
          email: 'held@test.com',
          role: 'customer',
          betaTestimonialPending: true,
        },
        null,
        makeContext(),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('allows an explicitly scoped beta-held endpoint', () => {
    const guard = new JwtAuthGuard(new Reflector());
    const user = {
      sub: 1,
      email: 'held@test.com',
      role: 'customer',
      betaTestimonialPending: true,
    };

    expect(guard.handleRequest(null, user, null, makeContext(true))).toEqual(
      user,
    );
  });
});
