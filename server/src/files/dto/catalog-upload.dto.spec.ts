import { validate } from 'class-validator';

import { CatalogUploadDto } from './catalog-upload.dto';

describe('CatalogUploadDto', () => {
  it('requires a leaf slug for catalog artwork', async () => {
    const dto = Object.assign(new CatalogUploadDto(), {
      purpose: 'catalog_artwork',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('productSlug');
  });

  it('accepts the catalog artwork form contract', async () => {
    const dto = Object.assign(new CatalogUploadDto(), {
      purpose: 'catalog_artwork',
      productSlug: '3d-printing-scale-models',
    });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it('preserves legacy uploads without a product slug', async () => {
    const dto = Object.assign(new CatalogUploadDto(), { purpose: 'general' });

    await expect(validate(dto)).resolves.toEqual([]);
  });

  it.each(['', ' Flyers ', 'marketing/promo'])(
    'rejects malformed product slug %j',
    async (productSlug) => {
      const dto = Object.assign(new CatalogUploadDto(), {
        purpose: 'catalog_artwork',
        productSlug,
      });

      const errors = await validate(dto);

      expect(errors.map((error) => error.property)).toContain('productSlug');
    },
  );
});
