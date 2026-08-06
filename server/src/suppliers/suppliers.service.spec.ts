/* eslint-disable @typescript-eslint/no-unsafe-return */
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { SupplierProfile } from './entities/supplier-profile.entity';
import { SupplierCapability } from './entities/supplier-capability.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from './entities/supplier-verification.entity';

describe('SuppliersService', () => {
  let service: SuppliersService;

  const profileRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const capabilityRepo = {
    find: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const verificationRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: getRepositoryToken(SupplierProfile), useValue: profileRepo },
        {
          provide: getRepositoryToken(SupplierCapability),
          useValue: capabilityRepo,
        },
        {
          provide: getRepositoryToken(SupplierVerification),
          useValue: verificationRepo,
        },
      ],
    }).compile();
    service = mod.get(SuppliersService);
  });

  describe('createProfile', () => {
    it('creates a profile and a pending verification row', async () => {
      profileRepo.findOne
        .mockResolvedValueOnce(null) // existing check
        .mockResolvedValueOnce({
          // findById after save
          id: 1,
          userId: 10,
          businessName: 'Davao Print Co',
          serviceZones: ['Davao City'],
          isActive: true,
          ratingAverage: 0,
          ratingCount: 0,
          verification: {
            id: 1,
            supplierId: 1,
            status: SupplierVerificationStatus.PENDING,
          },
          capabilities: [],
        });
      profileRepo.save.mockImplementation(async (p) => ({ ...p, id: 1 }));
      verificationRepo.save.mockImplementation(async (v) => ({
        ...v,
        id: 1,
      }));

      const result = await service.createProfile({
        userId: 10,
        businessName: 'Davao Print Co',
        serviceZones: ['Davao City'],
      });

      expect(profileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 10,
          businessName: 'Davao Print Co',
          serviceZones: ['Davao City'],
          isActive: true,
          ratingAverage: 0,
          ratingCount: 0,
        }),
      );
      expect(verificationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          supplierId: 1,
          status: SupplierVerificationStatus.PENDING,
        }),
      );
      expect(verificationRepo.save).toHaveBeenCalled();
      expect(result.businessName).toBe('Davao Print Co');
      expect(result.verification.status).toBe(
        SupplierVerificationStatus.PENDING,
      );
    });

    it('throws ConflictException when profile already exists for user', async () => {
      profileRepo.findOne.mockResolvedValue({ id: 1, userId: 10 });

      await expect(
        service.createProfile({
          userId: 10,
          businessName: 'Dup',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('setVerification', () => {
    it('sets status to verified with payout ref and reviewer', async () => {
      profileRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 10,
        businessName: 'Davao Print Co',
        verification: null,
        capabilities: [],
      });
      verificationRepo.findOne.mockResolvedValue({
        id: 5,
        supplierId: 1,
        status: SupplierVerificationStatus.PENDING,
        payoutDetailsRef: null,
        reviewedBy: null,
        reviewedAt: null,
        notes: null,
      });
      verificationRepo.save.mockImplementation(async (v) => v);

      const out = await service.setVerification(
        1,
        {
          status: SupplierVerificationStatus.VERIFIED,
          payoutDetailsRef: 'payout:vault:supplier-1',
        },
        99,
      );

      expect(out.status).toBe(SupplierVerificationStatus.VERIFIED);
      expect(out.payoutDetailsRef).toBe('payout:vault:supplier-1');
      expect(out.reviewedBy).toBe(99);
      expect(out.reviewedAt).toBeInstanceOf(Date);
      expect(verificationRepo.save).toHaveBeenCalled();
    });

    it('rejects verified without payoutDetailsRef', async () => {
      profileRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 10,
        verification: null,
        capabilities: [],
      });
      verificationRepo.findOne.mockResolvedValue({
        id: 5,
        supplierId: 1,
        status: SupplierVerificationStatus.PENDING,
        payoutDetailsRef: null,
      });

      await expect(
        service.setVerification(
          1,
          { status: SupplierVerificationStatus.VERIFIED },
          99,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for missing supplier', async () => {
      profileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.setVerification(
          404,
          {
            status: SupplierVerificationStatus.UNDER_REVIEW,
          },
          99,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assertVerifiedOperationalAccess', () => {
    it('allows verified active suppliers', async () => {
      profileRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 10,
        isActive: true,
        verification: { status: SupplierVerificationStatus.VERIFIED },
        capabilities: [],
      });
      await expect(
        service.assertVerifiedOperationalAccess(10),
      ).resolves.toMatchObject({ id: 1 });
    });

    it.each([
      SupplierVerificationStatus.PENDING,
      SupplierVerificationStatus.UNDER_REVIEW,
      SupplierVerificationStatus.REJECTED,
    ])('blocks %s suppliers', async (status) => {
      profileRepo.findOne.mockResolvedValue({
        id: 1,
        userId: 10,
        isActive: true,
        verification: { status },
        capabilities: [],
      });
      await expect(
        service.assertVerifiedOperationalAccess(10),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
