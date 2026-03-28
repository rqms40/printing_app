import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { AddressesService } from './addresses.service';
import { Address } from './entities/address.entity';

describe('AddressesService', () => {
  let service: AddressesService;
  let repo: jest.Mocked<Partial<Repository<Address>>>;

  const mockAddress = {
    id: 1,
    userId: 1,
    label: 'Home',
    street: '123 Main St',
    isDefault: false,
    createdAt: new Date(),
  } as Address;

  beforeEach(async () => {
    repo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      remove: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AddressesService,
        { provide: getRepositoryToken(Address), useValue: repo },
      ],
    }).compile();

    service = module.get(AddressesService);
  });

  describe('findByUser', () => {
    it('should return user addresses sorted by isDefault DESC then createdAt DESC', async () => {
      const addresses = [mockAddress];
      repo.find.mockResolvedValue(addresses);

      const result = await service.findByUser(1);

      expect(repo.find).toHaveBeenCalledWith({
        where: { userId: 1 },
        order: { isDefault: 'DESC', createdAt: 'DESC' },
      });
      expect(result).toEqual(addresses);
    });
  });

  describe('create', () => {
    it('should save address when under limit', async () => {
      repo.count.mockResolvedValue(2);
      repo.create.mockReturnValue(mockAddress);
      repo.save.mockResolvedValue(mockAddress);

      const dto = { label: 'Home', street: '123 Main St', isDefault: false } as any;
      const result = await service.create(1, dto);

      expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 1 }));
      expect(repo.save).toHaveBeenCalled();
      expect(result).toEqual(mockAddress);
    });

    it('should throw BadRequestException if user has 5+ addresses', async () => {
      repo.count.mockResolvedValue(5);

      const dto = { label: 'Office', street: '456 Elm St' } as any;

      await expect(service.create(1, dto)).rejects.toThrow(BadRequestException);
    });

    it('should set first address as default', async () => {
      repo.count.mockResolvedValue(0);
      repo.update.mockResolvedValue(undefined as any);
      const addressWithDefault = { ...mockAddress, isDefault: true } as Address;
      repo.create.mockReturnValue(addressWithDefault);
      repo.save.mockResolvedValue(addressWithDefault);

      const dto = { label: 'Home', street: '123 Main St', isDefault: false } as any;
      await service.create(1, dto);

      // clearDefault should be called, and isDefault should be set to true
      expect(repo.update).toHaveBeenCalledWith(
        { userId: 1, isDefault: true },
        { isDefault: false },
      );
    });
  });

  describe('setDefault', () => {
    it('should set one as default and unset others', async () => {
      repo.findOne.mockResolvedValue(mockAddress);
      repo.update.mockResolvedValue(undefined as any);
      const defaultAddress = { ...mockAddress, isDefault: true } as Address;
      repo.save.mockResolvedValue(defaultAddress);

      const result = await service.setDefault(1, 1);

      expect(repo.update).toHaveBeenCalledWith(
        { userId: 1, isDefault: true },
        { isDefault: false },
      );
      expect(repo.save).toHaveBeenCalled();
      expect(result.isDefault).toBe(true);
    });
  });

  describe('remove', () => {
    it('should remove address owned by user', async () => {
      repo.findOne.mockResolvedValue(mockAddress);
      repo.remove.mockResolvedValue(mockAddress);

      await service.remove(1, 1);

      expect(repo.remove).toHaveBeenCalledWith(mockAddress);
    });

    it('should throw ForbiddenException if address belongs to another user', async () => {
      const otherUserAddress = { ...mockAddress, userId: 999 } as Address;
      repo.findOne.mockResolvedValue(otherUserAddress);

      await expect(service.remove(1, 1)).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if address does not exist', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.remove(999, 1)).rejects.toThrow(NotFoundException);
    });
  });
});
