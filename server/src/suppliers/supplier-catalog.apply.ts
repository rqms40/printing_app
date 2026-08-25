import { DataSource } from 'typeorm';
import type { ParsedCatalogProduct } from './supplier-catalog.parser';

type IdRow = { id: number };

async function findCategoryId(
  ds: DataSource,
  slug: string,
): Promise<number | null> {
  const rows = await ds.query<IdRow[]>(
    `SELECT id FROM product_categories WHERE slug = $1 LIMIT 1`,
    [slug],
  );
  return rows[0]?.id ?? null;
}

const CATEGORY_PARENT: Record<
  string,
  { parentSlug: string; name: string; description: string }
> = {
  'stickers-sintra-boards': {
    parentSlug: 'stickers-labels',
    name: 'Stickers with Sintra Boards',
    description: 'Sticker prints mounted on Sintra board for rigid displays.',
  },
};

async function ensureCategory(
  ds: DataSource,
  slug: string,
  product: ParsedCatalogProduct,
): Promise<number | null> {
  const existing = await findCategoryId(ds, slug);
  if (existing != null) {
    if (product.baseRatePesos != null && product.baseRatePesos > 0) {
      await ds.query(
        `UPDATE product_categories
            SET name = COALESCE(NULLIF($1, ''), name),
                base_rate = $2,
                quantity_unit = COALESCE($3, quantity_unit),
                is_orderable = true,
                is_active = true
          WHERE id = $4`,
        [
          product.title.slice(0, 100),
          product.baseRatePesos,
          product.pricingUnit,
          existing,
        ],
      );
    }
    return existing;
  }

  const meta = CATEGORY_PARENT[slug];
  if (!meta) return null;
  const parentId = await findCategoryId(ds, meta.parentSlug);
  if (parentId == null) return null;

  const inserted = await ds.query<IdRow[]>(
    `INSERT INTO product_categories (
      name, slug, description, mobile_description, audience_label, icon,
      parent_id, catalog_level, is_orderable,
      file_processing_type, pricing_model, base_rate, quantity_unit,
      max_file_size_mb, allowed_extensions, is_active, sort_order
    ) VALUES (
      $1,$2,$3,$4,NULL,NULL,$5,3,true,
      'generic_file','per_page_modifiers',$6,$7,
      50,'["pdf","png","jpg","jpeg","ai","psd","svg"]'::jsonb,true,40
    )
    ON CONFLICT (slug) DO UPDATE SET
      name = EXCLUDED.name,
      base_rate = EXCLUDED.base_rate,
      quantity_unit = EXCLUDED.quantity_unit,
      is_orderable = true,
      is_active = true
    RETURNING id`,
    [
      (product.title || meta.name).slice(0, 100),
      slug,
      meta.description,
      meta.description.slice(0, 160),
      parentId,
      product.baseRatePesos ?? 0,
      product.pricingUnit ?? 'sq_ft',
    ],
  );
  return inserted[0]?.id ?? null;
}

function specSortOrder(key: string): number {
  if (key === 'printer') return 5;
  if (key === 'size') return 20;
  if (key === 'finish') return 30;
  return 80;
}

async function upsertSpec(
  ds: DataSource,
  categoryId: number,
  key: string,
  label: string,
  pricingRole: string,
  metadata?: Record<string, unknown>,
): Promise<number> {
  const sortOrder = specSortOrder(key);
  const existing = await ds.query<(IdRow & { pricing_role?: string })[]>(
    `SELECT id, pricing_role FROM product_spec_definitions
      WHERE category_id = $1 AND key = $2 LIMIT 1`,
    [categoryId, key],
  );
  if (existing[0]) {
    const current = String(existing[0].pricing_role ?? 'none');
    if (
      pricingRole !== 'none' &&
      (current === 'none' || current === pricingRole)
    ) {
      await ds.query(
        `UPDATE product_spec_definitions
            SET pricing_role = $1, label = $2, sort_order = $3,
                metadata = COALESCE($4::jsonb, metadata)
          WHERE id = $5`,
        [
          pricingRole,
          label,
          sortOrder,
          metadata ? JSON.stringify(metadata) : null,
          existing[0].id,
        ],
      );
    } else {
      await ds.query(
        `UPDATE product_spec_definitions
            SET sort_order = $1,
                metadata = COALESCE($2::jsonb, metadata)
          WHERE id = $3`,
        [sortOrder, metadata ? JSON.stringify(metadata) : null, existing[0].id],
      );
    }
    return existing[0].id;
  }
  const inserted = await ds.query<IdRow[]>(
    `INSERT INTO product_spec_definitions (
      category_id, key, label, input_type, value_type, is_required,
      is_active, pricing_role, sort_order, metadata
    ) VALUES ($1,$2,$3,'select','string',true,true,$4,$5,$6::jsonb)
    RETURNING id`,
    [
      categoryId,
      key,
      label,
      pricingRole,
      sortOrder,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
  return inserted[0].id;
}

async function upsertOption(
  ds: DataSource,
  specId: number,
  option: {
    label: string;
    value: string;
    unitCost?: number;
    fixedFee?: number;
    estimatedQuantity?: number;
    compatiblePrinters?: string[];
    outsourced?: boolean;
  },
  sortOrder: number,
  isDefault: boolean,
): Promise<void> {
  const metadata: Record<string, unknown> = {};
  if (option.compatiblePrinters?.length) {
    metadata.compatiblePrinters = option.compatiblePrinters;
  }
  if (option.outsourced) metadata.outsourced = true;
  const metadataJson =
    Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
  await ds.query(
    `INSERT INTO product_spec_options (
      spec_definition_id, label, value, multiplier, fixed_fee, unit_cost,
      estimated_quantity, is_default, is_active, sort_order, metadata
    ) VALUES ($1,$2,$3,1,$4,$5,$6,$7,true,$8,$9::jsonb)
    ON CONFLICT (spec_definition_id, value)
    DO UPDATE SET
      label = EXCLUDED.label,
      is_default = EXCLUDED.is_default,
      fixed_fee = CASE WHEN EXCLUDED.fixed_fee > 0 THEN EXCLUDED.fixed_fee ELSE product_spec_options.fixed_fee END,
      unit_cost = CASE WHEN EXCLUDED.unit_cost > 0 THEN EXCLUDED.unit_cost ELSE product_spec_options.unit_cost END,
      estimated_quantity = COALESCE(EXCLUDED.estimated_quantity, product_spec_options.estimated_quantity),
      metadata = CASE
        WHEN EXCLUDED.metadata IS NULL THEN product_spec_options.metadata
        WHEN product_spec_options.metadata IS NULL THEN EXCLUDED.metadata
        ELSE product_spec_options.metadata || EXCLUDED.metadata
      END`,
    [
      specId,
      option.label,
      option.value,
      option.fixedFee ?? 0,
      option.unitCost ?? 0,
      option.estimatedQuantity ?? null,
      isDefault,
      sortOrder,
      metadataJson,
    ],
  );
}

async function upsertAddon(
  ds: DataSource,
  categoryId: number,
  addon: { name: string; price: number; priceType: 'flat' | 'per_unit' },
): Promise<void> {
  const existing = await ds.query<IdRow[]>(
    `SELECT id FROM service_addons WHERE category_id = $1 AND name = $2 LIMIT 1`,
    [categoryId, addon.name],
  );
  if (existing[0]) {
    await ds.query(
      `UPDATE service_addons SET price = $1, price_type = $2, is_active = true
        WHERE id = $3`,
      [addon.price, addon.priceType, existing[0].id],
    );
    return;
  }
  await ds.query(
    `INSERT INTO service_addons (
      category_id, name, description, price, price_type, is_active, sort_order
    ) VALUES ($1,$2,$3,$4,$5,true,80)`,
    [
      categoryId,
      addon.name,
      `Imported from supplier catalog`,
      addon.price,
      addon.priceType,
    ],
  );
}

async function upsertCapability(
  ds: DataSource,
  supplierId: number,
  productFamily: string,
): Promise<void> {
  const existing = await ds.query<IdRow[]>(
    `SELECT id FROM supplier_capabilities
      WHERE supplier_id = $1 AND product_family = $2 LIMIT 1`,
    [supplierId, productFamily],
  );
  if (existing[0]) return;
  await ds.query(
    `INSERT INTO supplier_capabilities (
      supplier_id, product_family, materials, max_capacity, lead_time_days
    ) VALUES ($1,$2,'[]'::jsonb,40,3)`,
    [supplierId, productFamily],
  );
}

export async function applyParsedCatalogProducts(
  ds: DataSource,
  supplierId: number,
  products: ParsedCatalogProduct[],
  source: { kind: 'manual' | 'import'; fileName?: string | null },
): Promise<{ offerings: number; specsAdded: number; categories: string[] }> {
  let specsAdded = 0;
  const categories = new Set<string>();

  for (const product of products) {
    const slugs = product.categorySlugs.filter(Boolean);
    for (const slug of slugs) {
      const categoryId = await ensureCategory(ds, slug, product);
      if (categoryId == null) continue;
      categories.add(slug);
      await upsertCapability(ds, supplierId, slug);
      for (const spec of product.specs) {
        const specId = await upsertSpec(
          ds,
          categoryId,
          spec.key,
          spec.label,
          spec.pricingRole ??
            (spec.options.some((o) => (o.unitCost ?? 0) > 0)
              ? 'unit_cost'
              : spec.options.some((o) => (o.estimatedQuantity ?? 0) > 0)
                ? 'estimated_quantity'
                : 'none'),
          spec.metadata,
        );
        for (let i = 0; i < spec.options.length; i++) {
          await upsertOption(
            ds,
            specId,
            spec.options[i],
            (i + 1) * 10,
            spec.key === 'printer' ? false : i === 0,
          );
          specsAdded += 1;
        }
      }
      for (const addon of product.addons) {
        await upsertAddon(ds, categoryId, addon);
      }
    }

    const specOptions: Record<string, string[]> = {};
    for (const spec of product.specs) {
      specOptions[spec.key] = spec.options.map((o) => o.value);
    }

    await ds.query(
      `INSERT INTO supplier_catalog_offerings (
        supplier_id, title, category_slugs, spec_options, addons, notes,
        base_rate_pesos, pricing_unit, source, source_file_name, is_active
      ) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,true)
      ON CONFLICT (supplier_id, title)
      DO UPDATE SET
        category_slugs = EXCLUDED.category_slugs,
        spec_options = EXCLUDED.spec_options,
        addons = EXCLUDED.addons,
        notes = EXCLUDED.notes,
        base_rate_pesos = EXCLUDED.base_rate_pesos,
        pricing_unit = EXCLUDED.pricing_unit,
        source = EXCLUDED.source,
        source_file_name = EXCLUDED.source_file_name,
        is_active = true,
        updated_at = now()`,
      [
        supplierId,
        product.title.slice(0, 160),
        JSON.stringify(slugs),
        JSON.stringify(specOptions),
        JSON.stringify(product.addons),
        JSON.stringify(product.notes),
        product.baseRatePesos,
        product.pricingUnit,
        source.kind,
        source.fileName ?? null,
      ],
    );
  }

  return {
    offerings: products.length,
    specsAdded,
    categories: [...categories],
  };
}
