import {
  CATALOG_VERSION,
  CATALOG_V1_10_GROUPS,
} from './catalog-v1-10.definition';

describe('v1.10 catalog definition', () => {
  it('defines four groups and seventeen unique RFQ products', () => {
    const products = CATALOG_V1_10_GROUPS.flatMap((group) => group.products);

    expect(CATALOG_V1_10_GROUPS.map((group) => group.slug)).toEqual([
      'marketing-promo',
      'corporate-merch',
      'awards-signages',
      'specialized-prototyping',
    ]);
    expect(CATALOG_VERSION).toBe('1.10');
    expect(
      CATALOG_V1_10_GROUPS.map((group) =>
        group.products.map((product) => product.slug),
      ),
    ).toEqual([
      [
        'flyers',
        'brochures',
        'posters-standees',
        'business-cards',
        'stickers-packaging-labels',
        'tarpaulins-outdoor-banners',
      ],
      [
        'lanyards-id-accessories',
        'custom-apparel',
        'drinkware',
        'corporate-giveaways',
      ],
      [
        'certificates-diplomas',
        'plaques-trophies',
        'medals-ribbons',
        'business-store-signages',
      ],
      [
        '3d-printing-scale-models',
        'blueprint-cad-plotting',
        'packaging-box-production',
      ],
    ]);
    expect(products).toHaveLength(17);
    expect(new Set(products.map((product) => product.slug)).size).toBe(17);
    expect(
      products.every((product) => product.pricingModel === 'quote_required'),
    ).toBe(true);
    expect(products.every((product) => product.specs.length > 0)).toBe(true);
    expect(
      products.every(
        (product) =>
          product.description.length > 0 &&
          product.examples.length > 0 &&
          product.quantityUnit.length > 0 &&
          product.allowedExtensions.length > 0,
      ),
    ).toBe(true);

    const model = products.find(
      (product) => product.slug === '3d-printing-scale-models',
    );
    expect(model?.maxFileSizeMb).toBe(200);
    expect(
      products
        .filter((product) => product !== model)
        .every((product) => product.maxFileSizeMb === 100),
    ).toBe(true);
  });
});
