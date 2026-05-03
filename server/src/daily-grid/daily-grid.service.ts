import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import {
  DailyGridCard,
  DailyGridSpecValues,
} from './entities/daily-grid-card.entity';
import { DailyGridGateway } from './daily-grid.gateway';
import {
  CatalogCategory,
  CatalogReadService,
} from '../products/catalog-read.service';
import {
  CatalogValidationService,
  SelectedSpec,
} from '../products/catalog-validation.service';

export interface DailyGridCardResponse extends DailyGridCard {
  categoryName: string | null;
  categorySlug: string;
  categoryIsActive: boolean;
  specs: DailyGridSpecValues | null;
  specDisplayValues: Record<string, string>;
  isCatalogValid: boolean;
  catalogIssue: string | null;
}

@Injectable()
export class DailyGridService {
  constructor(
    @InjectRepository(DailyGridCard)
    private readonly repo: Repository<DailyGridCard>,
    private readonly gateway: DailyGridGateway,
    private readonly catalogReadService: CatalogReadService,
    private readonly catalogValidationService: CatalogValidationService,
  ) {}

  async findActive(): Promise<DailyGridCardResponse[]> {
    const [cards, catalog] = await Promise.all([
      this.repo.find({
        where: { isActive: true },
        order: { sortOrder: 'ASC', id: 'ASC' },
      }),
      this.catalogReadService.getPublicCatalog(),
    ]);

    return cards.flatMap((card) => {
      const serialized = this.serializeCard(card, catalog.categories, {
        hideInvalid: true,
      });
      return serialized ? [serialized] : [];
    });
  }

  async findAll(): Promise<DailyGridCardResponse[]> {
    const [cards, catalog] = await Promise.all([
      this.repo.find({ order: { sortOrder: 'ASC', id: 'ASC' } }),
      this.catalogReadService.getPublicCatalog(true),
    ]);

    return cards.map(
      (card) =>
        this.serializeCard(card, catalog.categories, { hideInvalid: false })!,
    );
  }

  async findOne(id: number): Promise<DailyGridCard> {
    const card = await this.repo.findOne({ where: { id } });
    if (!card) throw new NotFoundException(`Daily grid card ${id} not found`);
    return card;
  }

  async create(dto: Partial<DailyGridCard>): Promise<DailyGridCardResponse> {
    const category = await this.catalogReadService.getPublicCategoryBySlug(
      dto.category ?? 'paper',
    );
    const { specs } = this.validateAndNormalizeSpecs(
      category,
      dto.specs ?? null,
    );
    const card = this.repo.create({
      title: dto.title,
      subtitle: dto.subtitle ?? null,
      imageUrl: dto.imageUrl ?? null,
      category: category.slug,
      sortOrder: dto.sortOrder ?? 0,
      isActive: dto.isActive ?? true,
      specs,
    });
    const saved = await this.repo.save(card);
    this.gateway.notifyUpdated();
    return this.serializeAdminCard(saved);
  }

  async update(
    id: number,
    dto: Partial<DailyGridCard>,
  ): Promise<DailyGridCardResponse> {
    const existing = await this.findOne(id);
    const patch: QueryDeepPartialEntity<DailyGridCard> = {};

    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.subtitle !== undefined) patch.subtitle = dto.subtitle;
    if (dto.imageUrl !== undefined) patch.imageUrl = dto.imageUrl;
    if (dto.sortOrder !== undefined) patch.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) patch.isActive = dto.isActive;

    const changesCatalogTarget =
      this.hasOwn(dto, 'category') || this.hasOwn(dto, 'specs');
    const enablingCard = dto.isActive === true && !existing.isActive;

    if (changesCatalogTarget || enablingCard) {
      const categorySlug = dto.category ?? existing.category;
      const category =
        await this.catalogReadService.getPublicCategoryBySlug(categorySlug);
      const rawSpecs = this.hasOwn(dto, 'specs')
        ? (dto.specs ?? null)
        : changesCatalogTarget
          ? null
          : existing.specs;
      const { specs } = this.validateAndNormalizeSpecs(category, rawSpecs);
      patch.category = category.slug;
      patch.specs = specs as QueryDeepPartialEntity<DailyGridSpecValues | null>;
    }

    await this.repo.update(id, patch);
    const updated = await this.findOne(id);
    this.gateway.notifyUpdated();
    return this.serializeAdminCard(updated);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
    this.gateway.notifyUpdated();
  }

  async reorder(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    await Promise.all(
      ids.map((id, index) => this.repo.update(id, { sortOrder: index })),
    );
    this.gateway.notifyUpdated();
  }

  private async serializeAdminCard(
    card: DailyGridCard,
  ): Promise<DailyGridCardResponse> {
    const catalog = await this.catalogReadService.getPublicCatalog(true);
    return this.serializeCard(card, catalog.categories, {
      hideInvalid: false,
    })!;
  }

  private serializeCard(
    card: DailyGridCard,
    categories: CatalogCategory[],
    options: { hideInvalid: boolean },
  ): DailyGridCardResponse | null {
    const category = categories.find((entry) => entry.slug === card.category);
    if (!category) {
      if (options.hideInvalid) return null;
      return this.responseFromCard(card, null, {
        specs: this.normalizeSpecObject(card.specs),
        displayValues: {},
        isCatalogValid: false,
        catalogIssue: `Category '${card.category}' is not available`,
      });
    }

    try {
      const selected = this.catalogValidationService.validatePartialSpecs(
        category,
        this.normalizeSpecObject(card.specs) ?? {},
      );
      const { specs, displayValues } = this.specsFromSelected(selected);
      return this.responseFromCard(card, category, {
        specs,
        displayValues,
        isCatalogValid: true,
        catalogIssue: null,
      });
    } catch (error) {
      if (options.hideInvalid) return null;
      return this.responseFromCard(card, category, {
        specs: this.normalizeSpecObject(card.specs),
        displayValues: {},
        isCatalogValid: false,
        catalogIssue:
          error instanceof Error ? error.message : 'Catalog validation failed',
      });
    }
  }

  private responseFromCard(
    card: DailyGridCard,
    category: CatalogCategory | null,
    state: {
      specs: DailyGridSpecValues | null;
      displayValues: Record<string, string>;
      isCatalogValid: boolean;
      catalogIssue: string | null;
    },
  ): DailyGridCardResponse {
    return {
      ...card,
      categoryName: category?.name ?? null,
      categorySlug: card.category,
      categoryIsActive: category?.isActive ?? false,
      specs: state.specs,
      specDisplayValues: state.displayValues,
      isCatalogValid: state.isCatalogValid,
      catalogIssue: state.catalogIssue,
    };
  }

  private validateAndNormalizeSpecs(
    category: CatalogCategory,
    rawSpecs: DailyGridSpecValues | null | undefined,
  ): {
    specs: DailyGridSpecValues | null;
    displayValues: Record<string, string>;
  } {
    const selected = this.catalogValidationService.validatePartialSpecs(
      category,
      this.normalizeSpecObject(rawSpecs) ?? {},
    );
    return this.specsFromSelected(selected);
  }

  private specsFromSelected(selected: SelectedSpec[]): {
    specs: DailyGridSpecValues | null;
    displayValues: Record<string, string>;
  } {
    const specs: DailyGridSpecValues = {};
    const displayValues: Record<string, string> = {};
    for (const entry of selected) {
      specs[entry.spec.key] = entry.value;
      if (entry.displayValue) {
        displayValues[entry.spec.key] = entry.displayValue;
      }
    }
    return {
      specs: Object.keys(specs).length > 0 ? specs : null,
      displayValues,
    };
  }

  private normalizeSpecObject(
    rawSpecs: DailyGridSpecValues | null | undefined,
  ): DailyGridSpecValues | null {
    if (!rawSpecs || typeof rawSpecs !== 'object' || Array.isArray(rawSpecs)) {
      return null;
    }
    const entries = Object.entries(rawSpecs).filter(
      ([, value]) => value !== undefined && value !== null && value !== '',
    );
    return entries.length > 0 ? Object.fromEntries(entries) : null;
  }

  private hasOwn<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
