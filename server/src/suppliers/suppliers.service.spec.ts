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
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { SupplierAssignment } from '../matching/entities/supplier-assignment.entity';
import { ProductCategory } from '../products/entities/product-category.entity';
import { PricingModel } from '../products/enums/catalog.enums';

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
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
    remove: jest.fn(),
  };
  const verificationRepo = {
    findOne: jest.fn(),
    create: jest.fn((x) => x),
    save: jest.fn(),
  };
  const fileRepo = {
    findOne: jest.fn(),
  };
  const assignmentRepo = {
    createQueryBuilder: jest.fn(),
  };
  const categoryRepo = {
    findOne: jest.fn(),
  };

  const flyersCategory = {
    id: 100,
    slug: 'flyers',
    isActive: true,
    pricingModel: PricingModel.QUOTE_REQUIRED,
    groupSlug: 'marketing-promo',
    groupName: 'Marketing & Promotional Collateral',
    groupDescription: 'Promotional print products.',
    groupSortOrder: 1,
  } as ProductCategory;

  beforeEach(async () => {
    jest.resetAllMocks();
    profileRepo.create.mockImplementation((x) => x);
    capabilityRepo.create.mockImplementation((x) => x);
    capabilityRepo.find.mockResolvedValue([]);
    verificationRepo.create.mockImplementation((x) => x);
    categoryRepo.findOne.mockResolvedValue(flyersCategory);
    assignmentRepo.createQueryBuilder.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      setParameter: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    });
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
        { provide: getRepositoryToken(FileMetadata), useValue: fileRepo },
        {
          provide: getRepositoryToken(SupplierAssignment),
          useValue: assignmentRepo,
        },
        {
          provide: getRepositoryToken(ProductCategory),
          useValue: categoryRepo,
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

  describe('rankedServicesFromKeys', () => {
    it('maps onboarding ranks to 1-based Top N labels', () => {
      expect(
        service.rankedServicesFromKeys([
          'tarpaulins',
          'apparel',
          'document_printing',
        ]),
      ).toEqual([
        { rank: 1, key: 'tarpaulins', label: 'Tarpaulins' },
        { rank: 2, key: 'apparel', label: 'Apparel / Shirt Printing' },
        { rank: 3, key: 'document_printing', label: 'Document Printing' },
      ]);
    });
  });

  describe('leaderboard', () => {
    it('orders by rating count for reviews metric', async () => {
      profileRepo.find
        .mockResolvedValueOnce([
          {
            id: 1,
            userId: 10,
            businessName: 'Low Reviews',
            serviceFocusRanks: ['signages'],
            serviceZones: [],
            isActive: true,
            ratingAverage: 5,
            ratingCount: 1,
            capabilities: [],
            verification: { status: 'verified' },
            updatedAt: new Date(),
          },
          {
            id: 2,
            userId: 11,
            businessName: 'Most Reviews',
            serviceFocusRanks: ['tarpaulins', 'apparel'],
            serviceZones: [],
            isActive: true,
            ratingAverage: 4.2,
            ratingCount: 40,
            capabilities: [],
            verification: { status: 'verified' },
            updatedAt: new Date(),
          },
        ] as any)
        .mockResolvedValue([]);
      // findAll uses find then withLogoUrl which uses findById pattern - actually findAll maps withLogoUrl which may call files
      // Our find returns rows; withLogoUrl expects full row - mock find once only
      profileRepo.find.mockResolvedValue([
        {
          id: 1,
          userId: 10,
          businessName: 'Low Reviews',
          serviceFocusRanks: ['signages'],
          serviceZones: [],
          isActive: true,
          ratingAverage: 5,
          ratingCount: 1,
          capabilities: [],
          verification: { status: 'verified' },
          updatedAt: new Date(),
        },
        {
          id: 2,
          userId: 11,
          businessName: 'Most Reviews',
          serviceFocusRanks: ['tarpaulins', 'apparel'],
          serviceZones: [],
          isActive: true,
          ratingAverage: 4.2,
          ratingCount: 40,
          capabilities: [],
          verification: { status: 'verified' },
          updatedAt: new Date(),
        },
      ] as any);

      const board = await service.leaderboard('reviews', 10);
      expect(board[0].businessName).toBe('Most Reviews');
      expect(board[0].rank).toBe(1);
      expect(board[0].topService?.key).toBe('tarpaulins');
      expect(board[1].businessName).toBe('Low Reviews');
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

  describe('updateOwnProfile', () => {
    const verifiedProfile = {
      id: 1,
      userId: 10,
      businessName: 'Davao Print Co',
      description: null,
      contactPhone: null,
      contactEmail: null,
      address: null,
      serviceZones: ['Davao City'],
      attributes: {},
      logoFileId: null,
      isActive: true,
      verification: { status: SupplierVerificationStatus.VERIFIED },
      capabilities: [],
    };

    it('updates description, attributes, and contact fields', async () => {
      profileRepo.findOne
        .mockResolvedValueOnce({ ...verifiedProfile }) // assertVerified
        .mockResolvedValueOnce({ ...verifiedProfile }) // findById in updateProfile
        .mockResolvedValueOnce({
          ...verifiedProfile,
          description: 'Large format shop',
          contactPhone: '+639171234567',
          attributes: { equipment: 'HP Latex' },
        });
      profileRepo.save.mockImplementation(async (p) => p);

      const out = await service.updateOwnProfile(10, {
        description: 'Large format shop',
        contactPhone: '+639171234567',
        attributes: { equipment: 'HP Latex', '': 'skip' },
      });

      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'Large format shop',
          contactPhone: '+639171234567',
          attributes: { equipment: 'HP Latex' },
        }),
      );
      expect(out.attributes).toEqual({ equipment: 'HP Latex' });
    });

    it('sets logo when file is owned by the supplier', async () => {
      profileRepo.findOne
        .mockResolvedValueOnce({ ...verifiedProfile })
        .mockResolvedValueOnce({ ...verifiedProfile })
        .mockResolvedValueOnce({
          ...verifiedProfile,
          logoFileId: 42,
        });
      profileRepo.save.mockImplementation(async (p) => p);
      fileRepo.findOne
        .mockResolvedValueOnce({
          id: 42,
          uploadedBy: 10,
          purpose: 'general',
          objectKey: null,
          url: null,
        })
        .mockResolvedValueOnce({
          id: 42,
          objectKey: null,
          url: 'http://cdn/logo.jpg',
        });

      const out = await service.updateOwnProfile(10, { logoFileId: 42 });
      expect(profileRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ logoFileId: 42 }),
      );
      expect(out.logoFileId).toBe(42);
    });

    it('rejects logo files owned by someone else', async () => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      fileRepo.findOne.mockResolvedValue({
        id: 42,
        uploadedBy: 99,
        purpose: 'general',
      });

      await expect(
        service.updateOwnProfile(10, { logoFileId: 42 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(profileRepo.save).not.toHaveBeenCalled();
    });

    it('blocks pending suppliers from self-edit', async () => {
      profileRepo.findOne.mockResolvedValue({
        ...verifiedProfile,
        verification: { status: SupplierVerificationStatus.PENDING },
      });
      await expect(
        service.updateOwnProfile(10, { businessName: 'Nope' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('addOwnCapability / removeOwnCapability', () => {
    const verifiedProfile = {
      id: 1,
      userId: 10,
      isActive: true,
      verification: { status: SupplierVerificationStatus.VERIFIED },
      capabilities: [],
    };

    it('adds a capability on own profile', async () => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      capabilityRepo.save.mockImplementation(async (c) => ({ ...c, id: 7 }));

      const out = await service.addOwnCapability(10, {
        productFamily: '  FLYERS  ',
        materials: ['glossy'],
        maxCapacity: 50,
        leadTimeDays: 2,
      });
      expect(out.productFamily).toBe('flyers');
      expect(capabilityRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ productFamily: 'flyers', isActive: true }),
      );
    });

    it.each([
      [
        'browsing group',
        'marketing-promo',
        {
          ...flyersCategory,
          slug: 'marketing-promo',
          groupSlug: null,
          groupName: null,
          groupDescription: null,
          groupSortOrder: null,
        },
      ],
      [
        'inactive legacy category',
        'paper',
        {
          ...flyersCategory,
          slug: 'paper',
          isActive: false,
          pricingModel: PricingModel.PER_PAGE_MODIFIERS,
          groupSlug: null,
          groupName: null,
          groupDescription: null,
          groupSortOrder: null,
        },
      ],
      ['singular synonym', 'flyer', null],
      ['free-form value', 'rush-printing', null],
    ])('rejects a %s as a capability', async (_label, slug, category) => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      categoryRepo.findOne.mockResolvedValue(category);

      await expect(
        service.addOwnCapability(10, { productFamily: slug }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'invalid_supplier_capability_product',
        }),
      });
      expect(capabilityRepo.save).not.toHaveBeenCalled();
    });

    it('rejects an existing normalized supplier/product capability', async () => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      capabilityRepo.findOne.mockResolvedValue(null);
      capabilityRepo.find.mockResolvedValue([
        {
          id: 7,
          supplierId: 1,
          productFamily: ' FLYERS ',
        },
      ]);

      await expect(
        service.addOwnCapability(10, { productFamily: ' FLYERS ' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'supplier_capability_exists',
        }),
      });
      expect(capabilityRepo.save).not.toHaveBeenCalled();
    });

    it('maps a concurrent capability unique violation to the same conflict', async () => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      capabilityRepo.findOne.mockResolvedValue(null);
      capabilityRepo.save.mockRejectedValue({
        driverError: {
          code: '23505',
          constraint: 'uq_supplier_capability_product',
        },
      });

      await expect(
        service.addOwnCapability(10, { productFamily: 'flyers' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'supplier_capability_exists',
        }),
      });
    });

    it('removes only own capability', async () => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      capabilityRepo.findOne.mockResolvedValue({
        id: 7,
        supplierId: 1,
        productFamily: 'flyer',
      });
      capabilityRepo.remove.mockResolvedValue(undefined);

      await service.removeOwnCapability(10, 7);
      expect(capabilityRepo.remove).toHaveBeenCalled();
    });

    it('throws when capability is missing', async () => {
      profileRepo.findOne.mockResolvedValue({ ...verifiedProfile });
      capabilityRepo.findOne.mockResolvedValue(null);
      await expect(service.removeOwnCapability(10, 404)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
