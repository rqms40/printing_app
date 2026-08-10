// server/src/products/products.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ProductsService } from './products.service';
import { CatalogReadService } from './catalog-read.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { ProductCategory } from './entities/product-category.entity';
import { ProductSpecDefinition } from './entities/product-spec-definition.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import { PricingModel } from './enums/catalog.enums';

const mockCatRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockOptRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  remove: jest.fn(),
});

const mockSpecRepo = () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
});

const mockAddonRepo = () => ({
  find: jest.fn(),
  findOneOrFail: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  remove: jest.fn(),
});

describe('ProductsService', () => {
  let service: ProductsService;
  let optRepo: ReturnType<typeof mockOptRepo>;
  let catRepo: ReturnType<typeof mockCatRepo>;
  let specRepo: ReturnType<typeof mockSpecRepo>;
  let catalogReadService: { getPublicCategoryBySlug: jest.Mock };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(ProductCategory),
          useFactory: mockCatRepo,
        },
        {
          provide: getRepositoryToken(ProductSpecDefinition),
          useFactory: mockSpecRepo,
        },
        {
          provide: getRepositoryToken(ProductSpecOption),
          useFactory: mockOptRepo,
        },
        {
          provide: getRepositoryToken(ServiceAddon),
          useFactory: mockAddonRepo,
        },
        {
          provide: CatalogReadService,
          useValue: {
            getPublicCatalog: jest.fn(),
            getPublicCategoryBySlug: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    catRepo = module.get(getRepositoryToken(ProductCategory));
    specRepo = module.get(getRepositoryToken(ProductSpecDefinition));
    optRepo = module.get(getRepositoryToken(ProductSpecOption));
    catalogReadService = module.get(CatalogReadService);
  });

  describe('getCategoryPricing', () => {
    it('returns pending pricing metadata instead of exposing an RFQ zero base rate', async () => {
      catalogReadService.getPublicCategoryBySlug.mockResolvedValue({
        id: 10,
        name: 'Flyers',
        slug: 'flyers',
        description: 'Single-sheet promotional printing.',
        mobileDescription: 'Single-sheet promotional printing.',
        examples: ['Single sheets', 'Event promos'],
        groupSlug: 'marketing-promo',
        groupName: 'Marketing & Promotional Collateral',
        groupDescription: 'Best for businesses, startups, and events.',
        groupSortOrder: 1,
        icon: null,
        fileProcessingType: 'document',
        pricingModel: PricingModel.QUOTE_REQUIRED,
        baseRate: 0,
        quantityUnit: 'copy',
        maxFileSizeMb: 100,
        allowedExtensions: ['pdf'],
        specs: [],
        addons: [],
      });

      const result = await service.getCategoryPricing('flyers');

      expect(result).toMatchObject({
        group_slug: 'marketing-promo',
        group_name: 'Marketing & Promotional Collateral',
        group_description: 'Best for businesses, startups, and events.',
        group_sort_order: 1,
        examples: ['Single sheets', 'Event promos'],
        pricing_model: 'quote_required',
        pricing_status: 'pending_quote',
        base_rate: null,
      });
    });
  });

  describe('createCategory', () => {
    it('throws ConflictException if slug already exists', async () => {
      catRepo.findOne.mockResolvedValue({ id: 99, slug: 'paper' });
      await expect(
        service.createCategory({
          slug: 'paper',
          name: 'X',
          baseRate: 2,
          maxFileSizeMb: 50,
          allowedExtensions: '[]',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('creates and returns a new category', async () => {
      catRepo.findOne.mockResolvedValue(null);
      catRepo.create.mockReturnValue({ id: 1, slug: 'paper', name: 'Paper' });
      catRepo.save.mockResolvedValue({ id: 1, slug: 'paper', name: 'Paper' });
      const result = await service.createCategory({
        slug: 'paper',
        name: 'Paper',
        baseRate: 2,
        maxFileSizeMb: 50,
        allowedExtensions: '["pdf"]',
      });
      expect(result.slug).toBe('paper');
      expect(catRepo.save).toHaveBeenCalledTimes(1);
    });

    it('accepts complete active RFQ group metadata and an internal zero base rate', async () => {
      const dto = {
        slug: 'flyers',
        name: 'Flyers',
        description: 'Single-sheet promotional printing.',
        groupSlug: 'marketing-promo',
        groupName: 'Marketing & Promotional Collateral',
        groupDescription: 'Best for businesses, startups, and events.',
        groupSortOrder: 1,
        examples: ['Single sheets', 'Event promos'],
        pricingModel: PricingModel.QUOTE_REQUIRED,
        baseRate: 0,
        maxFileSizeMb: 100,
        allowedExtensions: '["pdf","png"]',
        isActive: true,
        sortOrder: 1,
      };
      const validationErrors = await validate(
        plainToInstance(CreateCategoryDto, dto),
      );
      expect(validationErrors).toEqual([]);
      catRepo.findOne.mockResolvedValue(null);
      catRepo.create.mockReturnValue(dto);
      catRepo.save.mockResolvedValue({ id: 10, ...dto });

      const result = await service.createCategory(dto);

      expect(result).toMatchObject({
        pricingModel: PricingModel.QUOTE_REQUIRED,
        baseRate: 0,
        groupSlug: 'marketing-promo',
        groupName: 'Marketing & Promotional Collateral',
        groupDescription: 'Best for businesses, startups, and events.',
        groupSortOrder: 1,
        examples: ['Single sheets', 'Event promos'],
      });
    });

    it('rejects a new active RFQ product with incomplete group metadata', async () => {
      catRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createCategory({
          slug: 'flyers',
          name: 'Flyers',
          groupSlug: 'marketing-promo',
          pricingModel: PricingModel.QUOTE_REQUIRED,
          baseRate: 0,
          maxFileSizeMb: 100,
          allowedExtensions: '["pdf"]',
          isActive: true,
        } as any),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'RFQ_GROUP_METADATA_REQUIRED',
        }),
      });
      expect(catRepo.save).not.toHaveBeenCalled();
    });

    it('keeps numeric pricing models on a positive base rate', async () => {
      catRepo.findOne.mockResolvedValue(null);

      await expect(
        service.createCategory({
          slug: 'paper-v2',
          name: 'Paper v2',
          pricingModel: PricingModel.PER_PAGE_MODIFIERS,
          baseRate: 0,
          maxFileSizeMb: 50,
          allowedExtensions: '["pdf"]',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateCategory', () => {
    it('rejects activating an RFQ product whose resulting group metadata is incomplete', async () => {
      catRepo.findOneOrFail.mockResolvedValue({
        id: 10,
        slug: 'flyers',
        name: 'Flyers',
        pricingModel: PricingModel.QUOTE_REQUIRED,
        baseRate: 0,
        isActive: false,
        groupSlug: null,
        groupName: null,
        groupDescription: null,
        groupSortOrder: null,
      });

      await expect(
        service.updateCategory(10, { isActive: true }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'RFQ_GROUP_METADATA_REQUIRED',
        }),
      });
      expect(catRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('createOption', () => {
    it('throws ConflictException if (categoryId, optionGroup, value) already exists', async () => {
      specRepo.findOne.mockResolvedValue({ id: 10, key: 'paper_size' });
      optRepo.findOne.mockResolvedValue({ id: 1 });
      await expect(
        service.createOption({
          categoryId: 1,
          optionGroup: 'paper_size',
          label: 'A4',
          value: 'a4',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException if multiplier is 0', async () => {
      specRepo.findOne.mockResolvedValue({ id: 10, key: 'paper_size' });
      optRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createOption({
          categoryId: 1,
          optionGroup: 'paper_size',
          label: 'A4',
          value: 'a4',
          multiplier: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if multiplier is negative', async () => {
      specRepo.findOne.mockResolvedValue({ id: 10, key: 'paper_size' });
      optRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createOption({
          categoryId: 1,
          optionGroup: 'paper_size',
          label: 'A4',
          value: 'a4',
          multiplier: -1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates and returns the option', async () => {
      specRepo.findOne.mockResolvedValue({ id: 10, key: 'paper_size' });
      optRepo.findOne.mockResolvedValue(null);
      optRepo.create.mockReturnValue({ id: 1, label: 'A4' });
      optRepo.save.mockResolvedValue({ id: 1, label: 'A4' });
      const result = await service.createOption({
        categoryId: 1,
        optionGroup: 'paper_size',
        label: 'A4',
        value: 'a4',
        multiplier: 1.0,
      });
      expect(result.label).toBe('A4');
    });
  });

  describe('updateOption', () => {
    it('throws BadRequestException when disabling the last active option in a group', async () => {
      optRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        specDefinitionId: 10,
        isActive: true,
      });
      optRepo.count.mockResolvedValue(1); // only 1 active
      await expect(
        service.updateOption(1, { isActive: false }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows disabling when 2+ options are active in the group', async () => {
      optRepo.findOneOrFail
        .mockResolvedValueOnce({
          id: 1,
          specDefinitionId: 10,
          isActive: true,
        })
        .mockResolvedValueOnce({ id: 1, isActive: false });
      optRepo.count.mockResolvedValue(2);
      optRepo.update.mockResolvedValue(undefined);
      await service.updateOption(1, { isActive: false });
      expect(optRepo.update).toHaveBeenCalledWith(1, { isActive: false });
    });
  });

  describe('deleteOption', () => {
    it('throws BadRequestException when removing last active option in a group', async () => {
      optRepo.findOneOrFail.mockResolvedValue({
        id: 1,
        categoryId: 1,
        optionGroup: 'paper_size',
        isActive: true,
      });
      optRepo.count.mockResolvedValue(1);
      await expect(service.deleteOption(1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('removes the option when it is not the last active', async () => {
      const opt = {
        id: 1,
        specDefinitionId: 10,
        isActive: true,
      };
      optRepo.findOneOrFail.mockResolvedValue(opt);
      optRepo.count.mockResolvedValue(2);
      optRepo.remove.mockResolvedValue(undefined);
      await service.deleteOption(1);
      expect(optRepo.remove).toHaveBeenCalledWith(opt);
    });
  });
});
