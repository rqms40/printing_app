import { BadRequestException } from '@nestjs/common';

import { CatalogPricingService } from './catalog-pricing.service';
import { CatalogValidationService } from './catalog-validation.service';
import {
  FileProcessingType,
  InputType,
  PricingModel,
  PricingRole,
  ValueType,
} from './enums/catalog.enums';

const paperCategory = {
  id: 1,
  name: 'Paper Printing',
  slug: 'paper',
  description: 'Paper',
  mobileDescription: 'Paper',
  icon: 'FileTextOutlined',
  fileProcessingType: FileProcessingType.DOCUMENT,
  pricingModel: PricingModel.PER_PAGE_MODIFIERS,
  baseRate: 2,
  quantityUnit: 'copy',
  maxFileSizeMb: 50,
  allowedExtensions: ['pdf', 'tif', 'tiff'],
  isActive: true,
  sortOrder: 1,
  specs: [
    {
      id: 10,
      key: 'paper_size',
      label: 'Paper Size',
      helpText: null,
      inputType: InputType.SELECT,
      valueType: ValueType.STRING,
      isRequired: true,
      isActive: true,
      defaultValue: null,
      pricingRole: PricingRole.MULTIPLIER,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 1,
      metadata: null,
      options: [
        {
          id: 100,
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
        },
        {
          id: 101,
          label: 'A3',
          value: 'a3',
          multiplier: 1.5,
          fixedFee: 0,
          unitCost: 0,
          estimatedQuantity: null,
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          metadata: null,
        },
      ],
    },
    {
      id: 11,
      key: 'binding',
      label: 'Binding',
      helpText: null,
      inputType: InputType.SELECT,
      valueType: ValueType.STRING,
      isRequired: true,
      isActive: true,
      defaultValue: null,
      pricingRole: PricingRole.FIXED_FEE,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 2,
      metadata: null,
      options: [
        {
          id: 110,
          label: 'None',
          value: 'none',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 0,
          estimatedQuantity: null,
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          metadata: null,
        },
        {
          id: 111,
          label: 'Spiral',
          value: 'spiral',
          multiplier: 1,
          fixedFee: 25,
          unitCost: 0,
          estimatedQuantity: null,
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          metadata: null,
        },
      ],
    },
    {
      id: 12,
      key: 'page_count',
      label: 'Pages',
      helpText: null,
      inputType: InputType.NUMBER,
      valueType: ValueType.NUMBER,
      isRequired: true,
      isActive: true,
      defaultValue: '1',
      pricingRole: PricingRole.ESTIMATED_QUANTITY,
      unitLabel: 'pages',
      placeholder: null,
      minValue: 1,
      maxValue: 500,
      stepValue: 1,
      sortOrder: 3,
      metadata: null,
      options: [],
    },
  ],
  addons: [],
};

describe('CatalogPricingService', () => {
  const readService = {
    getPublicCatalog: jest.fn().mockResolvedValue({
      categories: [paperCategory],
    }),
  };
  const validation = new CatalogValidationService();
  const service = new CatalogPricingService(readService as any, validation);

  it('quotes paper from active catalog specs and snapshots selected values', async () => {
    const quote = await service.quote({
      items: [
        {
          categorySlug: 'paper',
          quantity: 2,
          specs: {
            paper_size: 'a3',
            binding: 'spiral',
            page_count: 3,
          },
          addonIds: [],
        },
      ],
    });

    expect(quote.subtotal).toBe(68);
    expect(quote.total).toBe(68);
    expect(quote.items[0].specSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          specKey: 'paper_size',
          value: 'a3',
          displayValue: 'A3',
          optionId: 101,
          multiplier: 1.5,
        }),
        expect.objectContaining({
          specKey: 'binding',
          value: 'spiral',
          fixedFee: 25,
        }),
      ]),
    );
  });

  it('rejects inactive or missing categories', async () => {
    await expect(
      service.quote({
        items: [{ categorySlug: 'unknown', quantity: 1, specs: {} }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
