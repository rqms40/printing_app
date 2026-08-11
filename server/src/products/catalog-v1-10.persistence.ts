import { CATALOG_V1_10_GROUPS } from './catalog-v1-10.definition';

export interface CatalogSqlExecutor {
  query<T = unknown>(sql: string, parameters?: unknown[]): Promise<T>;
}

type CatalogSpec = Readonly<{
  key: string;
  label: string;
  helpText?: string | null;
  inputType: string;
  valueType: string;
  isRequired: boolean;
  defaultValue?: string | null;
  pricingRole: string;
  unitLabel?: string | null;
  placeholder?: string | null;
  minValue?: number | null;
  maxValue?: number | null;
  stepValue?: number | null;
  sortOrder: number;
  metadata?: Readonly<Record<string, unknown>> | null;
  options: readonly CatalogSpecOption[];
}>;

type CatalogSpecOption = Readonly<{
  label: string;
  value: string;
  multiplier?: number;
  fixedFee?: number;
  unitCost?: number;
  estimatedQuantity?: number | null;
  isDefault?: boolean;
  sortOrder: number;
  metadata?: Readonly<Record<string, unknown>> | null;
}>;

/**
 * Persist the canonical release 1.10 catalog without replacing historical
 * rows. Every natural key is conflict-safe so migrations and fresh seeds use
 * the same deterministic operation.
 */
export async function upsertCatalogV110(
  executor: CatalogSqlExecutor,
): Promise<void> {
  // Adopted databases can contain explicitly assigned legacy ids while their
  // SERIAL sequences still point at the initial value. Advance every catalog
  // sequence before inserting canonical rows so ON CONFLICT natural-key
  // upserts cannot collide with an unrelated primary key.
  for (const table of [
    'product_categories',
    'product_spec_definitions',
    'product_spec_options',
  ]) {
    await executor.query(`
      SELECT setval(
        pg_get_serial_sequence('${table}', 'id'),
        GREATEST(COALESCE(MAX("id"), 0), 1),
        COUNT(*) > 0
      )
      FROM "${table}"
    `);
  }

  const groupSlugs = CATALOG_V1_10_GROUPS.map((group) => group.slug);
  const productSlugs = CATALOG_V1_10_GROUPS.flatMap((group) =>
    group.products.map((product) => product.slug),
  );

  for (const group of CATALOG_V1_10_GROUPS) {
    for (const product of group.products) {
      await executor.query(
        `INSERT INTO "product_categories" (
           "slug", "name", "description", "mobile_description", "examples",
           "group_slug", "group_name", "group_description",
           "group_sort_order", "file_processing_type", "pricing_model",
           "base_rate", "quantity_unit", "max_file_size_mb",
           "allowed_extensions", "is_active", "sort_order"
         ) VALUES (
           $1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12,
           $13, $14, $15::jsonb, $16, $17
         )
         ON CONFLICT ("slug") DO UPDATE SET
           "name" = EXCLUDED."name",
           "description" = EXCLUDED."description",
           "mobile_description" = EXCLUDED."mobile_description",
           "examples" = EXCLUDED."examples",
           "group_slug" = EXCLUDED."group_slug",
           "group_name" = EXCLUDED."group_name",
           "group_description" = EXCLUDED."group_description",
           "group_sort_order" = EXCLUDED."group_sort_order",
           "file_processing_type" = EXCLUDED."file_processing_type",
           "pricing_model" = EXCLUDED."pricing_model",
           "base_rate" = EXCLUDED."base_rate",
           "quantity_unit" = EXCLUDED."quantity_unit",
           "max_file_size_mb" = EXCLUDED."max_file_size_mb",
           "allowed_extensions" = EXCLUDED."allowed_extensions",
           "is_active" = EXCLUDED."is_active",
           "sort_order" = EXCLUDED."sort_order",
           "updated_at" = NOW()`,
        [
          product.slug,
          product.name,
          product.description,
          product.mobileDescription,
          JSON.stringify(product.examples),
          group.slug,
          group.name,
          group.description,
          group.sortOrder,
          product.fileProcessingType,
          product.pricingModel,
          product.baseRate,
          product.quantityUnit,
          product.maxFileSizeMb,
          JSON.stringify(product.allowedExtensions),
          product.isActive,
          product.sortOrder,
        ],
      );

      const specs = product.specs as readonly CatalogSpec[];
      for (const spec of specs) {
        await executor.query(
          `INSERT INTO "product_spec_definitions" (
             "category_id", "key", "label", "help_text", "input_type",
             "value_type", "is_required", "is_active", "default_value",
             "pricing_role", "unit_label", "placeholder", "min_value",
             "max_value", "step_value", "sort_order", "metadata"
           )
           SELECT
             category."id", $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             $12, $13, $14, $15, $16, $17::jsonb
           FROM "product_categories" category
           WHERE category."slug" = $1
           ON CONFLICT ("category_id", "key") DO UPDATE SET
             "label" = EXCLUDED."label",
             "help_text" = EXCLUDED."help_text",
             "input_type" = EXCLUDED."input_type",
             "value_type" = EXCLUDED."value_type",
             "is_required" = EXCLUDED."is_required",
             "is_active" = EXCLUDED."is_active",
             "default_value" = EXCLUDED."default_value",
             "pricing_role" = EXCLUDED."pricing_role",
             "unit_label" = EXCLUDED."unit_label",
             "placeholder" = EXCLUDED."placeholder",
             "min_value" = EXCLUDED."min_value",
             "max_value" = EXCLUDED."max_value",
             "step_value" = EXCLUDED."step_value",
             "sort_order" = EXCLUDED."sort_order",
             "metadata" = EXCLUDED."metadata",
             "updated_at" = NOW()`,
          [
            product.slug,
            spec.key,
            spec.label,
            spec.helpText ?? null,
            spec.inputType,
            spec.valueType,
            spec.isRequired,
            true,
            spec.defaultValue ?? null,
            spec.pricingRole,
            spec.unitLabel ?? null,
            spec.placeholder ?? null,
            spec.minValue ?? null,
            spec.maxValue ?? null,
            spec.stepValue ?? null,
            spec.sortOrder,
            JSON.stringify(spec.metadata ?? null),
          ],
        );

        for (const option of spec.options) {
          await executor.query(
            `INSERT INTO "product_spec_options" (
               "spec_definition_id", "label", "value", "multiplier",
               "fixed_fee", "unit_cost", "estimated_quantity",
               "is_default", "is_active", "sort_order", "metadata"
             )
             SELECT
               spec."id", $3, $4, $5, $6, $7, $8, $9, $10, $11,
               $12::jsonb
             FROM "product_spec_definitions" spec
             JOIN "product_categories" category
               ON category."id" = spec."category_id"
             WHERE category."slug" = $1 AND spec."key" = $2
             ON CONFLICT ("spec_definition_id", "value") DO UPDATE SET
               "label" = EXCLUDED."label",
               "multiplier" = EXCLUDED."multiplier",
               "fixed_fee" = EXCLUDED."fixed_fee",
               "unit_cost" = EXCLUDED."unit_cost",
               "estimated_quantity" = EXCLUDED."estimated_quantity",
               "is_default" = EXCLUDED."is_default",
               "is_active" = EXCLUDED."is_active",
               "sort_order" = EXCLUDED."sort_order",
               "metadata" = EXCLUDED."metadata",
               "updated_at" = NOW()`,
            [
              product.slug,
              spec.key,
              option.label,
              option.value,
              option.multiplier ?? 1,
              option.fixedFee ?? 0,
              option.unitCost ?? 0,
              option.estimatedQuantity ?? null,
              option.isDefault ?? false,
              true,
              option.sortOrder,
              JSON.stringify(option.metadata ?? null),
            ],
          );
        }

        await executor.query(
          `UPDATE "product_spec_options" option_record
           SET "is_active" = false, "updated_at" = NOW()
           FROM "product_spec_definitions" spec,
                "product_categories" category
           WHERE option_record."spec_definition_id" = spec."id"
             AND spec."category_id" = category."id"
             AND category."slug" = $1
             AND spec."key" = $2
             AND NOT (option_record."value" = ANY($3::varchar[]))`,
          [product.slug, spec.key, spec.options.map((option) => option.value)],
        );
      }

      await executor.query(
        `UPDATE "product_spec_definitions" spec
         SET "is_active" = false, "updated_at" = NOW()
         FROM "product_categories" category
         WHERE spec."category_id" = category."id"
           AND category."slug" = $1
           AND NOT (spec."key" = ANY($2::varchar[]))`,
        [product.slug, specs.map((spec) => spec.key)],
      );
      await executor.query(
        `UPDATE "product_spec_options" option_record
         SET "is_active" = false, "updated_at" = NOW()
         FROM "product_spec_definitions" spec,
              "product_categories" category
         WHERE option_record."spec_definition_id" = spec."id"
           AND spec."category_id" = category."id"
           AND category."slug" = $1
           AND spec."is_active" = false`,
        [product.slug],
      );
    }
  }

  await executor.query(
    `UPDATE "product_spec_options" option_record
     SET "is_active" = false, "updated_at" = NOW()
     FROM "product_spec_definitions" spec,
          "product_categories" category
     WHERE option_record."spec_definition_id" = spec."id"
       AND spec."category_id" = category."id"
       AND category."group_slug" = ANY($1::varchar[])
       AND NOT (category."slug" = ANY($2::varchar[]))`,
    [groupSlugs, productSlugs],
  );
  await executor.query(
    `UPDATE "product_spec_definitions" spec
     SET "is_active" = false, "updated_at" = NOW()
     FROM "product_categories" category
     WHERE spec."category_id" = category."id"
       AND category."group_slug" = ANY($1::varchar[])
       AND NOT (category."slug" = ANY($2::varchar[]))`,
    [groupSlugs, productSlugs],
  );
  await executor.query(
    `UPDATE "product_categories" category
     SET "is_active" = false, "updated_at" = NOW()
     WHERE category."group_slug" = ANY($1::varchar[])
       AND NOT (category."slug" = ANY($2::varchar[]))`,
    [groupSlugs, productSlugs],
  );
  await executor.query(
    `UPDATE "product_categories"
     SET "is_active" = false, "updated_at" = NOW()
     WHERE "slug" IN ('paper', '3d')`,
  );
}
