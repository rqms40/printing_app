import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SuperService } from './super.service';
import { UserRole } from '../users/entities/user.entity';
import { RiderVerificationStatus } from '../riders/entities/rider-profile.entity';

describe('SuperService', () => {
  let service: SuperService;
  let usersRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
  };
  let auditService: { append: jest.Mock };
  let riderRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    create: jest.Mock;
  };
  let supplierRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let supplierVerificationRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };
  let supplierCapabilityRepo: {
    count: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
  };

  beforeEach(() => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (u) => u),
      count: jest.fn(),
    };
    auditService = { append: jest.fn() };
    riderRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (p) => ({ id: 99, ...p })),
      find: jest.fn(),
      create: jest.fn((p) => p),
    };
    supplierRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (p) => ({ id: 77, ...p })),
      create: jest.fn((p) => p),
    };
    supplierVerificationRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (p) => ({ id: 1, ...p })),
      create: jest.fn((p) => p),
    };
    supplierCapabilityRepo = {
      count: jest.fn().mockResolvedValue(0),
      save: jest.fn(async (p) => p),
      create: jest.fn((p) => p),
    };

    service = new SuperService(
      usersRepo as any,
      { createQueryBuilder: jest.fn(), count: jest.fn() } as any,
      riderRepo as any,
      { count: jest.fn() } as any,
      { count: jest.fn() } as any,
      { count: jest.fn() } as any,
      supplierRepo as any,
      supplierVerificationRepo as any,
      supplierCapabilityRepo as any,
      auditService as any,
      { query: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any,
    );
  });

  describe('updateUserRole', () => {
    it('rejects non-super actors', async () => {
      await expect(
        service.updateUserRole(2, UserRole.RIDER, 1, UserRole.OPS_ADMIN),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('changes role and writes audit', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 2,
        email: 'x@test.com',
        role: UserRole.CLIENT,
        fullName: 'X Test',
        organization: 'X Prints',
      });
      const out = await service.updateUserRole(
        2,
        UserRole.SUPPLIER,
        1,
        UserRole.SUPER_ADMIN,
      );
      expect(out.role).toBe(UserRole.SUPPLIER);
      expect(supplierRepo.save).toHaveBeenCalled();
      expect(supplierVerificationRepo.save).toHaveBeenCalled();
      expect(supplierCapabilityRepo.save).toHaveBeenCalled();
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role_change',
          fromState: UserRole.CLIENT,
          toState: UserRole.SUPPLIER,
        }),
      );
    });

    it('creates pending rider profile when promoting to rider', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 5,
        email: 'rider@test.com',
        role: UserRole.CLIENT,
        fullName: 'Rider Test',
      });
      const out = await service.updateUserRole(
        5,
        UserRole.RIDER,
        1,
        UserRole.SUPER_ADMIN,
      );
      expect(out.role).toBe(UserRole.RIDER);
      expect(riderRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 5,
          verificationStatus: RiderVerificationStatus.PENDING,
        }),
      );
      expect(riderRepo.save).toHaveBeenCalled();
    });

    it('blocks demoting last super_admin', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'admin@test.com',
        role: UserRole.SUPER_ADMIN,
      });
      usersRepo.count.mockResolvedValue(1);
      await expect(
        service.updateUserRole(1, UserRole.OPS_ADMIN, 9, UserRole.SUPER_ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('blocks self demotion', async () => {
      usersRepo.findOne.mockResolvedValue({
        id: 1,
        email: 'admin@test.com',
        role: UserRole.SUPER_ADMIN,
      });
      usersRepo.count.mockResolvedValue(2);
      await expect(
        service.updateUserRole(1, UserRole.OPS_ADMIN, 1, UserRole.SUPER_ADMIN),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('setRiderVerification', () => {
    it('sets verified and audits', async () => {
      riderRepo.findOne.mockResolvedValue({
        id: 3,
        userId: 10,
        verificationStatus: RiderVerificationStatus.PENDING,
        isAvailable: false,
      });
      const out = await service.setRiderVerification(
        3,
        RiderVerificationStatus.VERIFIED,
        1,
        'docs ok',
      );
      expect(out.verificationStatus).toBe(RiderVerificationStatus.VERIFIED);
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'rider_verification' }),
      );
    });

    it('forces offline when rejected', async () => {
      riderRepo.findOne.mockResolvedValue({
        id: 3,
        userId: 10,
        verificationStatus: RiderVerificationStatus.VERIFIED,
        isAvailable: true,
      });
      const out = await service.setRiderVerification(
        3,
        RiderVerificationStatus.REJECTED,
        1,
        'bad docs',
      );
      expect(out.isAvailable).toBe(false);
    });
  });
});
