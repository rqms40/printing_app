import { CATALOG_V1_10_GROUPS } from './catalog-v1-10.definition';
import { CatalogReadService } from './catalog-read.service';
import { ProductCategory } from './entities/product-category.entity';
import { ProductSpecOption } from './entities/product-spec-option.entity';
import { ServiceAddon } from './entities/service-addon.entity';
import { PricingModel } from './enums/catalog.enums';

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
    const persisted = persistedCatalog();
    const flyers = persisted[0];
    const activeOption = {
      id: 1001,
      specDefinitionId: flyers.specs[0].id,
      specDefinition: flyers.specs[0],
      label: 'A4',
      value: 'a4',
      multiplier: 1,
      fixedFee: 0,
      unitCost: 0,
      estimatedQuantity: null,
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      metadata: null,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    } as ProductSpecOption;
    flyers.specs[0].options = [
      activeOption,
      { ...activeOption, id: 1002, value: 'retired', isActive: false },
    ];
    flyers.specs.push({
      ...flyers.specs[0],
      id: 2001,
      key: 'retired_spec',
      isActive: false,
      options: [],
    });
    const activeAddon = {
      id: 3001,
      categoryId: flyers.id,
      category: flyers,
      name: 'Rush review',
      description: null,
      price: 25,
      priceType: 'flat',
      isActive: true,
      sortOrder: 1,
      createdAt: new Date('2026-08-10T00:00:00.000Z'),
      updatedAt: new Date('2026-08-10T00:00:00.000Z'),
    } as ServiceAddon;
    flyers.addons = [
      activeAddon,
      { ...activeAddon, id: 3002, name: 'Retired', isActive: false },
    ];
    const inactiveCategory = {
      ...flyers,
      id: 4001,
      slug: 'retired-flyers',
      isActive: false,
    };
    const categories = [inactiveCategory, ...persisted].reverse();
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
      pricingStatus: 'pending_quote',
      baseRate: null,
      quantityUnit: 'copy',
      maxFileSizeMb: 100,
    });
    const flatFlyers = catalog.categories.find(
      (category) => category.slug === 'flyers',
    );
    expect(flatFlyers).toMatchObject({
      pricingStatus: 'pending_quote',
      baseRate: null,
    });
    expect(catalog.groups[0].products[0]).toEqual(flatFlyers);
    expect(flatFlyers?.specs.map((spec) => spec.key)).not.toContain(
      'retired_spec',
    );
    expect(flatFlyers?.specs[0].options.map((option) => option.value)).toEqual([
      'a4',
    ]);
    expect(flatFlyers?.addons.map((addon) => addon.name)).toEqual([
      'Rush review',
    ]);
    expect(
      catalog.categories.some((category) => category.slug === 'retired-flyers'),
    ).toBe(false);

    // Existing clients keep receiving the same flat, filtered category list.
    expect(catalog.categories.map((category) => category.slug)).toEqual(
      categories
        .filter((category) => category.isActive)
        .map((category) => category.slug),
    );
  });

  it('preserves the exact public shape and rate of a numeric category', async () => {
    const paper = {
      ...persistedCatalog()[0],
      id: 5001,
      slug: 'paper',
      name: 'Paper Printing',
      pricingModel: PricingModel.PER_PAGE_MODIFIERS,
      baseRate: 2,
      groupSlug: null,
      groupName: null,
      groupDescription: null,
      groupSortOrder: null,
    };
    const categoryRepo = { find: jest.fn().mockResolvedValue([paper]) };
    const service = new CatalogReadService(categoryRepo as any);

    const catalog = await service.getPublicCatalog();

    expect(catalog.categories).toEqual([paper]);
    expect(catalog.categories[0]).not.toHaveProperty('pricingStatus');
    expect(catalog.categories[0].baseRate).toBe(2);
    expect(catalog.groups).toEqual([]);
  });
});
