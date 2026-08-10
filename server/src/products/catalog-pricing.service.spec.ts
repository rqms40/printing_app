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

const rfqCategory = {
  ...paperCategory,
  id: 2,
  name: 'Flyers',
  slug: 'flyers',
  pricingModel: PricingModel.QUOTE_REQUIRED,
  baseRate: 0,
};

const brochuresCategory = {
  ...rfqCategory,
  id: 3,
  name: 'Brochures',
  slug: 'brochures',
};

const validSpecs = {
  paper_size: 'a4',
  binding: 'none',
  page_count: 1,
};

const zeroMoneyPaths = (value: unknown, path = '$'): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      zeroMoneyPaths(entry, `${path}[${index}]`),
    );
  }
  if (value == null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const nextPath = `${path}.${key}`;
    const isMoneyField =
      /(amount|subtotal|total|fee|cost|rate|multiplier|estimatedQuantity)/i.test(
        key,
      );
    return [
      ...(isMoneyField && entry === 0 ? [nextPath] : []),
      ...zeroMoneyPaths(entry, nextPath),
    ];
  });
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

  it('returns a pending quote without fabricated money for quote-required products', async () => {
    readService.getPublicCatalog.mockResolvedValueOnce({
      categories: [rfqCategory],
    });

    const quote = await service.quote({
      items: [
        {
          categorySlug: 'flyers',
          quantity: 100,
          specs: validSpecs,
        },
      ],
    });

    expect(quote).toMatchObject({
      pricingStatus: 'pending_quote',
      subtotal: null,
      deliveryFee: null,
      serviceFee: null,
      total: null,
    });
    expect(quote.items[0]).toMatchObject({
      categorySlug: 'flyers',
      pricingModel: 'quote_required',
      quantity: 100,
      printSubtotal: null,
      pricingBreakdown: [],
    });
    expect(quote.items[0].specSnapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specKey: 'paper_size', value: 'a4' }),
      ]),
    );
    expect(quote.items[0].specSnapshots[0]).not.toHaveProperty('multiplier');
    expect(quote.items[0].specSnapshots[0]).not.toHaveProperty('fixedFee');
    expect(quote.items[0].specSnapshots[0]).not.toHaveProperty('unitCost');
    expect(quote.items[0].specSnapshots[0]).not.toHaveProperty(
      'estimatedQuantity',
    );
    expect(zeroMoneyPaths(quote)).toEqual([]);
  });

  it('validates required specs before returning a pending quote', async () => {
    readService.getPublicCatalog.mockResolvedValueOnce({
      categories: [rfqCategory],
    });

    await expect(
      service.quote({
        items: [
          {
            categorySlug: 'flyers',
            quantity: 100,
            specs: { binding: 'none', page_count: 1 },
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SPEC_REQUIRED',
        specKey: 'paper_size',
      }),
    });
  });

  it('returns a narrowly pending response for multiple RFQ products', async () => {
    readService.getPublicCatalog.mockResolvedValueOnce({
      categories: [rfqCategory, brochuresCategory],
    });

    const quote = await service.quote({
      items: [
        { categorySlug: 'flyers', quantity: 100, specs: validSpecs },
        { categorySlug: 'brochures', quantity: 25, specs: validSpecs },
      ],
    });

    expect(quote).toMatchObject({
      pricingStatus: 'pending_quote',
      subtotal: null,
      total: null,
    });
    expect(quote.items).toHaveLength(2);
    expect(
      quote.items.every(
        (item) =>
          item.pricingModel === PricingModel.QUOTE_REQUIRED &&
          item.printSubtotal === null,
      ),
    ).toBe(true);
    expect(zeroMoneyPaths(quote)).toEqual([]);
  });

  it('rejects mixed numeric and RFQ products with a stable code', async () => {
    readService.getPublicCatalog.mockResolvedValueOnce({
      categories: [paperCategory, rfqCategory],
    });

    await expect(
      service.quote({
        items: [
          { categorySlug: 'paper', quantity: 1, specs: validSpecs },
          { categorySlug: 'flyers', quantity: 100, specs: validSpecs },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'MIXED_PRICING_MODELS' }),
    });
  });

  it('validates every line before rejecting mixed pricing models', async () => {
    readService.getPublicCatalog.mockResolvedValueOnce({
      categories: [paperCategory, rfqCategory],
    });

    await expect(
      service.quote({
        items: [
          { categorySlug: 'flyers', quantity: 100, specs: validSpecs },
          {
            categorySlug: 'paper',
            quantity: 1,
            specs: { binding: 'none', page_count: 1 },
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'SPEC_REQUIRED',
        specKey: 'paper_size',
      }),
    });
  });

  it('preserves the exact legacy numeric quote shape without a pricing status', async () => {
    const quote = await service.quote({
      items: [
        {
          categorySlug: 'paper',
          quantity: 2,
          specs: { paper_size: 'a3', binding: 'spiral', page_count: 3 },
        },
      ],
    });

    expect(Object.keys(quote).sort()).toEqual([
      'deliveryFee',
      'items',
      'serviceFee',
      'subtotal',
      'total',
    ]);
    expect(quote).not.toHaveProperty('pricingStatus');
    expect(Object.keys(quote.items[0]).sort()).toEqual([
      'categoryId',
      'categoryName',
      'categorySlug',
      'pricingBreakdown',
      'pricingModel',
      'printSubtotal',
      'quantity',
      'specSnapshots',
    ]);
    expect(quote.items[0].printSubtotal).toBe(68);
    expect(quote.subtotal).toBe(68);
    expect(quote.total).toBe(68);
  });
});
