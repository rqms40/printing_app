import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Product catalog hierarchy: Category → Subgroup → Variant (leaf).
 * Adds parent_id, catalog_level, audience_label, is_orderable so
 * GRIDGO Business can nest subgroups under top categories while
 * keeping legacy paper/3d as orderable roots.
 */
export class ProductCategoryHierarchy1784334500000
  implements MigrationInterface
{
  name = 'ProductCategoryHierarchy1784334500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('product_categories'))) {
      return;
    }

    const hasParentId = await queryRunner.hasColumn(
      'product_categories',
      'parent_id',
    );
    if (!hasParentId) {
      await queryRunner.query(`
        ALTER TABLE "product_categories"
        ADD COLUMN "parent_id" integer NULL
      `);
      await queryRunner.query(`
        ALTER TABLE "product_categories"
        ADD CONSTRAINT "fk_product_categories_parent"
        FOREIGN KEY ("parent_id")
        REFERENCES "product_categories"("id")
        ON DELETE CASCADE
      `);
      await queryRunner.query(`
        CREATE INDEX "idx_product_categories_parent_id"
        ON "product_categories" ("parent_id")
      `);
    }

    const hasCatalogLevel = await queryRunner.hasColumn(
      'product_categories',
      'catalog_level',
    );
    if (!hasCatalogLevel) {
      await queryRunner.query(`
        ALTER TABLE "product_categories"
        ADD COLUMN "catalog_level" smallint NOT NULL DEFAULT 1
      `);
    }

    const hasAudienceLabel = await queryRunner.hasColumn(
      'product_categories',
      'audience_label',
    );
    if (!hasAudienceLabel) {
      await queryRunner.query(`
        ALTER TABLE "product_categories"
        ADD COLUMN "audience_label" varchar(240) NULL
      `);
    }

    const hasIsOrderable = await queryRunner.hasColumn(
      'product_categories',
      'is_orderable',
    );
    if (!hasIsOrderable) {
      await queryRunner.query(`
        ALTER TABLE "product_categories"
        ADD COLUMN "is_orderable" boolean NOT NULL DEFAULT true
      `);
    }

    // Existing roots stay orderable leaves at level 1.
    await queryRunner.query(`
      UPDATE "product_categories"
      SET
        "catalog_level" = COALESCE("catalog_level", 1),
        "is_orderable" = COALESCE("is_orderable", true)
      WHERE "parent_id" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('product_categories'))) {
      return;
    }

    if (await queryRunner.hasColumn('product_categories', 'is_orderable')) {
      await queryRunner.query(`
        ALTER TABLE "product_categories" DROP COLUMN "is_orderable"
      `);
    }
    if (await queryRunner.hasColumn('product_categories', 'audience_label')) {
      await queryRunner.query(`
        ALTER TABLE "product_categories" DROP COLUMN "audience_label"
      `);
    }
    if (await queryRunner.hasColumn('product_categories', 'catalog_level')) {
      await queryRunner.query(`
        ALTER TABLE "product_categories" DROP COLUMN "catalog_level"
      `);
    }
    if (await queryRunner.hasColumn('product_categories', 'parent_id')) {
      await queryRunner.query(`
        DROP INDEX IF EXISTS "idx_product_categories_parent_id"
      `);
      await queryRunner.query(`
        ALTER TABLE "product_categories"
        DROP CONSTRAINT IF EXISTS "fk_product_categories_parent"
      `);
      await queryRunner.query(`
        ALTER TABLE "product_categories" DROP COLUMN "parent_id"
      `);
    }
  }
}
