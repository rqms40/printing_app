import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Add the v1.10 browsing-group and RFQ persistence contract.
 *
 * Catalog rows/specs are intentionally left to the deterministic persistence
 * helper introduced in Task 3. This migration only prepares the schema and
 * retires the two legacy entry points without deleting historical records.
 */
export class CatalogRfqV1101784334500000 implements MigrationInterface {
  name = 'CatalogRfqV1101784334500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('product_categories')) {
      const groupColumns = [
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

    if (
      (await queryRunner.hasTable('file_metadata')) &&
      !(await queryRunner.hasColumn('file_metadata', 'catalog_product_slug'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "file_metadata"
        ADD COLUMN "catalog_product_slug" varchar(50)
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
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
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

    if (
      (await queryRunner.hasTable('file_metadata')) &&
      (await queryRunner.hasColumn('file_metadata', 'catalog_product_slug'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "file_metadata" DROP COLUMN "catalog_product_slug"
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
        SET "is_active" = true WHERE "slug" IN ('paper', '3d')
      `);

      for (const column of [
        'group_sort_order',
        'group_description',
        'group_name',
        'group_slug',
      ]) {
        if (await queryRunner.hasColumn('product_categories', column)) {
          await queryRunner.query(
            `ALTER TABLE "product_categories" DROP COLUMN "${column}"`,
          );
        }
      }
    }
  }
}
