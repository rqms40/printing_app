import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConflictException } from '@nestjs/common';
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

      const result = await service.create('test@example.com', 'password123');

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          role: 'customer',
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
      repo.update.mockResolvedValue(undefined as any);
      repo.findOneOrFail.mockResolvedValue(updatedUser);

      const result = await service.updateProfile(1, {
        email: 'new@example.com',
      } as Partial<User>);

      expect(repo.update).toHaveBeenCalledWith(1, { email: 'new@example.com' });
      expect(repo.findOneOrFail).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(result).toEqual(updatedUser);
    });
  });

  describe('findAllByRole', () => {
    it('returns all users with the given role', async () => {
      const admins = [
        { id: 1, email: 'admin@grid.ph', role: 'admin' } as User,
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
