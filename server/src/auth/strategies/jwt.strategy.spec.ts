import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { UsersService } from '../../users/users.service';
import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy account status enforcement', () => {
  let strategy: JwtStrategy;
  const usersService = { findById: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: UsersService, useValue: usersService },
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  it('returns DB-backed identity for active users', async () => {
    usersService.findById.mockResolvedValue({
      id: 1,
      email: 'current@test.com',
      role: 'ops_admin',
      isActive: true,
    });

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'client' }),
    ).resolves.toEqual({
      sub: 1,
      email: 'current@test.com',
      role: 'ops_admin',
    });
  });

  it('rejects inactive users with existing tokens', async () => {
    usersService.findById.mockResolvedValue({ id: 1, isActive: false });

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'client' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('marks beta-held users for endpoint-level restriction', async () => {
    usersService.findById.mockResolvedValue({
      id: 1,
      email: 'held@test.com',
      role: 'client',
      isActive: false,
      isBetaUser: true,
      isBetaSurveyExempt: false,
      accountHoldReason: 'beta_survey_complete',
    });

    await expect(
      strategy.validate({ sub: 1, email: 'held@test.com', role: 'client' }),
    ).resolves.toEqual({
      sub: 1,
      email: 'held@test.com',
      role: 'client',
      betaTestimonialPending: true,
    });
  });

  it.each([
    { role: 'rider', isBetaUser: true, isBetaSurveyExempt: false },
    { role: 'ops_admin', isBetaUser: true, isBetaSurveyExempt: false },
    { role: 'client', isBetaUser: false, isBetaSurveyExempt: false },
    { role: 'client', isBetaUser: true, isBetaSurveyExempt: true },
  ])('rejects an invalid held identity %#', async (identity) => {
    usersService.findById.mockResolvedValue({
      id: 1,
      email: 'invalid-held@test.com',
      isActive: false,
      accountHoldReason: 'beta_survey_complete',
      ...identity,
    });

    await expect(
      strategy.validate({ sub: 1, email: 'held@test.com', role: 'client' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects tokens for missing users', async () => {
    usersService.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'client' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
