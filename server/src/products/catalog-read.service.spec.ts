import { CATALOG_V1_10_GROUPS } from './catalog-v1-10.definition';
import { CatalogReadService } from './catalog-read.service';
import { ProductCategory } from './entities/product-category.entity';

const persistedCatalog = (): ProductCategory[] => {
  let categoryId = 1;
  let specId = 1;

  return CATALOG_V1_10_GROUPS.flatMap((group) =>
    group.products.map((product) => {
      const id = categoryId++;
      return {
        id,
        name: product.name,
        slug: product.slug,
        description: product.description,
        groupSlug: group.slug,
        groupName: group.name,
        groupDescription: group.description,
        groupSortOrder: group.sortOrder,
        mobileDescription: product.mobileDescription,
        examples: [...product.examples],
        icon: null,
        fileProcessingType: product.fileProcessingType,
        pricingModel: product.pricingModel,
        baseRate: product.baseRate,
        quantityUnit: product.quantityUnit,
        maxFileSizeMb: product.maxFileSizeMb,
        allowedExtensions: [...product.allowedExtensions],
        isActive: product.isActive,
        sortOrder: product.sortOrder,
        specs: product.specs.map((spec) => ({
          id: specId++,
          categoryId: id,
          category: undefined as unknown as ProductCategory,
          key: spec.key,
          label: spec.label,
          helpText: spec.helpText ?? null,
          inputType: spec.inputType,
          valueType: spec.valueType,
          isRequired: spec.isRequired,
          isActive: true,
          defaultValue: spec.defaultValue ?? null,
          pricingRole: spec.pricingRole,
          unitLabel: spec.unitLabel ?? null,
          placeholder: spec.placeholder ?? null,
          minValue: spec.minValue ?? null,
          maxValue: spec.maxValue ?? null,
          stepValue: spec.stepValue ?? null,
          sortOrder: spec.sortOrder,
          metadata: null,
          options: [],
          createdAt: new Date('2026-08-10T00:00:00.000Z'),
          updatedAt: new Date('2026-08-10T00:00:00.000Z'),
        })),
        addons: [],
        createdAt: new Date('2026-08-10T00:00:00.000Z'),
        updatedAt: new Date('2026-08-10T00:00:00.000Z'),
      } as ProductCategory;
    }),
  );
};

describe('CatalogReadService', () => {
  it('returns the versioned four-group catalog in deterministic group and product order', async () => {
    const categories = persistedCatalog().reverse();
    const categoryRepo = { find: jest.fn().mockResolvedValue(categories) };
    const service = new CatalogReadService(categoryRepo as any);

    const catalog = await service.getPublicCatalog();

    expect(catalog.version).toBe('1.10');
    expect(catalog.groups.map((group) => group.slug)).toEqual([
      'marketing-promo',
      'corporate-merch',
      'awards-signages',
      'specialized-prototyping',
    ]);
    expect(catalog.groups.map((group) => group.sortOrder)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(catalog.groups[0]).toMatchObject({
      name: 'Marketing & Promotional Collateral',
      description:
        'Best for businesses, startups, and events looking to promote services or distribute physical marketing material.',
    });
    expect(catalog.groups.flatMap((group) => group.products)).toHaveLength(17);
    expect(catalog.groups[0].products.map((product) => product.slug)).toEqual([
      'flyers',
      'brochures',
      'posters-standees',
      'business-cards',
      'stickers-packaging-labels',
      'tarpaulins-outdoor-banners',
    ]);
    expect(catalog.groups[3].products.map((product) => product.slug)).toEqual([
      '3d-printing-scale-models',
      'blueprint-cad-plotting',
      'packaging-box-production',
    ]);
    expect(catalog.groups[0].products[0]).toMatchObject({
      slug: 'flyers',
      examples: ['Single sheets', 'Event promos', 'Product announcements'],
      pricingModel: 'quote_required',
      baseRate: 0,
      quantityUnit: 'copy',
      maxFileSizeMb: 100,
    });

    // Existing clients keep receiving the same flat, filtered category list.
    expect(catalog.categories.map((category) => category.slug)).toEqual(
      categories.map((category) => category.slug),
    );
  });
});
