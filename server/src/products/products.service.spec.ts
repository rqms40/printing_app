// server/src/products/products.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { ServiceCategory } from './entities/service-category.entity';
import { SpecOption } from './entities/spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';

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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: getRepositoryToken(ServiceCategory),
          useFactory: mockCatRepo,
        },
        { provide: getRepositoryToken(SpecOption), useFactory: mockOptRepo },
        {
          provide: getRepositoryToken(ServiceAddon),
          useFactory: mockAddonRepo,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
    catRepo = module.get(getRepositoryToken(ServiceCategory));
    optRepo = module.get(getRepositoryToken(SpecOption));
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
  });

  describe('createOption', () => {
    it('throws ConflictException if (categoryId, optionGroup, value) already exists', async () => {
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
        categoryId: 1,
        optionGroup: 'paper_size',
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
          categoryId: 1,
          optionGroup: 'paper_size',
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
        categoryId: 1,
        optionGroup: 'paper_size',
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
