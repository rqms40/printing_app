import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CATALOG_VERSION } from './catalog-v1-10.definition';
import { ProductCategory } from './entities/product-category.entity';

export type CatalogCategory = ProductCategory;

export interface CatalogGroup {
  slug: string;
  name: string;
  description: string;
  sortOrder: number;
  products: CatalogCategory[];
}

export interface CatalogResponse {
  version: typeof CATALOG_VERSION;
  groups: CatalogGroup[];
  categories: CatalogCategory[];
}

@Injectable()
export class CatalogReadService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  async getPublicCatalog(includeInactive = false): Promise<CatalogResponse> {
    const categories = await this.categoryRepo.find({
      relations: {
        specs: { options: true },
        addons: true,
      },
      order: {
        sortOrder: 'ASC',
        id: 'ASC',
        specs: {
          sortOrder: 'ASC',
          id: 'ASC',
          options: { sortOrder: 'ASC', id: 'ASC' },
        },
        addons: { sortOrder: 'ASC', id: 'ASC' },
      },
    });

    const publicCategories = categories
      .filter((category) => includeInactive || category.isActive)
      .map((category) => ({
        ...category,
        specs: (category.specs ?? [])
          .filter((spec) => includeInactive || spec.isActive)
          .map((spec) => ({
            ...spec,
            options: (spec.options ?? []).filter(
              (option) => includeInactive || option.isActive,
            ),
          })),
        addons: (category.addons ?? []).filter(
          (addon) => includeInactive || addon.isActive,
        ),
      }));

    const grouped = new Map<string, CatalogGroup>();
    for (const category of publicCategories) {
      if (
        !category.groupSlug ||
        !category.groupName ||
        !category.groupDescription ||
        category.groupSortOrder == null
      ) {
        continue;
      }
      const existing = grouped.get(category.groupSlug);
      if (existing) {
        existing.products.push(category);
        continue;
      }
      grouped.set(category.groupSlug, {
        slug: category.groupSlug,
        name: category.groupName,
        description: category.groupDescription,
        sortOrder: category.groupSortOrder,
        products: [category],
      });
    }

    const groups = [...grouped.values()]
      .map((group) => ({
        ...group,
        products: group.products.sort(
          (left, right) =>
            left.sortOrder - right.sortOrder || left.id - right.id,
        ),
      }))
      .sort(
        (left, right) =>
          left.sortOrder - right.sortOrder ||
          left.slug.localeCompare(right.slug),
      );

    return {
      version: CATALOG_VERSION,
      groups,
      categories: publicCategories,
    };
  }

  async getPublicCategoryBySlug(slug: string): Promise<CatalogCategory> {
    const catalog = await this.getPublicCatalog();
    const category = catalog.categories.find((entry) => entry.slug === slug);
    if (!category) {
      throw new NotFoundException(`Category '${slug}' is not available`);
    }
    return category;
  }
}
