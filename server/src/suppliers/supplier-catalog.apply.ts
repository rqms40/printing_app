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

async function upsertSpec(
  ds: DataSource,
  categoryId: number,
  key: string,
  label: string,
): Promise<number> {
  const existing = await ds.query<IdRow[]>(
    `SELECT id FROM product_spec_definitions
      WHERE category_id = $1 AND key = $2 LIMIT 1`,
    [categoryId, key],
  );
  if (existing[0]) return existing[0].id;
  const inserted = await ds.query<IdRow[]>(
    `INSERT INTO product_spec_definitions (
      category_id, key, label, input_type, value_type, is_required,
      is_active, pricing_role, sort_order
    ) VALUES ($1,$2,$3,'select','string',true,true,'none',80)
    RETURNING id`,
    [categoryId, key, label],
  );
  return inserted[0].id;
}

async function upsertOption(
  ds: DataSource,
  specId: number,
  option: { label: string; value: string; unitCost?: number; fixedFee?: number },
  sortOrder: number,
  isDefault: boolean,
): Promise<void> {
  await ds.query(
    `INSERT INTO product_spec_options (
      spec_definition_id, label, value, multiplier, fixed_fee, unit_cost,
      estimated_quantity, is_default, is_active, sort_order
    ) VALUES ($1,$2,$3,1,$4,$5,NULL,$6,true,$7)
    ON CONFLICT (spec_definition_id, value)
    DO UPDATE SET
      label = EXCLUDED.label,
      fixed_fee = CASE WHEN EXCLUDED.fixed_fee > 0 THEN EXCLUDED.fixed_fee ELSE product_spec_options.fixed_fee END,
      unit_cost = CASE WHEN EXCLUDED.unit_cost > 0 THEN EXCLUDED.unit_cost ELSE product_spec_options.unit_cost END`,
    [
      specId,
      option.label,
      option.value,
      option.fixedFee ?? 0,
      option.unitCost ?? 0,
      isDefault,
      sortOrder,
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
      const categoryId = await findCategoryId(ds, slug);
      if (categoryId == null) continue;
      categories.add(slug);
      await upsertCapability(ds, supplierId, slug);
      for (const spec of product.specs) {
        const specId = await upsertSpec(ds, categoryId, spec.key, spec.label);
        for (let i = 0; i < spec.options.length; i++) {
          await upsertOption(
            ds,
            specId,
            spec.options[i],
            (i + 1) * 10,
            i === 0,
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
