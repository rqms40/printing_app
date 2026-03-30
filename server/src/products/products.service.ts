// server/src/products/products.service.ts
import {
  Injectable, ConflictException, BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, FindOptionsWhere } from 'typeorm';
import { ServiceCategory } from './entities/service-category.entity';
import { SpecOption } from './entities/spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { CreateSpecOptionDto } from './dto/create-spec-option.dto';
import type { UpdateSpecOptionDto } from './dto/update-spec-option.dto';
import type { ReorderOptionsDto } from './dto/reorder-options.dto';
import type { CreateAddonDto } from './dto/create-addon.dto';
import type { UpdateAddonDto } from './dto/update-addon.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ServiceCategory)
    private catRepo: Repository<ServiceCategory>,
    @InjectRepository(SpecOption)
    private optRepo: Repository<SpecOption>,
    @InjectRepository(ServiceAddon)
    private addonRepo: Repository<ServiceAddon>,
  ) {}

  // ─── Categories ──────────────────────────────────────────────────────

  findAllCategories(): Promise<ServiceCategory[]> {
    return this.catRepo.find({ where: { isActive: true }, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  findCategoryById(id: number): Promise<ServiceCategory> {
    return this.catRepo.findOneOrFail({
      where: { id },
      relations: ['specOptions', 'addons'],
    });
  }

  async getCategoryPricing(slug: string): Promise<Record<string, unknown>> {
    const category = await this.catRepo.findOneOrFail({ where: { slug } });
    const options = await this.optRepo.find({
      where: { categoryId: category.id, isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const addons = await this.addonRepo.find({
      where: [
        { categoryId: category.id, isActive: true },
        { categoryId: IsNull(), isActive: true },
      ],
      order: { sortOrder: 'ASC' },
    });

    const groups: Record<string, unknown[]> = {};
    for (const opt of options) {
      if (!groups[opt.optionGroup]) groups[opt.optionGroup] = [];
      groups[opt.optionGroup].push({
        id: opt.id,
        label: opt.label,
        value: opt.value,
        multiplier: Number(opt.multiplier),
        fixed_fee: Number(opt.fixedFee),
        unit_cost: Number(opt.unitCost),
        estimated_grams: opt.estimatedGrams,
        is_default: opt.isDefault,
        sort_order: opt.sortOrder,
      });
    }

    let allowedExtensions: string[];
    try {
      allowedExtensions = JSON.parse(category.allowedExtensions) as string[];
    } catch {
      allowedExtensions = [];
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      base_rate: Number(category.baseRate),
      max_file_size_mb: category.maxFileSizeMb,
      allowed_extensions: allowedExtensions,
      groups,
      addons,
    };
  }

  async createCategory(dto: CreateCategoryDto): Promise<ServiceCategory> {
    const existing = await this.catRepo.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Slug '${dto.slug}' is already in use`);
    const cat = this.catRepo.create(dto);
    return this.catRepo.save(cat);
  }

  async updateCategory(id: number, dto: UpdateCategoryDto): Promise<ServiceCategory> {
    await this.catRepo.findOneOrFail({ where: { id } });
    if (dto.slug) {
      const conflict = await this.catRepo.findOne({ where: { slug: dto.slug } });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Slug '${dto.slug}' is already in use`);
      }
    }
    await this.catRepo.update(id, dto);
    return this.catRepo.findOneOrFail({ where: { id } });
  }

  async deleteCategory(id: number): Promise<void> {
    await this.catRepo.findOneOrFail({ where: { id } });
    // Soft-delete: set isActive = false (orders reference category as a string slug, no FK)
    await this.catRepo.update(id, { isActive: false });
  }

  // ─── Spec Options ────────────────────────────────────────────────────

  findOptions(categoryId?: number, optionGroup?: string): Promise<SpecOption[]> {
    const where: FindOptionsWhere<SpecOption> = {};
    if (categoryId) where.categoryId = categoryId;
    if (optionGroup) where.optionGroup = optionGroup;
    return this.optRepo.find({ where, order: { optionGroup: 'ASC', sortOrder: 'ASC', id: 'ASC' } });
  }

  async createOption(dto: CreateSpecOptionDto): Promise<SpecOption> {
    const existing = await this.optRepo.findOne({
      where: { categoryId: dto.categoryId, optionGroup: dto.optionGroup, value: dto.value },
    });
    if (existing) {
      throw new ConflictException('A spec option with this category/group/value already exists');
    }
    if (dto.multiplier !== undefined && dto.multiplier <= 0) {
      throw new BadRequestException('multiplier must be greater than 0');
    }
    const opt = this.optRepo.create(dto);
    return this.optRepo.save(opt);
  }

  async updateOption(id: number, dto: UpdateSpecOptionDto): Promise<SpecOption> {
    const opt = await this.optRepo.findOneOrFail({ where: { id } });
    if (dto.multiplier !== undefined && dto.multiplier <= 0) {
      throw new BadRequestException('multiplier must be greater than 0');
    }
    if (dto.isActive === false && opt.isActive) {
      const activeCount = await this.optRepo.count({
        where: { categoryId: opt.categoryId, optionGroup: opt.optionGroup, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException('Cannot disable the last active option in a group');
      }
    }
    await this.optRepo.update(id, dto);
    return this.optRepo.findOneOrFail({ where: { id } });
  }

  async deleteOption(id: number): Promise<void> {
    const opt = await this.optRepo.findOneOrFail({ where: { id } });
    if (opt.isActive) {
      const activeCount = await this.optRepo.count({
        where: { categoryId: opt.categoryId, optionGroup: opt.optionGroup, isActive: true },
      });
      if (activeCount <= 1) {
        throw new BadRequestException('Cannot delete the last active option in a group');
      }
    }
    await this.optRepo.remove(opt);
  }

  async reorderOptions(dto: ReorderOptionsDto): Promise<void> {
    await Promise.all(
      dto.items.map((item) => this.optRepo.update(item.id, { sortOrder: item.sortOrder })),
    );
  }

  // ─── Addons ──────────────────────────────────────────────────────────

  findAddons(categoryId?: number): Promise<ServiceAddon[]> {
    if (categoryId) {
      return this.addonRepo.find({
        where: [{ categoryId }, { categoryId: IsNull() }],
        order: { sortOrder: 'ASC', id: 'ASC' },
      });
    }
    return this.addonRepo.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createAddon(dto: CreateAddonDto): Promise<ServiceAddon> {
    const addon = this.addonRepo.create(dto);
    return this.addonRepo.save(addon);
  }

  async updateAddon(id: number, dto: UpdateAddonDto): Promise<ServiceAddon> {
    await this.addonRepo.findOneOrFail({ where: { id } });
    await this.addonRepo.update(id, dto);
    return this.addonRepo.findOneOrFail({ where: { id } });
  }

  async deleteAddon(id: number): Promise<void> {
    const addon = await this.addonRepo.findOneOrFail({ where: { id } });
    await this.addonRepo.remove(addon);
  }
}
