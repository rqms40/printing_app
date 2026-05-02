import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ProductCategory } from './entities/product-category.entity';

export type CatalogCategory = ProductCategory;

@Injectable()
export class CatalogReadService {
  constructor(
    @InjectRepository(ProductCategory)
    private readonly categoryRepo: Repository<ProductCategory>,
  ) {}

  async getPublicCatalog(includeInactive = false): Promise<{
    categories: CatalogCategory[];
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

    return {
      categories: categories
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
        })),
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
