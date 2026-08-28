import JSZip from 'jszip';

export type ParsedCatalogOption = {
  label: string;
  value: string;
  unitCost?: number;
  fixedFee?: number;
  estimatedQuantity?: number;
  /** Printer values this option can be used with (eco_solvent, uv_printer). */
  compatiblePrinters?: string[];
  /** Size exceeds in-house max and cannot be selected. */
  outsourced?: boolean;
};

export type ParsedCatalogSpec = {
  key: string;
  label: string;
  /** How this spec should price: unit_cost, estimated_quantity, or none. */
  pricingRole?: 'none' | 'unit_cost' | 'estimated_quantity' | 'multiplier' | 'fixed_fee';
  options: ParsedCatalogOption[];
  metadata?: Record<string, unknown>;
};

export type ParsedCatalogAddon = {
  name: string;
  price: number;
  priceType: 'flat' | 'per_unit';
};

export type ParsedCatalogProduct = {
  title: string;
  categorySlugs: string[];
  specs: ParsedCatalogSpec[];
  addons: ParsedCatalogAddon[];
  notes: string[];
  baseRatePesos: number | null;
  pricingUnit: string | null;
  /** Smallest billed area in sq.ft (tarp minimum charge, e.g. 2x4 = 8). */
  minChargeArea?: number | null;
  /** In-house max of the longer side in feet (tarp/sticker max size). */
  maxDimensionFt?: number | null;
};

export type ParsedCatalog = {
  products: ParsedCatalogProduct[];
  warnings: string[];
};

const TARP_SLUGS = [
  'tarpaulins-event-banners',
  'tarpaulins-billboards',
  'tarpaulins-roadside-signs',
  'signage-acrylic-letters',
  'signage-panaflex-lightboxes',
  'signage-led-neon-flex',
];

const STICKER_SLUGS = [
  'stickers-die-cut-labels',
  'stickers-vinyl',
  'stickers-sheet',
];

const SINTRA_SLUGS = ['stickers-sintra-boards'];

export function slugifyValue(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/₱/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
}

function pesosFrom(text: string): number | null {
  const match = text.replace(/,/g, '').match(/₱\s*([0-9]+(?:\.[0-9]+)?)/);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) ? n : null;
}

function splitList(line: string): string[] {
  return line
    .split(/[,;/]| and /i)
    .map((part) =>
      part
        .replace(/\([^)]*\)/g, '')
        .replace(/^[–\-•]+\s*/, '')
        .trim(),
    )
    .filter((part) => part.length > 1 && !/^note:/i.test(part));
}

function mapCategorySlugs(title: string): string[] {
  const t = title.toLowerCase();
  if (/sintra/.test(t)) return [...SINTRA_SLUGS];
  if (/sticker/.test(t)) return [...STICKER_SLUGS];
  if (/tarp|signage/.test(t)) return [...TARP_SLUGS];
  return [];
}

function sectionHeading(line: string): string | null {
  const numbered = line.match(/^\d+\.\s+(.+)$/);
  if (numbered) return numbered[1].trim();
  return null;
}

function printersMentioned(line: string): string[] {
  const printers: string[] = [];
  if (/eco-?solvent/i.test(line)) printers.push('eco_solvent');
  if (/\buv\b/i.test(line)) printers.push('uv_printer');
  return printers;
}

function pushUniqueOption(
  spec: ParsedCatalogSpec,
  label: string,
  extra?: {
    unitCost?: number;
    fixedFee?: number;
    estimatedQuantity?: number;
    compatiblePrinters?: string[];
    outsourced?: boolean;
  },
) {
  const value = slugifyValue(label);
  if (!value) return;
  const existing = spec.options.find((o) => o.value === value);
  if (existing) {
    if (extra?.unitCost != null && extra.unitCost > 0) {
      existing.unitCost = extra.unitCost;
    }
    if (extra?.fixedFee != null && extra.fixedFee > 0) {
      existing.fixedFee = extra.fixedFee;
    }
    if (extra?.estimatedQuantity != null && extra.estimatedQuantity > 0) {
      existing.estimatedQuantity = extra.estimatedQuantity;
    }
    if (extra?.compatiblePrinters?.length) {
      const merged = new Set([
        ...(existing.compatiblePrinters ?? []),
        ...extra.compatiblePrinters,
      ]);
      existing.compatiblePrinters = [...merged];
    }
    if (extra?.outsourced) existing.outsourced = true;
    return;
  }
  spec.options.push({
    label: label.trim(),
    value,
    ...extra,
  });
}

function ensureSpec(
  product: ParsedCatalogProduct,
  key: string,
  label: string,
): ParsedCatalogSpec {
  let spec = product.specs.find((s) => s.key === key);
  if (!spec) {
    spec = { key, label, options: [] };
    product.specs.push(spec);
  }
  return spec;
}

function ingestLine(product: ParsedCatalogProduct, line: string) {
  const pesos = pesosFrom(line);
  if (/sq\.?\s*ft/i.test(line) && pesos != null && product.baseRatePesos == null) {
    product.baseRatePesos = pesos;
    product.pricingUnit = 'sq_ft';
  }

  if (/eco-?solvent/i.test(line) || /\buv printer\b/i.test(line) || /^uv\b/i.test(line)) {
    const spec = ensureSpec(product, 'printer', 'Printer');
    spec.pricingRole = 'unit_cost';
    if (/eco-?solvent/i.test(line)) {
      pushUniqueOption(spec, 'Eco-solvent', {
        unitCost: pesos ?? undefined,
      });
    }
    if (/\buv\b/i.test(line)) {
      pushUniqueOption(spec, 'UV Printer', {
        unitCost: pesos ?? undefined,
      });
    }
  }

  if (/regular tarpaulin/i.test(line) || /panaflex/i.test(line) || /blackout/i.test(line)) {
    const spec = ensureSpec(product, 'material', 'Material');
    if (/regular tarpaulin/i.test(line)) pushUniqueOption(spec, 'Regular Tarpaulin');
    if (/panaflex/i.test(line)) pushUniqueOption(spec, 'Panaflex');
    if (/blackout/i.test(line)) pushUniqueOption(spec, 'Blackout');
    const oz = line.match(/(\d+\s*oz)/gi) ?? [];
    if (oz.length) {
      const thick = ensureSpec(product, 'thickness', 'Thickness');
      for (const token of oz) {
        const normalized = token.replace(/\s+/g, '').toLowerCase();
        if (/not compatible/i.test(line) && /8oz/i.test(normalized)) {
          continue;
        }
        pushUniqueOption(thick, normalized);
      }
    }
  }

  if (/^\d+mm\b/i.test(line) || /board thickness/i.test(line)) {
    const thick = ensureSpec(product, 'board_thickness', 'Board Thickness');
    const mm = line.match(/(\d+)\s*mm/gi) ?? [];
    for (const token of mm) pushUniqueOption(thick, token.replace(/\s+/g, '').toLowerCase());
  }

  if (
    /matte|glossy|frosted|embossed|debossed/i.test(line) &&
    !/tarpaulin/i.test(line)
  ) {
    const finish = ensureSpec(product, 'finish', 'Finish');
    const printers = printersMentioned(line);
    for (const token of [
      'Matte',
      'Glossy',
      'Frosted',
      'White',
      'Embossed & Debossed',
    ]) {
      if (
        new RegExp(token.replace(/&/g, '&'), 'i').test(line) ||
        line.toLowerCase().includes(token.toLowerCase())
      ) {
        pushUniqueOption(finish, token, {
          compatiblePrinters: printers.length ? printers : undefined,
        });
      }
    }
    if (/white \(uv/i.test(line) || /^white\b/i.test(line)) {
      pushUniqueOption(finish, 'White');
    }
  }

  if (/minimum charge/i.test(line)) {
    const charged = line.match(/(\d+)\s*x\s*(\d+)/i);
    if (charged) {
      product.minChargeArea = Number(charged[1]) * Number(charged[2]);
    }
  }
  if (/maximum size/i.test(line)) {
    const above = line.match(/above\s+(\d+)\s*(?:feet|ft)/i);
    if (above) product.maxDimensionFt = Number(above[1]);
  }

  if (
    /standard sizes/i.test(line) ||
    /minimum size/i.test(line) ||
    /maximum size/i.test(line) ||
    /^\d+x\d+\b/i.test(line)
  ) {
    const size = ensureSpec(product, 'size', 'Size');
    size.pricingRole = 'estimated_quantity';
    const withoutParens = line.replace(/\([^)]*\)/g, ' ');
    const sizes = withoutParens.match(/\d+\s*x\s*\d+/gi) ?? [];
    for (const token of sizes) {
      const parts = token.toLowerCase().replace(/\s+/g, '').split('x');
      const width = Number(parts[0]);
      const height = Number(parts[1]);
      const area =
        Number.isFinite(width) && Number.isFinite(height)
          ? width * height
          : undefined;
      pushUniqueOption(size, `${parts[0]}x${parts[1]}`, {
        estimatedQuantity: area,
      });
    }
  }

  if (/laminat/i.test(line) || /contour cut/i.test(line) || /back-to-back/i.test(line) || /\bstand\b/i.test(line)) {
    if (/laminat/i.test(line) && pesos != null) {
      product.addons.push({
        name: 'Lamination',
        price: pesos,
        priceType: 'flat',
      });
    }
    if (/contour cut/i.test(line) && pesos != null) {
      product.addons.push({
        name: 'Contour cutting',
        price: pesos,
        priceType: 'flat',
      });
    }
    if (/back-to-back/i.test(line) && pesos != null) {
      product.addons.push({
        name: 'Back-to-back printing',
        price: pesos,
        priceType: 'per_unit',
      });
    }
    if (/\bstand\b/i.test(line) && /free/i.test(line)) {
      product.addons.push({
        name: 'Stand',
        price: 0,
        priceType: 'flat',
      });
    }
  }

  if (
    /minimum|maximum|cannot be catered|file requirements|accepted formats/i.test(
      line,
    )
  ) {
    product.notes.push(line);
  }
}

export function parseCatalogText(raw: string): ParsedCatalog {
  const warnings: string[] = [];
  const text = raw.replace(/\r\n/g, '\n').replace(/\u00a0/g, ' ').trim();
  if (!text) {
    return { products: [], warnings: ['Catalog file was empty'] };
  }

  const lines = text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  const products: ParsedCatalogProduct[] = [];
  let current: ParsedCatalogProduct | null = null;

  const startProduct = (title: string) => {
    current = {
      title,
      categorySlugs: mapCategorySlugs(title),
      specs: [],
      addons: [],
      notes: [],
      baseRatePesos: null,
      pricingUnit: null,
      minChargeArea: null,
      maxDimensionFt: null,
    };
    if (current.categorySlugs.length === 0) {
      warnings.push(`No GRIDGO category mapping for "${title}"`);
    }
    products.push(current);
  };

  for (const line of lines) {
    const heading = sectionHeading(line);
    if (heading) {
      startProduct(heading);
      continue;
    }
    if (!current) continue;
    ingestLine(current, line);
  }

  if (products.length === 0) {
    // Fallback: treat the whole document as one untitled product.
    startProduct('Imported catalog');
    for (const line of lines) ingestLine(products[0], line);
    warnings.push('No numbered sections found; imported as a single product');
  }

  for (const product of products) {
    const seen = new Set<string>();
    product.addons = product.addons.filter((addon) => {
      const key = addon.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    finalizeSizePolicy(product);
    product.specs.sort((a, b) => {
      if (a.key === 'printer') return -1;
      if (b.key === 'printer') return 1;
      return 0;
    });
  }

  return { products, warnings };
}

function finalizeSizePolicy(product: ParsedCatalogProduct) {
  const size = product.specs.find((spec) => spec.key === 'size');
  if (!size) return;
  const minCharge = product.minChargeArea ?? 0;
  const maxDim = product.maxDimensionFt ?? 0;
  size.metadata = {
    ...(size.metadata ?? {}),
    ...(minCharge > 0 ? { minChargeArea: minCharge } : {}),
    ...(maxDim > 0 ? { maxDimensionFt: maxDim } : {}),
  };
  for (const option of size.options) {
    const parts = option.value.toLowerCase().split('x');
    const width = Number(parts[0]);
    const height = Number(parts[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) continue;
    const rawArea = width * height;
    if (maxDim > 0 && Math.max(width, height) > maxDim) {
      option.outsourced = true;
    }
    if (minCharge > 0 && rawArea < minCharge) {
      option.estimatedQuantity = minCharge;
    } else if (option.estimatedQuantity == null) {
      option.estimatedQuantity = rawArea;
    }
  }
}

export async function extractCatalogText(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.docx')) return extractDocxText(buffer);
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    return extractXlsxText(buffer);
  }
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.md')) {
    return buffer.toString('utf8');
  }
  if (lower.endsWith('.pdf')) return extractPdfLooseText(buffer);
  return buffer.toString('utf8');
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('Not a valid .docx catalog (missing document.xml)');
  return xml
    .replace(/<w:tab\b[^/]*\/>/g, ' ')
    .replace(/<w:br\b[^/]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:t[^>]*>/g, '')
    .replace(/<\/w:t>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x2019;/g, "'")
    .replace(/&#x201C;|&#x201D;/g, '"');
}

async function extractXlsxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const shared = await zip.file('xl/sharedStrings.xml')?.async('string');
  const strings: string[] = [];
  if (shared) {
    const re = /<t[^>]*>([^<]*)<\/t>/g;
    let match: RegExpExecArray | null;
    while ((match = re.exec(shared))) {
      strings.push(match[1]);
    }
  }
  const sheet =
    (await zip.file('xl/worksheets/sheet1.xml')?.async('string')) ?? '';
  const rows: string[] = [];
  const rowRe = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch: RegExpExecArray | null;
  while ((rowMatch = rowRe.exec(sheet))) {
    const cells: string[] = [];
    const cellRe = /<c\b([^>]*)>([\s\S]*?)<\/c>/g;
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowMatch[1]))) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const v = body.match(/<v>([^<]*)<\/v>/)?.[1] ?? '';
      if (/\bt="s"/.test(attrs)) {
        const idx = Number(v);
        cells.push(strings[idx] ?? v);
      } else {
        cells.push(v);
      }
    }
    const line = cells.map((c) => c.trim()).filter(Boolean).join(' ');
    if (line) rows.push(line);
  }
  if (rows.length === 0 && strings.length) return strings.join('\n');
  return rows.join('\n');
}

function extractPdfLooseText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const chunks = raw.match(/[\x20-\x7E]{4,}/g) ?? [];
  return chunks.join('\n');
}

/** Built-in Polymedia Printing Services catalog (from their .docx). */
export const POLYMEDIA_CATALOG_TEXT = `Polymedia Printing Services Catalog
File Requirements for All Orders Accepted formats: PDF, Canva Link, PSD, CorelDRAW
1. Tarpaulin & Signage Printing
Printer Options & Base Pricing
Eco-solvent.
UV Printer (Premium).
Material Types & Thickness
Regular Tarpaulin: 10oz, 13oz, 18oz
Panaflex (for signages): 13oz, 18oz
Blackout (for signages): 13oz, 18oz (Note: 8oz is not compatible with UV and eco-solvent printers)
Size Policies
Standard sizes: 1x4, 2x4, 4x3, 2x3, 6x3, 5x5
Minimum charge: 2x4 (Orders smaller than 2x4, such as 1x4, are charged at the 2x4 rate to account for material waste).
Maximum size: Sizes above 5 feet cannot be catered in-house and will be outsourced.
2. Custom Stickers
Printer Options & Base Pricing (Fixed amount per sq. ft.)
Eco-solvent printer: ₱63.50 / sq. ft.
UV Printer: ₱162.00 / sq. ft.
Textures & Finishes
Matte (Eco-solvent printer)
Glossy (UV printer)
Frosted (UV printer)
White (UV printer)
Embossed & Debossed (UV printer only)
Dimensions
Minimum size: 2x2 feet
Standard sizes: 1x4 feet (12x48 inches)
Maximum size: 5x5 feet
Available Add-ons
Lamination: +₱25.00
Contour cutting: +₱15.00
3. Stickers with Sintra Boards
Base Pricing
Single-sided (front sticker only): ₱280.00 / sq. ft.
Board Thickness Options
3mm
5mm
Available Add-ons
Back-to-back printing: +₱200.00 / sq. ft.
Stand / No stand: Free of charge
`;
