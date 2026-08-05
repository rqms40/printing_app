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
  };

  beforeEach(() => {
    usersRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (u) => u),
      count: jest.fn(),
    };
    auditService = { append: jest.fn() };
    riderRepo = {
      findOne: jest.fn(),
      save: jest.fn(async (p) => p),
      find: jest.fn(),
    };

    service = new SuperService(
      usersRepo as any,
      { createQueryBuilder: jest.fn(), count: jest.fn() } as any,
      riderRepo as any,
      { count: jest.fn() } as any,
      { count: jest.fn() } as any,
      { count: jest.fn() } as any,
      {
        createQueryBuilder: jest.fn(() => ({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          getCount: jest.fn().mockResolvedValue(0),
        })),
      } as any,
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
      });
      const out = await service.updateUserRole(
        2,
        UserRole.SUPPLIER,
        1,
        UserRole.SUPER_ADMIN,
      );
      expect(out.role).toBe(UserRole.SUPPLIER);
      expect(auditService.append).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'role_change',
          fromState: UserRole.CLIENT,
          toState: UserRole.SUPPLIER,
        }),
      );
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
