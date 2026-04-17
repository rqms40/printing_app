import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from '../notifications/notifications.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;
  let notificationsService: Partial<NotificationsService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    role: 'customer',
  };

  beforeEach(async () => {
    notificationsService = {
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findByEmail: jest.fn(),
      create: jest.fn(),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
        { provide: NotificationsService, useValue: notificationsService },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('register', () => {
    it('should create user and return JWT token', async () => {
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      const result = await authService.register(
        'test@example.com',
        'password123',
      );

      expect(usersService.create).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
      );
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', 'test@example.com');
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
      });
    });

    it('should throw ConflictException if email already exists', async () => {
      (usersService.create as jest.Mock).mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      await expect(
        authService.register('test@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });

    it('fires createForAllAdmins with new_user type after registering', async () => {
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      await authService.register('test@example.com', 'password123');

      expect(notificationsService.createForAllAdmins).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'new_user',
          metadata: expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
          }),
        }),
      );
    });
  });

  describe('login', () => {
    it('should return JWT for valid credentials', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(userWithHash);

      const result = await authService.login('test@example.com', 'password123');

      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).toHaveProperty('email', 'test@example.com');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const userWithHash = { ...mockUser, passwordHash: hashedPassword };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(userWithHash);

      await expect(
        authService.login('test@example.com', 'wrong-password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for nonexistent email', async () => {
      (usersService.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(
        authService.login('nobody@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
