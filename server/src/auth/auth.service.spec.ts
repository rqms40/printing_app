import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import {
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { NotificationsService } from '../notifications/notifications.service';
import { BetaModeService } from '../beta-mode/beta-mode.service';

describe('AuthService', () => {
  let authService: AuthService;
  let usersService: Partial<UsersService>;
  let jwtService: Partial<JwtService>;
  let notificationsService: Partial<NotificationsService>;
  let betaModeService: Partial<BetaModeService>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    role: 'customer',
    profileCategory: 'student',
    profileField: 'architecture',
    printingPreferences: ['plotting_blueprints'],
    isProfileComplete: false,
  };

  beforeEach(async () => {
    notificationsService = {
      createForAllAdmins: jest.fn().mockResolvedValue(undefined),
    };
    betaModeService = {
      getSettings: jest.fn().mockResolvedValue({ id: 1, isEnabled: true }),
      enrollUser: jest.fn().mockResolvedValue(undefined),
      reopenCompletedBetaSurveyHolds: jest.fn().mockResolvedValue(undefined),
    };
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
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
        { provide: BetaModeService, useValue: betaModeService },
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
        {
          profileCategory: 'student',
          profileField: 'architecture',
          printingPreferences: ['plotting_blueprints'],
        },
      );

      expect(usersService.create).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        {
          profileCategory: 'student',
          profileField: 'architecture',
          printingPreferences: ['plotting_blueprints'],
        },
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

    it('forwards optional registration fields to user creation', async () => {
      (usersService.create as jest.Mock).mockResolvedValue({
        ...mockUser,
        fullName: 'Maria Santos',
        isProfileComplete: true,
      });

      await authService.register('test@example.com', 'password123', {
        fullName: 'Maria Santos',
        nickname: 'Mia',
        phoneNumber: '+639171234567',
        gender: 'female',
        dateOfBirth: '2001-02-03',
        profileCategory: 'student',
        profileField: 'architecture',
        ageRange: '18_24',
        course: 'BS Architecture',
        organization: 'Mapua University',
        printingPreferences: ['plotting_blueprints'],
      });

      expect(usersService.create).toHaveBeenCalledWith(
        'test@example.com',
        'password123',
        {
          fullName: 'Maria Santos',
          nickname: 'Mia',
          phoneNumber: '+639171234567',
          gender: 'female',
          dateOfBirth: '2001-02-03',
          profileCategory: 'student',
          profileField: 'architecture',
          ageRange: '18_24',
          course: 'BS Architecture',
          organization: 'Mapua University',
          printingPreferences: ['plotting_blueprints'],
        },
      );
    });

    it('should throw ConflictException if email already exists', async () => {
      (usersService.create as jest.Mock).mockRejectedValue(
        new ConflictException('Email already registered'),
      );

      await expect(
        authService.register('test@example.com', 'password123', {
          profileCategory: 'student',
          profileField: 'architecture',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('fires createForAllAdmins with new_user type after registering', async () => {
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);

      await authService.register('test@example.com', 'password123', {
        profileCategory: 'student',
        profileField: 'architecture',
      });

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

    it('auto-enrolls a new customer and returns the credited user when beta mode is enabled', async () => {
      const enrolledUser = {
        ...mockUser,
        isBetaUser: true,
        betaCreditsGranted: true,
        credits: '100',
      };
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);
      (usersService.findById as jest.Mock).mockResolvedValue(enrolledUser);

      const result = await authService.register(
        'test@example.com',
        'password123',
        {
          profileCategory: 'student',
          profileField: 'architecture',
        },
      );

      expect(betaModeService.enrollUser).toHaveBeenCalledWith(mockUser.id);
      expect(usersService.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result.user).toEqual(
        expect.objectContaining({
          isBetaUser: true,
          betaCreditsGranted: true,
          credits: '100',
        }),
      );
    });

    it('does not auto-enroll a new customer when beta mode is disabled', async () => {
      (usersService.create as jest.Mock).mockResolvedValue(mockUser);
      (betaModeService.getSettings as jest.Mock).mockResolvedValue({
        id: 1,
        isEnabled: false,
      });

      await authService.register('test@example.com', 'password123', {
        profileCategory: 'student',
        profileField: 'architecture',
      });

      expect(betaModeService.enrollUser).not.toHaveBeenCalled();
      expect(usersService.findById).not.toHaveBeenCalled();
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

    it('repairs beta enrollment and credits when registration was interrupted', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const partialUser = {
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: true,
        isBetaUser: true,
        betaCreditsGranted: false,
      };
      const repairedUser = {
        ...partialUser,
        betaCreditsGranted: true,
        credits: 100,
      };
      (usersService.findByEmail as jest.Mock).mockResolvedValue(partialUser);
      (usersService.findById as jest.Mock).mockResolvedValue(repairedUser);

      const result = await authService.login('test@example.com', 'password123');

      expect(betaModeService.enrollUser).toHaveBeenCalledWith(1);
      expect(result.user).toEqual(expect.objectContaining({ credits: 100 }));
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

    it('rejects inactive users', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        accountHoldReason: null,
      });

      await expect(
        authService.login('test@example.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws ForbiddenException with code beta_held for beta survey hold', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      const betaCompletedAt = new Date('2026-04-01T10:00:00Z');
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        accountHoldReason: 'beta_survey_complete',
        fullName: 'Test User',
        betaPhotoUploadedAt: null,
        betaSharedOnSocial: false,
        betaCompletedAt,
        isBetaUser: true,
        isBetaSurveyExempt: false,
      });

      let thrown: unknown;
      try {
        await authService.login('test@example.com', 'password123');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      const body = (thrown as ForbiddenException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.code).toBe('beta_held');
      expect(body.betaPhotoUploaded).toBe(false);
      expect(body.betaSharedOnSocial).toBe(false);
      expect(body.betaCompletedAt).toBe(betaCompletedAt.toISOString());
      expect(body.access_token).toBe('mock-jwt-token');
      expect((body.user as Record<string, unknown>).email).toBe(
        'test@example.com',
      );
    });

    it('betaPhotoUploaded is true when betaPhotoUploadedAt is set', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        accountHoldReason: 'beta_survey_complete',
        fullName: 'Test User',
        betaPhotoUploadedAt: new Date(),
        betaSharedOnSocial: true,
        betaCompletedAt: null,
        isBetaUser: true,
        isBetaSurveyExempt: false,
      });

      let thrown: unknown;
      try {
        await authService.login('test@example.com', 'password123');
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(ForbiddenException);
      const body = (thrown as ForbiddenException).getResponse() as Record<
        string,
        unknown
      >;
      expect(body.betaPhotoUploaded).toBe(true);
      expect(body.betaSharedOnSocial).toBe(true);
    });

    it('reopens beta survey held users when beta mode is disabled', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        accountHoldReason: 'beta_survey_complete',
        isBetaUser: true,
        isBetaSurveyExempt: false,
      });
      (betaModeService.getSettings as jest.Mock).mockResolvedValue({
        id: 1,
        isEnabled: false,
      });

      const result = await authService.login('test@example.com', 'password123');

      expect(
        betaModeService.reopenCompletedBetaSurveyHolds,
      ).toHaveBeenCalledWith(1);
      expect(result.access_token).toBe('mock-jwt-token');
      expect(result.user).toEqual(
        expect.objectContaining({
          isActive: true,
          accountHoldReason: null,
          accountHeldAt: null,
        }),
      );
    });

    it.each(['rider', 'admin'])(
      'does not issue beta-held access to an inactive %s',
      async (role) => {
        const hashedPassword = await bcrypt.hash('password123', 10);
        (usersService.findByEmail as jest.Mock).mockResolvedValue({
          ...mockUser,
          role,
          passwordHash: hashedPassword,
          isActive: false,
          isBetaUser: true,
          isBetaSurveyExempt: false,
          accountHoldReason: 'beta_survey_complete',
        });

        await expect(
          authService.login('test@example.com', 'password123'),
        ).rejects.toBeInstanceOf(UnauthorizedException);
      },
    );

    it('does not issue beta-held access to an exempt customer', async () => {
      const hashedPassword = await bcrypt.hash('password123', 10);
      (usersService.findByEmail as jest.Mock).mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPassword,
        isActive: false,
        isBetaUser: true,
        isBetaSurveyExempt: true,
        accountHoldReason: 'beta_survey_complete',
      });

      await expect(
        authService.login('test@example.com', 'password123'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
