import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 9.1 — ArtworkMockupRender table for Product Preview.
 * Static template composites; always non-production.
 */
export class ArtworkMockupRenders1784334000000 implements MigrationInterface {
  name = 'ArtworkMockupRenders1784334000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.artwork_mockup_renders_status_enum') IS NULL THEN
          CREATE TYPE "public"."artwork_mockup_renders_status_enum" AS ENUM (
            'pending',
            'ready',
            'invalidated',
            'failed'
          );
        END IF;
      END $$;
    `);

    if (!(await queryRunner.hasTable('artwork_mockup_renders'))) {
      await queryRunner.query(`
        CREATE TABLE "artwork_mockup_renders" (
          "id" SERIAL NOT NULL,
          "artwork_file_id" integer NOT NULL,
          "order_id" integer,
          "product_type" character varying(40) NOT NULL,
          "template_version" character varying(40) NOT NULL,
          "render_status" "public"."artwork_mockup_renders_status_enum"
            NOT NULL DEFAULT 'pending',
          "render_url" text,
          "is_non_production" boolean NOT NULL DEFAULT true,
          "failure_reason" text,
          "expires_at" TIMESTAMPTZ,
          "invalidated_at" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "PK_artwork_mockup_renders" PRIMARY KEY ("id"),
          CONSTRAINT "FK_mockup_artwork_file"
            FOREIGN KEY ("artwork_file_id")
            REFERENCES "file_metadata"("id")
            ON DELETE CASCADE,
          CONSTRAINT "FK_mockup_order"
            FOREIGN KEY ("order_id")
            REFERENCES "orders"("id")
            ON DELETE SET NULL
        )
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_mockup_artwork_file_id"
          ON "artwork_mockup_renders" ("artwork_file_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_mockup_order_id"
          ON "artwork_mockup_renders" ("order_id")
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_mockup_product_type"
          ON "artwork_mockup_renders" ("product_type")
      `);
    }

    // Optional issue window end on orders (Phase 9.2)
    if (await queryRunner.hasTable('orders')) {
      const hasCol = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = 'issue_window_ends_at'
        LIMIT 1
      `);
      if (!Array.isArray(hasCol) || hasCol.length === 0) {
        await queryRunner.query(`
          ALTER TABLE "orders"
          ADD COLUMN "issue_window_ends_at" TIMESTAMPTZ
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('orders')) {
      const hasCol = await queryRunner.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'orders'
          AND column_name = 'issue_window_ends_at'
        LIMIT 1
      `);
      if (Array.isArray(hasCol) && hasCol.length > 0) {
        await queryRunner.query(`
          ALTER TABLE "orders" DROP COLUMN "issue_window_ends_at"
        `);
      }
    }
    if (await queryRunner.hasTable('artwork_mockup_renders')) {
      await queryRunner.query(`DROP TABLE "artwork_mockup_renders"`);
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.artwork_mockup_renders_status_enum') IS NOT NULL THEN
          DROP TYPE "public"."artwork_mockup_renders_status_enum";
        END IF;
      END $$;
    `);
  }
}
