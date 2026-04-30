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

  it('returns token payload for active users', async () => {
    usersService.findById.mockResolvedValue({ id: 1, isActive: true });

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'customer' }),
    ).resolves.toEqual({ sub: 1, email: 'a@test.com', role: 'customer' });
  });

  it('rejects inactive users with existing tokens', async () => {
    usersService.findById.mockResolvedValue({ id: 1, isActive: false });

    await expect(
      strategy.validate({ sub: 1, email: 'a@test.com', role: 'customer' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
