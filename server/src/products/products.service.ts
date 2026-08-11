import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  IsNull,
  Repository,
  type QueryDeepPartialEntity,
} from 'typeorm';

import { CatalogReadService } from './catalog-read.service';
import type { CreateAddonDto } from './dto/create-addon.dto';
import type { CreateCategoryDto } from './dto/create-category.dto';
import type { CreateSpecDefinitionDto } from './dto/create-spec-definition.dto';
import type { CreateSpecOptionDto } from './dto/create-spec-option.dto';
import type { CreateSpecOptionV2Dto } from './dto/create-spec-option-v2.dto';
import type { ReorderOptionsDto } from './dto/reorder-options.dto';
import type { UpdateAddonDto } from './dto/update-addon.dto';
import type { UpdateCategoryDto } from './dto/update-category.dto';
import type { UpdateSpecDefinitionDto } from './dto/update-spec-definition.dto';
import type { UpdateSpecOptionDto } from './dto/update-spec-option.dto';
import type { UpdateSpecOptionV2Dto } from './dto/update-spec-option-v2.dto';
import { ProductCategory } from './entities/product-category.entity';
import { ProductSpecDefinition } from './entities/product-spec-definition.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import {
  FileProcessingType,
  InputType,
  PricingModel,
  PricingRole,
  ValueType,
} from './enums/catalog.enums';

type CategoryInput = CreateCategoryDto | UpdateCategoryDto;

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly catRepo: Repository<ProductCategory>,
    @InjectRepository(ProductSpecDefinition)
    private readonly specRepo: Repository<ProductSpecDefinition>,
    @InjectRepository(ProductSpecOption)
    private readonly optRepo: Repository<ProductSpecOption>,
    @InjectRepository(ServiceAddon)
    private readonly addonRepo: Repository<ServiceAddon>,
    private readonly catalogReadService: CatalogReadService,
  ) {}

  getPublicCatalog() {
    return this.catalogReadService.getPublicCatalog();
  }

  // Categories

  findAllCategories(includeInactive = false): Promise<ProductCategory[]> {
    const where = includeInactive ? {} : { isActive: true };
    return this.catRepo.find({ where, order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  findCategoryById(id: number): Promise<ProductCategory> {
    return this.catRepo.findOneOrFail({
      where: { id },
      relations: { specs: { options: true }, addons: true },
    });
  }

  async getCategoryPricing(slug: string): Promise<Record<string, unknown>> {
    const category =
      await this.catalogReadService.getPublicCategoryBySlug(slug);
    const groups: Record<string, unknown[]> = {};
    for (const spec of category.specs ?? []) {
      groups[spec.key] = (spec.options ?? []).map((option) => ({
        id: option.id,
        label: option.label,
        value: option.value,
        multiplier: Number(option.multiplier),
        fixed_fee: Number(option.fixedFee),
        unit_cost: Number(option.unitCost),
        estimated_grams: option.estimatedQuantity,
        estimated_quantity: option.estimatedQuantity,
        is_default: option.isDefault,
        sort_order: option.sortOrder,
      }));
    }

    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      description: category.description,
      group_slug: category.groupSlug,
      group_name: category.groupName,
      group_description: category.groupDescription,
      group_sort_order: category.groupSortOrder,
      mobile_description: category.mobileDescription,
      examples: category.examples,
      icon: category.icon,
      file_processing_type: category.fileProcessingType,
      pricing_model: category.pricingModel,
      pricing_status:
        category.pricingModel === PricingModel.QUOTE_REQUIRED
          ? 'pending_quote'
          : undefined,
      base_rate:
        category.pricingModel === PricingModel.QUOTE_REQUIRED
          ? null
          : Number(category.baseRate),
      quantity_unit: category.quantityUnit,
      max_file_size_mb: category.maxFileSizeMb,
      allowed_extensions: category.allowedExtensions,
      specs: category.specs ?? [],
      groups,
      addons: category.addons ?? [],
    };
  }

  async createCategory(dto: CreateCategoryDto): Promise<ProductCategory> {
    const existing = await this.catRepo.findOne({ where: { slug: dto.slug } });
    if (existing) {
      throw new ConflictException(`Slug '${dto.slug}' is already in use`);
    }
    const normalized = this.normalizeCategoryDto(dto);
    this.validateCategoryConfiguration(normalized);
    const category = this.catRepo.create(normalized);
    return this.catRepo.save(category);
  }

  async updateCategory(
    id: number,
    dto: UpdateCategoryDto,
  ): Promise<ProductCategory> {
    const existing = await this.catRepo.findOneOrFail({ where: { id } });
    if (dto.slug) {
      const conflict = await this.catRepo.findOne({
        where: { slug: dto.slug },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(`Slug '${dto.slug}' is already in use`);
      }
    }
    const normalized = this.normalizeCategoryDto(dto, true);
    this.validateCategoryConfiguration({ ...existing, ...normalized });
    await this.catRepo.update(
      id,
      normalized as QueryDeepPartialEntity<ProductCategory>,
    );
    return this.catRepo.findOneOrFail({ where: { id } });
  }

  async deleteCategory(id: number): Promise<void> {
    await this.catRepo.findOneOrFail({ where: { id } });
    await this.catRepo.delete(id);
  }

  // Spec definitions

  findSpecDefinitions(categoryId?: number): Promise<ProductSpecDefinition[]> {
    const where: FindOptionsWhere<ProductSpecDefinition> = {};
    if (categoryId) where.categoryId = Number(categoryId);
    return this.specRepo.find({
      where,
      relations: { options: true, category: true },
      order: { categoryId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });
  }

  async createSpecDefinition(
    dto: CreateSpecDefinitionDto,
  ): Promise<ProductSpecDefinition> {
    const existing = await this.specRepo.findOne({
      where: { categoryId: dto.categoryId, key: dto.key },
    });
    if (existing) {
      throw new ConflictException(
        'A spec definition with this category/key already exists',
      );
    }
    const spec = this.specRepo.create({
      ...dto,
      pricingRole: dto.pricingRole ?? PricingRole.NONE,
      isRequired: dto.isRequired ?? true,
      isActive: dto.isActive ?? true,
    });
    return this.specRepo.save(spec);
  }

  async updateSpecDefinition(
    id: number,
    dto: UpdateSpecDefinitionDto,
  ): Promise<ProductSpecDefinition> {
    const spec = await this.specRepo.findOneOrFail({ where: { id } });
    if (dto.key || dto.categoryId) {
      const categoryId = dto.categoryId ?? spec.categoryId;
      const key = dto.key ?? spec.key;
      const conflict = await this.specRepo.findOne({
        where: { categoryId, key },
      });
      if (conflict && conflict.id !== id) {
        throw new ConflictException(
          'A spec definition with this category/key already exists',
        );
      }
    }
    await this.specRepo.update(
      id,
      dto as QueryDeepPartialEntity<ProductSpecDefinition>,
    );
    return this.specRepo.findOneOrFail({
      where: { id },
      relations: { options: true },
    });
  }

  async deleteSpecDefinition(id: number): Promise<void> {
    const spec = await this.specRepo.findOneOrFail({ where: { id } });
    await this.specRepo.delete(spec.id);
  }

  // Spec options

  findOptions(
    categoryId?: number,
    optionGroup?: string,
  ): Promise<ProductSpecOption[]> {
    const where: FindOptionsWhere<ProductSpecOption> = {};
    if (optionGroup || categoryId) {
      where.specDefinition = {};
      if (optionGroup) where.specDefinition.key = optionGroup;
      if (categoryId) where.specDefinition.categoryId = Number(categoryId);
    }
    return this.optRepo.find({
      where,
      relations: { specDefinition: true },
      order: {
        specDefinition: { key: 'ASC' },
        sortOrder: 'ASC',
        id: 'ASC',
      },
    });
  }

  async createOption(dto: CreateSpecOptionDto): Promise<ProductSpecOption> {
    const specDefinition = await this.findSpecForLegacyOption(dto);
    return this.createOptionV2({
      specDefinitionId: specDefinition.id,
      label: dto.label,
      value: dto.value,
      multiplier: dto.multiplier,
      fixedFee: dto.fixedFee,
      unitCost: dto.unitCost,
      estimatedQuantity: dto.estimatedGrams,
      isDefault: dto.isDefault,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });
  }

  async createOptionV2(dto: CreateSpecOptionV2Dto): Promise<ProductSpecOption> {
    const existing = await this.optRepo.findOne({
      where: {
        specDefinitionId: dto.specDefinitionId,
        value: dto.value,
      },
    });
    if (existing) {
      throw new ConflictException(
        'A spec option with this definition/value already exists',
      );
    }
    if (dto.multiplier !== undefined && dto.multiplier <= 0) {
      throw new BadRequestException('multiplier must be greater than 0');
    }
    const option = this.optRepo.create({
      ...dto,
      multiplier: dto.multiplier ?? 1,
      fixedFee: dto.fixedFee ?? 0,
      unitCost: dto.unitCost ?? 0,
      isDefault: dto.isDefault ?? false,
      isActive: dto.isActive ?? true,
    });
    return this.optRepo.save(option);
  }

  async updateOption(
    id: number,
    dto: UpdateSpecOptionDto,
  ): Promise<ProductSpecOption> {
    const option = await this.optRepo.findOneOrFail({
      where: { id },
      relations: { specDefinition: true },
    });
    const next: UpdateSpecOptionV2Dto = {
      label: dto.label,
      value: dto.value,
      multiplier: dto.multiplier,
      fixedFee: dto.fixedFee,
      unitCost: dto.unitCost,
      estimatedQuantity: dto.estimatedGrams,
      isDefault: dto.isDefault,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    };
    if (dto.optionGroup && dto.optionGroup !== option.specDefinition.key) {
      const spec = await this.findSpecForLegacyOption({
        categoryId: option.specDefinition.categoryId,
        optionGroup: dto.optionGroup,
        label: option.label,
        value: option.value,
      });
      next.specDefinitionId = spec.id;
    }
    return this.updateOptionV2(id, next);
  }

  async updateOptionV2(
    id: number,
    dto: UpdateSpecOptionV2Dto,
  ): Promise<ProductSpecOption> {
    const option = await this.optRepo.findOneOrFail({ where: { id } });
    if (dto.multiplier !== undefined && dto.multiplier <= 0) {
      throw new BadRequestException('multiplier must be greater than 0');
    }
    if (dto.isActive === false && option.isActive) {
      const activeCount = await this.optRepo.count({
        where: {
          specDefinitionId: option.specDefinitionId,
          isActive: true,
        },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Cannot disable the last active option in a spec',
        );
      }
    }
    await this.optRepo.update(
      id,
      dto as QueryDeepPartialEntity<ProductSpecOption>,
    );
    return this.optRepo.findOneOrFail({ where: { id } });
  }

  async deleteOption(id: number): Promise<void> {
    const option = await this.optRepo.findOneOrFail({ where: { id } });
    if (option.isActive) {
      const activeCount = await this.optRepo.count({
        where: {
          specDefinitionId: option.specDefinitionId,
          isActive: true,
        },
      });
      if (activeCount <= 1) {
        throw new BadRequestException(
          'Cannot delete the last active option in a spec',
        );
      }
    }
    await this.optRepo.remove(option);
  }

  async reorderOptions(dto: ReorderOptionsDto): Promise<void> {
    await Promise.all(
      dto.items.map((item) =>
        this.optRepo.update(item.id, { sortOrder: item.sortOrder }),
      ),
    );
  }

  // Addons

  findAddons(categoryId?: number): Promise<ServiceAddon[]> {
    if (categoryId) {
      return this.addonRepo.find({
        where: [{ categoryId: Number(categoryId) }, { categoryId: IsNull() }],
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

  private async findSpecForLegacyOption(
    dto: Pick<
      CreateSpecOptionDto,
      'categoryId' | 'optionGroup' | 'label' | 'value'
    >,
  ): Promise<ProductSpecDefinition> {
    let spec = await this.specRepo.findOne({
      where: { categoryId: dto.categoryId, key: dto.optionGroup },
    });
    if (!spec) {
      spec = this.specRepo.create({
        categoryId: dto.categoryId,
        key: dto.optionGroup,
        label: this.humanizeKey(dto.optionGroup),
        inputType: InputType.SELECT,
        valueType: ValueType.STRING,
        pricingRole: PricingRole.MULTIPLIER,
        isRequired: true,
        isActive: true,
      });
      spec = await this.specRepo.save(spec);
    }
    return spec;
  }

  private normalizeCategoryDto(
    dto: CategoryInput,
    partial = false,
  ): Partial<ProductCategory> {
    const allowedExtensions =
      dto.allowedExtensions == null
        ? undefined
        : this.normalizeAllowedExtensions(dto.allowedExtensions);
    const normalized: Partial<ProductCategory> = {
      ...dto,
      allowedExtensions,
      fileProcessingType:
        (dto as Partial<ProductCategory>).fileProcessingType ??
        (partial ? undefined : this.defaultFileProcessingType(dto.slug)),
      pricingModel:
        (dto as Partial<ProductCategory>).pricingModel ??
        (partial ? undefined : this.defaultPricingModel(dto.slug)),
      quantityUnit:
        (dto as Partial<ProductCategory>).quantityUnit ??
        (partial ? undefined : 'copy'),
    };
    if (!partial) return normalized;
    return Object.fromEntries(
      Object.entries(normalized).filter(([, value]) => value !== undefined),
    ) as Partial<ProductCategory>;
  }

  private validateCategoryConfiguration(
    category: Partial<ProductCategory>,
  ): void {
    const baseRate = Number(category.baseRate);
    if (!Number.isFinite(baseRate) || baseRate < 0) {
      throw new BadRequestException('baseRate must be at least 0');
    }
    if (
      category.pricingModel !== PricingModel.QUOTE_REQUIRED &&
      baseRate <= 0
    ) {
      throw new BadRequestException(
        'baseRate must be greater than 0 for numeric pricing models',
      );
    }

    const active = category.isActive ?? true;
    if (!active || category.pricingModel !== PricingModel.QUOTE_REQUIRED) {
      return;
    }
    const completeGroupMetadata =
      this.hasText(category.groupSlug) &&
      this.hasText(category.groupName) &&
      this.hasText(category.groupDescription) &&
      Number.isInteger(category.groupSortOrder);
    if (!completeGroupMetadata) {
      throw new BadRequestException({
        code: 'RFQ_GROUP_METADATA_REQUIRED',
        message:
          'Active quote-required products require complete group metadata',
      });
    }
  }

  private hasText(value: string | null | undefined): boolean {
    return typeof value === 'string' && value.trim().length > 0;
  }

  private normalizeAllowedExtensions(value: string | string[]): string[] {
    if (Array.isArray(value)) return value;
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      // fall through to comma splitting
    }
    return value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  private defaultFileProcessingType(slug?: string): FileProcessingType {
    if (slug === 'paper') return FileProcessingType.DOCUMENT;
    if (slug === '3d') return FileProcessingType.MODEL_3D;
    return FileProcessingType.GENERIC_FILE;
  }

  private defaultPricingModel(slug?: string): PricingModel {
    if (slug === '3d') return PricingModel.BASE_PLUS_MATERIAL_ESTIMATE;
    return PricingModel.PER_PAGE_MODIFIERS;
  }

  private humanizeKey(value: string): string {
    return value
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }
}
