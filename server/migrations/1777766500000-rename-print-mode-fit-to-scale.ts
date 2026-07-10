import { MigrationInterface, QueryRunner } from 'typeorm';

export class RenamePrintModeFitToScale1777766500000 implements MigrationInterface {
  name = 'RenamePrintModeFitToScale1777766500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('product_spec_options')) &&
      (await queryRunner.hasTable('product_spec_definitions')) &&
      (await queryRunner.hasTable('product_categories'))
    ) {
      await queryRunner.query(`
        UPDATE "product_spec_options" AS option
        SET "label" = 'Fit to Scale'
        FROM "product_spec_definitions" AS definition
        INNER JOIN "product_categories" AS category
          ON category."id" = definition."category_id"
        WHERE option."spec_definition_id" = definition."id"
          AND category."slug" = 'paper'
          AND definition."key" = 'print_mode'
          AND option."value" = 'fitToPage'
          AND option."label" = 'Fit to Page'
      `);
    }
    if (
      (await queryRunner.hasTable('users')) &&
      (await queryRunner.hasColumn('users', 'default_print_mode'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "users" DROP COLUMN IF EXISTS "default_print_mode"
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('users')) &&
      !(await queryRunner.hasColumn('users', 'default_print_mode'))
    ) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "default_print_mode" varchar(20) DEFAULT 'fitToPage'
      `);
    }
    if (
      (await queryRunner.hasTable('product_spec_options')) &&
      (await queryRunner.hasTable('product_spec_definitions')) &&
      (await queryRunner.hasTable('product_categories'))
    ) {
      await queryRunner.query(`
        UPDATE "product_spec_options" AS option
        SET "label" = 'Fit to Page'
        FROM "product_spec_definitions" AS definition
        INNER JOIN "product_categories" AS category
          ON category."id" = definition."category_id"
        WHERE option."spec_definition_id" = definition."id"
          AND category."slug" = 'paper'
          AND definition."key" = 'print_mode'
          AND option."value" = 'fitToPage'
          AND option."label" = 'Fit to Scale'
      `);
    }
  }
}
