import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductCategory } from './entities/product-category.entity';

export type CatalogCategory = ProductCategory;

export type CatalogCategoryNode = CatalogCategory & {
  children: CatalogCategoryNode[];
};

@Injectable()
export class CatalogReadService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  async getPublicCatalog(includeInactive = false): Promise<{
    /** Flat list (all levels) for lookup, admin, and mobile tree building. */
    categories: CatalogCategory[];
    /** Nested Category → Subgroup → Variant tree (roots only at top). */
    tree: CatalogCategoryNode[];
  }> {
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

    const mapped = categories
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

    return {
      categories: mapped,
      tree: this.buildTree(mapped),
    };
  }

  async getPublicCategoryBySlug(slug: string): Promise<CatalogCategory> {
    const catalog = await this.getPublicCatalog();
    const category = catalog.categories.find((entry) => entry.slug === slug);
    if (!category) {
      throw new NotFoundException(`Category '${slug}' is not available`);
    }
    if (!category.isOrderable) {
      throw new NotFoundException(
        `Category '${slug}' is a browse-only group, not an orderable product`,
      );
    }
    return category;
  }

  private buildTree(categories: CatalogCategory[]): CatalogCategoryNode[] {
    const byParent = new Map<number | null, CatalogCategory[]>();
    for (const category of categories) {
      const key = category.parentId ?? null;
      const bucket = byParent.get(key) ?? [];
      bucket.push(category);
      byParent.set(key, bucket);
    }

    const attach = (parentId: number | null): CatalogCategoryNode[] =>
      (byParent.get(parentId) ?? []).map((category) => ({
        ...category,
        children: attach(category.id),
      }));

    return attach(null);
  }
}

