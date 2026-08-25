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

  it('uses printer unit cost so UV is ₱90/sq.ft not the ₱40 eco-solvent base', async () => {
    readService.getPublicCatalog.mockResolvedValue({
      categories: [paperCategory, tarpCategory],
    });
    const eco = await service.quote({
      items: [
        {
          categorySlug: 'tarpaulins-event-banners',
          quantity: 1,
          specs: { printer: 'eco_solvent', size: '2x4' },
        },
      ],
    });
    const uv = await service.quote({
      items: [
        {
          categorySlug: 'tarpaulins-event-banners',
          quantity: 1,
          specs: { printer: 'uv_printer', size: '2x4' },
        },
      ],
    });
    expect(eco.subtotal).toBe(320);
    expect(uv.subtotal).toBe(720);
  });

  it('bills tarp sizes smaller than 2x4 at the 2x4 minimum charge', async () => {
    readService.getPublicCatalog.mockResolvedValue({
      categories: [paperCategory, tarpCategory],
    });
    const quote = await service.quote({
      items: [
        {
          categorySlug: 'tarpaulins-event-banners',
          quantity: 1,
          specs: { printer: 'eco_solvent', size: '1x4' },
        },
      ],
    });
    expect(quote.subtotal).toBe(320);
  });

  it('adds catalog add-ons to the print total', async () => {
    readService.getPublicCatalog.mockResolvedValue({
      categories: [paperCategory, tarpCategory],
    });
    const quote = await service.quote({
      items: [
        {
          categorySlug: 'tarpaulins-event-banners',
          quantity: 1,
          specs: { printer: 'eco_solvent', size: '2x4' },
          addonIds: [501],
        },
      ],
    });
    expect(quote.subtotal).toBe(345);
  });

  it('prices custom stickers at ₱63.50 eco-solvent and ₱162 UV per sq.ft', async () => {
    readService.getPublicCatalog.mockResolvedValue({
      categories: [paperCategory, stickerCategory],
    });
    const eco = await service.quote({
      items: [
        {
          categorySlug: 'stickers-vinyl',
          quantity: 1,
          specs: { printer: 'eco_solvent', size: '2x2' },
        },
      ],
    });
    const uv = await service.quote({
      items: [
        {
          categorySlug: 'stickers-vinyl',
          quantity: 1,
          specs: { printer: 'uv_printer', size: '2x2' },
        },
      ],
    });
    expect(eco.subtotal).toBe(254);
    expect(uv.subtotal).toBe(648);
  });
});

const tarpCategory = {
  ...paperCategory,
  id: 20,
  name: 'Event banners',
  slug: 'tarpaulins-event-banners',
  baseRate: 40,
  specs: [
    {
      id: 200,
      key: 'printer',
      label: 'Printer',
      helpText: null,
      inputType: InputType.SELECT,
      valueType: ValueType.STRING,
      isRequired: true,
      isActive: true,
      defaultValue: null,
      pricingRole: PricingRole.UNIT_COST,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 1,
      metadata: null,
      options: [
        {
          id: 201,
          label: 'Eco-solvent',
          value: 'eco_solvent',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 40,
          estimatedQuantity: null,
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          metadata: null,
        },
        {
          id: 202,
          label: 'UV Printer',
          value: 'uv_printer',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 90,
          estimatedQuantity: null,
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          metadata: null,
        },
      ],
    },
    {
      id: 210,
      key: 'size',
      label: 'Size',
      helpText: null,
      inputType: InputType.SELECT,
      valueType: ValueType.STRING,
      isRequired: true,
      isActive: true,
      defaultValue: null,
      pricingRole: PricingRole.ESTIMATED_QUANTITY,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 2,
      metadata: { minChargeArea: 8, maxDimensionFt: 5 },
      options: [
        {
          id: 211,
          label: '2x4',
          value: '2x4',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 0,
          estimatedQuantity: 8,
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          metadata: null,
        },
        {
          id: 212,
          label: '1x4',
          value: '1x4',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 0,
          estimatedQuantity: 4,
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          metadata: null,
        },
      ],
    },
  ],
  addons: [
    {
      id: 501,
      name: 'Lamination',
      price: 25,
      priceType: 'flat',
      isActive: true,
    },
  ],
};

const stickerCategory = {
  ...paperCategory,
  id: 30,
  name: 'Vinyl stickers',
  slug: 'stickers-vinyl',
  baseRate: 63.5,
  specs: [
    {
      id: 300,
      key: 'printer',
      label: 'Printer',
      helpText: null,
      inputType: InputType.SELECT,
      valueType: ValueType.STRING,
      isRequired: true,
      isActive: true,
      defaultValue: null,
      pricingRole: PricingRole.UNIT_COST,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 1,
      metadata: null,
      options: [
        {
          id: 301,
          label: 'Eco-solvent',
          value: 'eco_solvent',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 63.5,
          estimatedQuantity: null,
          isDefault: false,
          isActive: true,
          sortOrder: 1,
          metadata: null,
        },
        {
          id: 302,
          label: 'UV Printer',
          value: 'uv_printer',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 162,
          estimatedQuantity: null,
          isDefault: false,
          isActive: true,
          sortOrder: 2,
          metadata: null,
        },
      ],
    },
    {
      id: 310,
      key: 'size',
      label: 'Size',
      helpText: null,
      inputType: InputType.SELECT,
      valueType: ValueType.STRING,
      isRequired: true,
      isActive: true,
      defaultValue: null,
      pricingRole: PricingRole.ESTIMATED_QUANTITY,
      unitLabel: null,
      placeholder: null,
      minValue: null,
      maxValue: null,
      stepValue: null,
      sortOrder: 2,
      metadata: null,
      options: [
        {
          id: 311,
          label: '2x2',
          value: '2x2',
          multiplier: 1,
          fixedFee: 0,
          unitCost: 0,
          estimatedQuantity: 4,
          isDefault: true,
          isActive: true,
          sortOrder: 1,
          metadata: null,
        },
      ],
    },
  ],
  addons: [],
};
