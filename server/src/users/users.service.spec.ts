import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import * as bcrypt from 'bcrypt';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Partial<Repository<User>>>;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    role: 'customer',
    fullName: null,
    profileCategory: 'student',
    profileField: 'architecture',
    printingPreferences: ['plotting_blueprints'],
    isProfileComplete: false,
  } as User;

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOneOrFail: jest.fn(),
      find: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('findByEmail', () => {
    it('should return user when found', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.findByEmail('test@example.com');

      expect(result).toEqual(mockUser);
      expect(repo.findOne).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
      });
    });

    it('should return null when not found', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user when found', async () => {
      repo.findOne.mockResolvedValue(mockUser);

      const result = await service.findById(1);

      expect(result).toEqual(mockUser);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });
  });

  describe('create', () => {
    it('should hash password and save user', async () => {
      repo.findOne.mockResolvedValue(null); // no existing user
      repo.create.mockReturnValue(mockUser);
      repo.save.mockResolvedValue(mockUser);

      const result = await service.create('test@example.com', 'password123', {
        profileCategory: 'student',
        profileField: 'architecture',
        printingPreferences: ['plotting_blueprints'],
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          role: 'customer',
          profileCategory: 'student',
          profileField: 'architecture',
          printingPreferences: ['plotting_blueprints'],
          isProfileComplete: false,
        }),
      );
      // Verify the passwordHash is a bcrypt hash, not plaintext
      const createCall = repo.create.mock.calls[0][0] as any;
      const isHashed = await bcrypt.compare(
        'password123',
        createCall.passwordHash,
      );
      expect(isHashed).toBe(true);
      expect(repo.save).toHaveBeenCalledWith(mockUser);
      expect(result).toEqual(mockUser);
    });

    it('passes optional identity fields into repo.create and keeps completion logic', async () => {
      repo.findOne.mockResolvedValue(null);
      repo.create.mockReturnValue(mockUser);
      repo.save.mockResolvedValue({
        ...mockUser,
        fullName: 'Maria Santos',
        isProfileComplete: true,
      } as User);

      await service.create('test@example.com', 'password123', {
        fullName: 'Maria Santos',
        nickname: 'Mia',
        profileCategory: 'student',
        profileField: 'architecture',
        phoneNumber: '+639171234567',
        gender: 'female',
        ageRange: '18_24',
        dateOfBirth: '2001-02-03',
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fullName: 'Maria Santos',
          nickname: 'Mia',
          profileCategory: 'student',
          profileField: 'architecture',
          phoneNumber: '+639171234567',
          gender: 'female',
          ageRange: '18_24',
          dateOfBirth: expect.any(Date),
          isProfileComplete: true,
        }),
      );
    });

    it('should throw ConflictException if email exists', async () => {
      repo.findOne.mockResolvedValue(mockUser); // existing user found

      await expect(
        service.create('test@example.com', 'password123'),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateProfile', () => {
    it('should update and return user', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com' } as User;
      repo.findOne.mockResolvedValue(mockUser);
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(1, {
        email: 'new@example.com',
      } as Partial<User>);

      expect(repo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          email: 'new@example.com',
          isProfileComplete: false,
        }),
      );
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(repo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(updatedUser);
    });

    it('marks the profile complete when required profiling fields are present', async () => {
      const existingUser = {
        ...mockUser,
        fullName: null,
        isProfileComplete: false,
      } as User;
      const updatedUser = {
        ...existingUser,
        fullName: 'Maria Santos',
        isProfileComplete: true,
      } as User;
      repo.findOne.mockResolvedValue(existingUser);
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(1, {
        fullName: 'Maria Santos',
      });

      expect(repo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          fullName: 'Maria Santos',
          isProfileComplete: true,
        }),
      );
      expect(result.isProfileComplete).toBe(true);
    });

    it('normalizes nickname and ageRange during profile updates', async () => {
      const updatedUser = {
        ...mockUser,
        nickname: 'Mia',
        ageRange: '25_34',
      } as User;
      repo.findOne.mockResolvedValue(mockUser);
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(updatedUser);

      await service.updateProfile(1, {
        nickname: '  Mia  ',
        ageRange: '25_34',
      } as Partial<User>);

      expect(repo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          nickname: 'Mia',
          ageRange: '25_34',
        }),
      );
    });
  });

  describe('findAllByRole', () => {
    it('returns all users with the given role', async () => {
      const admins = [
        { id: 1, email: 'admin@gridgo.ph', role: 'admin' } as User,
      ];
      repo.find.mockResolvedValue(admins);

      const result = await service.findAllByRole('admin');

      expect(repo.find).toHaveBeenCalledWith({ where: { role: 'admin' } });
      expect(result).toEqual(admins);
    });

    it('returns empty array when no users with that role exist', async () => {
      repo.find.mockResolvedValue([]);

      const result = await service.findAllByRole('admin');

      expect(result).toEqual([]);
    });
  });
});

describe('UsersService — storage settings', () => {
  let service: UsersService;
  const repo = {
    findOne: jest.fn(),
    findOneOrFail: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  describe('getStorageSettings', () => {
    it('returns fileRetentionDays when set', async () => {
      repo.findOneOrFail.mockResolvedValue({
        id: 1,
        fileRetentionDays: 7,
      } as User);
      expect(await service.getStorageSettings(1)).toEqual({
        fileRetentionDays: 7,
      });
    });

    it('returns null when fileRetentionDays is null', async () => {
      repo.findOneOrFail.mockResolvedValue({
        id: 1,
        fileRetentionDays: null,
      } as User);
      expect(await service.getStorageSettings(1)).toEqual({
        fileRetentionDays: null,
      });
    });
  });

  describe('updateStorageSettings', () => {
    it('sets a valid retention period', async () => {
      repo.update.mockResolvedValue({});
      await service.updateStorageSettings(1, 30);
      expect(repo.update).toHaveBeenCalledWith(1, { fileRetentionDays: 30 });
    });

    it('sets null (disables retention)', async () => {
      repo.update.mockResolvedValue({});
      await service.updateStorageSettings(1, null);
      expect(repo.update).toHaveBeenCalledWith(1, { fileRetentionDays: null });
    });

    it('accepts a custom retention value', async () => {
      repo.update.mockResolvedValue({});
      await service.updateStorageSettings(1, 14);
      expect(repo.update).toHaveBeenCalledWith(1, { fileRetentionDays: 14 });
    });
  });

  describe('setDefaultPaymentMethod', () => {
    it('saves the new default to the user record', async () => {
      repo.update.mockResolvedValue({ affected: 1 } as never);
      await service.setDefaultPaymentMethod(1, 'gcash');
      expect(repo.update).toHaveBeenCalledWith(1, {
        defaultPaymentMethod: 'gcash',
      });
    });

    it('rejects unknown methods', async () => {
      await expect(
        service.setDefaultPaymentMethod(1, 'crypto' as never),
      ).rejects.toThrow(BadRequestException);
      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
