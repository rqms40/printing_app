import {
  parseCatalogText,
  POLYMEDIA_CATALOG_TEXT,
  slugifyValue,
} from './supplier-catalog.parser';
import { evaluateSupplierCatalogFit } from './supplier-catalog.match';

describe('supplier catalog parser', () => {
  it('parses the Polymedia catalog into tarp and sticker products', () => {
    const parsed = parseCatalogText(POLYMEDIA_CATALOG_TEXT);
    expect(parsed.products.map((p) => p.title)).toEqual([
      'Tarpaulin & Signage Printing',
      'Custom Stickers',
      'Stickers with Sintra Boards',
    ]);

    const tarp = parsed.products[0];
    expect(tarp.categorySlugs).toContain('tarpaulins-event-banners');
    expect(tarp.baseRatePesos).toBe(40);
    expect(tarp.pricingUnit).toBe('sq_ft');
    const printer = tarp.specs.find((s) => s.key === 'printer');
    expect(printer?.pricingRole).toBe('unit_cost');
    expect(printer?.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(['eco_solvent', 'uv_printer']),
    );
    expect(
      printer?.options.find((o) => o.value === 'eco_solvent')?.unitCost,
    ).toBe(40);
    expect(
      printer?.options.find((o) => o.value === 'uv_printer')?.unitCost,
    ).toBe(90);
    const size = tarp.specs.find((s) => s.key === 'size');
    expect(size?.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(['2x4', '4x3', '5x5']),
    );
    expect(size?.options.find((o) => o.value === '2x4')?.estimatedQuantity).toBe(
      8,
    );
    expect(tarp.minChargeArea).toBe(8);
    expect(tarp.maxDimensionFt).toBe(5);
    expect(size?.options.find((o) => o.value === '1x4')?.estimatedQuantity).toBe(
      8,
    );
    expect(size?.options.find((o) => o.value === '6x3')?.outsourced).toBe(true);
    expect(tarp.specs[0].key).toBe('printer');

    const stickers = parsed.products[1];
    expect(stickers.addons.map((a) => a.name)).toEqual(
      expect.arrayContaining(['Lamination', 'Contour cutting']),
    );
    const stickerPrinter = stickers.specs.find((s) => s.key === 'printer');
    expect(
      stickerPrinter?.options.find((o) => o.value === 'eco_solvent')?.unitCost,
    ).toBe(63.5);
    expect(
      stickerPrinter?.options.find((o) => o.value === 'uv_printer')?.unitCost,
    ).toBe(162);
    const finish = stickers.specs.find((s) => s.key === 'finish');
    expect(finish?.options.map((o) => o.value)).toEqual(
      expect.arrayContaining(['matte', 'glossy', 'frosted']),
    );
    expect(
      finish?.options.find((o) => o.value === 'matte')?.compatiblePrinters,
    ).toEqual(['eco_solvent']);
    expect(
      finish?.options.find((o) => o.value === 'glossy')?.compatiblePrinters,
    ).toEqual(['uv_printer']);

    const sintra = parsed.products[2];
    expect(sintra.categorySlugs).toEqual(['stickers-sintra-boards']);
    expect(sintra.baseRatePesos).toBe(280);
    expect(
      sintra.specs.find((s) => s.key === 'board_thickness')?.options.map(
        (o) => o.value,
      ),
    ).toEqual(expect.arrayContaining(['3mm', '5mm']));
  });

  it('slugifies option labels', () => {
    expect(slugifyValue('Eco-solvent')).toBe('eco_solvent');
    expect(slugifyValue('2x4')).toBe('2x4');
  });
});

describe('supplier catalog match', () => {
  const offering = {
    isActive: true,
    categorySlugs: ['tarpaulins-event-banners'],
    specOptions: { printer: ['eco_solvent', 'uv_printer'], size: ['2x4', '4x3'] },
    addons: [] as Array<{ name: string; price: number; priceType: 'flat' }>,
  };

  it('matches when selected specs are in the offering', () => {
    const fit = evaluateSupplierCatalogFit(
      [offering],
      'tarpaulins-event-banners',
      [
        { key: 'printer', value: 'eco_solvent' },
        { key: 'size', value: '2x4' },
      ],
    );
    expect(fit.catalogMatch).toBe(true);
  });

  it('flags a catalog mismatch when a selected value is not offered', () => {
    const fit = evaluateSupplierCatalogFit(
      [offering],
      'tarpaulins-event-banners',
      [{ key: 'size', value: '8x8' }],
    );
    expect(fit.catalogMatch).toBe(false);
    expect(fit.missing).toContain('size:8x8');
  });

  it('leaves shops without an offering unconstrained', () => {
    const fit = evaluateSupplierCatalogFit(
      [offering],
      'flyers-single-sheets',
      [{ key: 'paper_size', value: 'a4' }],
    );
    expect(fit.catalogMatch).toBeNull();
  });
});
