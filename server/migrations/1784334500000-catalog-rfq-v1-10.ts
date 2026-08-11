import { MigrationInterface, QueryRunner } from 'typeorm';
import { upsertCatalogV110 } from '../src/products/catalog-v1-10.persistence';

type DuplicateCapabilityRow = {
  id: number | string;
  supplier_id: number | string;
  product_family: string;
  payload_signature: string;
};

type CapabilityDuplicateGroup = {
  supplierId: number;
  productFamily: string;
  rows: Array<{ id: number; payloadSignature: string }>;
};

type DuplicateCodCollectionRow = {
  id: number | string;
  order_id: number | string;
  payload_signature: string;
};

/**
 * Add the v1.10 browsing-group and RFQ persistence contract.
 *
 * Catalog rows/specs are persisted through the same deterministic helper used
 * by the fresh seed. Historical records are retained and retired entry points
 * are deactivated rather than deleted.
 */
export class CatalogRfqV1101784334500000 implements MigrationInterface {
  name = 'CatalogRfqV1101784334500000';

  private async reconcileCapabilityDuplicates(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const duplicateRows = (await queryRunner.query(`
      WITH duplicate_capabilities AS (
        SELECT
          capability.*,
          COUNT(*) OVER (
            PARTITION BY "supplier_id", "product_family"
          ) AS duplicate_count
        FROM "supplier_capabilities" capability
      )
      SELECT
        "id",
        "supplier_id",
        "product_family",
        jsonb_build_object(
          'materials', "materials",
          'max_capacity', "max_capacity",
          'lead_time_days', "lead_time_days",
          'is_active', "is_active"
        )::text AS payload_signature
      FROM duplicate_capabilities
      WHERE duplicate_count > 1
      ORDER BY "supplier_id", "product_family", "id"
    `)) as unknown as DuplicateCapabilityRow[];

    const groups = new Map<string, CapabilityDuplicateGroup>();
    for (const row of duplicateRows) {
      const supplierId = Number(row.supplier_id);
      const id = Number(row.id);
      const key = JSON.stringify([supplierId, row.product_family]);
      const group = groups.get(key) ?? {
        supplierId,
        productFamily: row.product_family,
        rows: [],
      };
      group.rows.push({ id, payloadSignature: row.payload_signature });
      groups.set(key, group);
    }

    const orderedGroups = [...groups.values()].sort(
      (left, right) =>
        left.supplierId - right.supplierId ||
        left.productFamily.localeCompare(right.productFamily),
    );
    for (const group of orderedGroups) {
      group.rows.sort((left, right) => left.id - right.id);
    }

    const conflicts = orderedGroups.filter(
      (group) =>
        new Set(group.rows.map((row) => row.payloadSignature)).size > 1,
    );
    if (conflicts.length > 0) {
      const details = conflicts
        .map(
          (group) =>
            `supplier_id=${group.supplierId}, product_family=${JSON.stringify(group.productFamily)}, capability_ids=[${group.rows.map((row) => row.id).join(', ')}]`,
        )
        .join('; ');
      throw new Error(
        `Cannot enforce uq_supplier_capability_product: conflicting duplicate supplier capabilities: ${details}. Resolve each pair so only identical rows remain before retrying the migration.`,
      );
    }

    const redundantIds = orderedGroups.flatMap((group) =>
      group.rows.slice(1).map((row) => row.id),
    );
    if (redundantIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM "supplier_capabilities" WHERE "id" = ANY($1::int[])`,
        [redundantIds],
      );
    }
  }

  private async reconcileCodCollectionDuplicates(
    queryRunner: QueryRunner,
  ): Promise<void> {
    const duplicateRows = (await queryRunner.query(`
      WITH duplicate_cod_collections AS (
        SELECT
          collection.*,
          COUNT(*) OVER (PARTITION BY "order_id") AS duplicate_count
        FROM "cod_collections" collection
      )
      SELECT
        "id",
        "order_id",
        (
          to_jsonb(duplicate_cod_collections)
          - 'id'
          - 'created_at'
          - 'updated_at'
          - 'duplicate_count'
        )::text AS payload_signature
      FROM duplicate_cod_collections
      WHERE duplicate_count > 1
      ORDER BY "order_id", "id"
    `)) as unknown as DuplicateCodCollectionRow[];

    const groups = new Map<
      number,
      Array<{ id: number; payloadSignature: string }>
    >();
    for (const row of duplicateRows) {
      const orderId = Number(row.order_id);
      const rows = groups.get(orderId) ?? [];
      rows.push({
        id: Number(row.id),
        payloadSignature: row.payload_signature,
      });
      groups.set(orderId, rows);
    }

    const orderedGroups = [...groups.entries()].sort(
      ([left], [right]) => left - right,
    );
    for (const [, rows] of orderedGroups) {
      rows.sort((left, right) => left.id - right.id);
    }
    const conflicts = orderedGroups.filter(
      ([, rows]) => new Set(rows.map((row) => row.payloadSignature)).size > 1,
    );
    if (conflicts.length > 0) {
      const details = conflicts
        .map(
          ([orderId, rows]) =>
            `order_id=${orderId}, collection_ids=[${rows.map((row) => row.id).join(', ')}]`,
        )
        .join('; ');
      throw new Error(
        `Cannot enforce uq_cod_collections_order_id: conflicting duplicate COD collections: ${details}. Resolve each order so only one authoritative collection remains before retrying the migration.`,
      );
    }

    const redundantIds = orderedGroups.flatMap(([, rows]) =>
      rows.slice(1).map((row) => row.id),
    );
    if (redundantIds.length > 0) {
      await queryRunner.query(
        `DELETE FROM "cod_collections" WHERE "id" = ANY($1::int[])`,
        [redundantIds],
      );
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "pending_file_uploads" (
        "object_key" varchar(512) PRIMARY KEY,
        "state" varchar(32) NOT NULL,
        "upload_token" uuid NOT NULL,
        "upload_lease_expires_at" TIMESTAMPTZ NOT NULL,
        "claim_token" uuid,
        "claim_lease_expires_at" TIMESTAMPTZ,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "next_attempt_at" TIMESTAMPTZ NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "chk_pending_file_uploads_state"
          CHECK ("state" IN ('planned', 'cleanup_pending', 'deleting'))
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_pending_file_uploads_due"
      ON "pending_file_uploads" ("next_attempt_at")
    `);

    if (await queryRunner.hasTable('product_categories')) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "catalog_v1_10_legacy_activation_snapshot" (
          "slug" varchar(50) PRIMARY KEY,
          "was_active" boolean NOT NULL
        )
      `);
      await queryRunner.query(`
        INSERT INTO "catalog_v1_10_legacy_activation_snapshot" (
          "slug",
          "was_active"
        )
        SELECT "slug", "is_active"
        FROM "product_categories"
        WHERE "slug" IN ('paper', '3d')
        ON CONFLICT ("slug") DO NOTHING
      `);

      const groupColumns = [
        ['examples', 'jsonb'],
        ['group_slug', 'varchar(50)'],
        ['group_name', 'varchar(100)'],
        ['group_description', 'text'],
        ['group_sort_order', 'integer'],
      ] as const;

      for (const [column, definition] of groupColumns) {
        if (!(await queryRunner.hasColumn('product_categories', column))) {
          await queryRunner.query(
            `ALTER TABLE "product_categories" ADD COLUMN "${column}" ${definition}`,
          );
        }
      }

      if (
        (await queryRunner.hasTable('product_spec_definitions')) &&
        (await queryRunner.hasTable('product_spec_options'))
      ) {
        await upsertCatalogV110(queryRunner);
      }

      await queryRunner.query(`
        UPDATE "product_categories"
        SET "is_active" = false
        WHERE "slug" IN ('paper', '3d')
      `);
    }

    if (await queryRunner.hasTable('orders')) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF to_regtype('public.orders_pricing_status_enum') IS NULL THEN
            CREATE TYPE "public"."orders_pricing_status_enum" AS ENUM (
              'pending_quote',
              'quoted',
              'accepted'
            );
          END IF;
        END $$;
      `);

      if (!(await queryRunner.hasColumn('orders', 'pricing_status'))) {
        await queryRunner.query(`
          ALTER TABLE "orders"
          ADD COLUMN "pricing_status" "public"."orders_pricing_status_enum"
        `);
      }

      const quoteColumns = [
        ['quoted_total_minor', 'bigint'],
        ['quoted_at', 'TIMESTAMPTZ'],
        ['quote_accepted_at', 'TIMESTAMPTZ'],
        ['quoted_by_user_id', 'integer'],
        ['promised_completion_at', 'TIMESTAMPTZ'],
      ] as const;

      for (const [column, definition] of quoteColumns) {
        if (!(await queryRunner.hasColumn('orders', column))) {
          await queryRunner.query(
            `ALTER TABLE "orders" ADD COLUMN "${column}" ${definition}`,
          );
        }
      }

      await queryRunner.query(`
        UPDATE "orders"
        SET "pricing_status" = 'accepted'
        WHERE "pricing_status" IS NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "orders"
        ALTER COLUMN "pricing_status" SET DEFAULT 'accepted',
        ALTER COLUMN "pricing_status" SET NOT NULL
      `);

      if (await queryRunner.hasTable('users')) {
        await queryRunner.query(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1
              FROM pg_constraint
              WHERE conname = 'fk_orders_quoted_by_user'
                AND conrelid = 'public.orders'::regclass
            ) THEN
              ALTER TABLE "orders"
              ADD CONSTRAINT "fk_orders_quoted_by_user"
              FOREIGN KEY ("quoted_by_user_id") REFERENCES "users"("id")
              ON DELETE SET NULL ON UPDATE NO ACTION;
            END IF;
          END $$;
        `);
      }

      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "idx_orders_pricing_status"
        ON "orders" ("pricing_status")
      `);
    }

    if (
      (await queryRunner.hasTable('order_items')) &&
      !(await queryRunner.hasColumn('order_items', 'required_at'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "order_items" ADD COLUMN "required_at" TIMESTAMPTZ
      `);
    }

    if (await queryRunner.hasTable('order_item_spec_values')) {
      await queryRunner.query(`
        ALTER TABLE "order_item_spec_values"
        ALTER COLUMN "value" TYPE varchar(1000),
        ALTER COLUMN "display_value" TYPE varchar(1000)
      `);
    }

    if (await queryRunner.hasTable('file_metadata')) {
      await queryRunner.query(`
        DO $$
        BEGIN
          IF to_regtype('public.file_metadata_purpose_enum') IS NOT NULL
            AND NOT EXISTS (
              SELECT 1
              FROM pg_enum enum_value
              JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
              WHERE enum_type.typname = 'file_metadata_purpose_enum'
                AND enum_value.enumlabel = 'catalog_artwork'
            )
          THEN
            ALTER TYPE "public"."file_metadata_purpose_enum"
            ADD VALUE 'catalog_artwork';
          END IF;
        END $$;
      `);

      if (
        !(await queryRunner.hasColumn('file_metadata', 'catalog_product_slug'))
      ) {
        await queryRunner.query(`
          ALTER TABLE "file_metadata"
          ADD COLUMN "catalog_product_slug" varchar(50)
          `);
      }

      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_file_metadata_object_key"
        ON "file_metadata" ("object_key")
      `);
    }

    if (await queryRunner.hasTable('supplier_capabilities')) {
      if (
        !(await queryRunner.hasColumn('supplier_capabilities', 'is_active'))
      ) {
        await queryRunner.query(`
          ALTER TABLE "supplier_capabilities"
          ADD COLUMN "is_active" boolean NOT NULL DEFAULT true
        `);
      }

      await this.reconcileCapabilityDuplicates(queryRunner);

      await queryRunner.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'uq_supplier_capability_product'
              AND conrelid = 'public.supplier_capabilities'::regclass
          ) THEN
            ALTER TABLE "supplier_capabilities"
            ADD CONSTRAINT "uq_supplier_capability_product"
            UNIQUE ("supplier_id", "product_family");
          END IF;
        END $$;
      `);
    }

    if (await queryRunner.hasTable('cod_collections')) {
      await queryRunner.query(`
        LOCK TABLE "cod_collections" IN SHARE ROW EXCLUSIVE MODE
      `);
      await this.reconcileCodCollectionDuplicates(queryRunner);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_cod_collections_order_id"
        ON "cod_collections" ("order_id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('pending_file_uploads')) {
      await queryRunner.query(`
        LOCK TABLE "pending_file_uploads" IN ACCESS EXCLUSIVE MODE
      `);
      const pendingRows = (await queryRunner.query(`
        SELECT COUNT(*)::text AS pending_upload_count
        FROM "pending_file_uploads"
      `)) as Array<{ pending_upload_count: string }>;
      if (Number(pendingRows[0]?.pending_upload_count ?? 0) > 0) {
        throw new Error(
          'Cannot roll back catalog RFQ v1.10 while pending file upload cleanup rows remain. Wait for cleanup or resolve pending_file_uploads explicitly, then retry.',
        );
      }
      await queryRunner.query(`
        DROP TABLE IF EXISTS "pending_file_uploads"
      `);
    }

    if (await queryRunner.hasTable('supplier_capabilities')) {
      await queryRunner.query(`
        ALTER TABLE "supplier_capabilities"
        DROP CONSTRAINT IF EXISTS "uq_supplier_capability_product"
      `);
      if (await queryRunner.hasColumn('supplier_capabilities', 'is_active')) {
        await queryRunner.query(`
          ALTER TABLE "supplier_capabilities" DROP COLUMN "is_active"
        `);
      }
    }

    if (await queryRunner.hasTable('cod_collections')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "uq_cod_collections_order_id"
      `);
    }

    if (await queryRunner.hasTable('file_metadata')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "uq_file_metadata_object_key"
      `);
      if (
        await queryRunner.hasColumn('file_metadata', 'catalog_product_slug')
      ) {
        await queryRunner.query(`
          ALTER TABLE "file_metadata" DROP COLUMN "catalog_product_slug"
        `);
      }
      await queryRunner.query(`
        DO $catalog_enum_down$
        BEGIN
          IF EXISTS (
            SELECT 1
            FROM pg_enum enum_value
            JOIN pg_type enum_type ON enum_type.oid = enum_value.enumtypid
            WHERE enum_type.typname = 'file_metadata_purpose_enum'
              AND enum_value.enumlabel = 'catalog_artwork'
          ) THEN
            ALTER TABLE "file_metadata"
            ALTER COLUMN "purpose" DROP DEFAULT;

            UPDATE "file_metadata"
            SET "purpose" = 'general'
            WHERE "purpose"::text = 'catalog_artwork';

            ALTER TYPE "public"."file_metadata_purpose_enum"
            RENAME TO "file_metadata_purpose_enum_with_catalog";

            EXECUTE $enum_sql$CREATE TYPE "public"."file_metadata_purpose_enum" AS ENUM ('general', 'paper', 'proof_of_delivery', 'beta_testimonial', 'legacy')$enum_sql$;
            EXECUTE $enum_sql$ALTER TABLE "file_metadata" ALTER COLUMN "purpose" TYPE "public"."file_metadata_purpose_enum" USING "purpose"::text::"public"."file_metadata_purpose_enum"$enum_sql$;

            ALTER TABLE "file_metadata"
            ALTER COLUMN "purpose" SET DEFAULT 'general';

            DROP TYPE "public"."file_metadata_purpose_enum_with_catalog";
          END IF;
        END $catalog_enum_down$;
      `);
    }

    if (await queryRunner.hasTable('order_item_spec_values')) {
      await queryRunner.query(`
        ALTER TABLE "order_item_spec_values"
        ALTER COLUMN "value" TYPE varchar(120),
        ALTER COLUMN "display_value" TYPE varchar(120)
      `);
    }

    if (
      (await queryRunner.hasTable('order_items')) &&
      (await queryRunner.hasColumn('order_items', 'required_at'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "order_items" DROP COLUMN "required_at"
      `);
    }

    if (await queryRunner.hasTable('orders')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "idx_orders_pricing_status"
      `);
      await queryRunner.query(`
        ALTER TABLE "orders"
        DROP CONSTRAINT IF EXISTS "fk_orders_quoted_by_user"
      `);

      for (const column of [
        'promised_completion_at',
        'quoted_by_user_id',
        'quote_accepted_at',
        'quoted_at',
        'quoted_total_minor',
        'pricing_status',
      ]) {
        if (await queryRunner.hasColumn('orders', column)) {
          await queryRunner.query(
            `ALTER TABLE "orders" DROP COLUMN "${column}"`,
          );
        }
      }

      await queryRunner.query(`
        DROP TYPE IF EXISTS "public"."orders_pricing_status_enum"
      `);
    }

    if (await queryRunner.hasTable('product_categories')) {
      await queryRunner.query(`
        UPDATE "product_categories"
        SET "is_active" = false
        WHERE "group_slug" IN (
          'marketing-promo',
          'corporate-merch',
          'awards-signages',
          'specialized-prototyping'
        )
      `);

      if (
        await queryRunner.hasTable('catalog_v1_10_legacy_activation_snapshot')
      ) {
        await queryRunner.query(`
          UPDATE "product_categories" category
          SET "is_active" = activation_snapshot."was_active"
          FROM "catalog_v1_10_legacy_activation_snapshot" activation_snapshot
          WHERE category."slug" = activation_snapshot."slug"
        `);
      }

      for (const column of [
        'group_sort_order',
        'group_description',
        'group_name',
        'group_slug',
        'examples',
      ]) {
        if (await queryRunner.hasColumn('product_categories', column)) {
          await queryRunner.query(
            `ALTER TABLE "product_categories" DROP COLUMN "${column}"`,
          );
        }
      }
    }

    if (
      await queryRunner.hasTable('catalog_v1_10_legacy_activation_snapshot')
    ) {
      await queryRunner.query(`
        DROP TABLE "catalog_v1_10_legacy_activation_snapshot"
      `);
    }
  }
}
