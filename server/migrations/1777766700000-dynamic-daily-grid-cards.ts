import { MigrationInterface, QueryRunner } from 'typeorm';
import { isAdoptedSchema } from '../src/database/migration-ownership';

export class DynamicDailyGridCards1777766700000 implements MigrationInterface {
  name = 'DynamicDailyGridCards1777766700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "daily_grid_cards" ADD COLUMN IF NOT EXISTS "specs" jsonb`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.daily_grid_cards') IS NOT NULL THEN
          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'daily_grid_cards'
              AND column_name = 'paper_specs'
          ) THEN
            EXECUTE $sql$
              UPDATE "daily_grid_cards"
              SET "specs" = jsonb_strip_nulls(jsonb_build_object(
                'paper_size', "paper_specs" ->> 'paperSize',
                'color_mode', "paper_specs" ->> 'colorMode',
                'media_type', "paper_specs" ->> 'mediaType',
                'print_sides', "paper_specs" ->> 'printSides',
                'binding', "paper_specs" ->> 'binding'
              ))
              WHERE "specs" IS NULL
                AND "category" = 'paper'
                AND "paper_specs" IS NOT NULL
            $sql$;
          END IF;

          IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'daily_grid_cards'
              AND column_name = 'three_d_specs'
          ) THEN
            EXECUTE $sql$
              UPDATE "daily_grid_cards"
              SET "specs" = jsonb_strip_nulls(jsonb_build_object(
                'file_format', "three_d_specs" ->> 'fileFormat',
                'material', "three_d_specs" ->> 'material',
                'color', "three_d_specs" ->> 'color',
                'infill_percentage', "three_d_specs" ->> 'infillPercentage',
                'layer_height', "three_d_specs" ->> 'layerHeight',
                'supports', "three_d_specs" ->> 'supports',
                'notes', "three_d_specs" ->> 'notes'
              ))
              WHERE "specs" IS NULL
                AND "category" = '3d'
                AND "three_d_specs" IS NOT NULL
            $sql$;
          END IF;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE IF EXISTS "daily_grid_cards" DROP COLUMN IF EXISTS "paper_specs"`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "daily_grid_cards" DROP COLUMN IF EXISTS "three_d_specs"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await isAdoptedSchema(queryRunner)) return;

    await queryRunner.query(
      `ALTER TABLE IF EXISTS "daily_grid_cards" ADD COLUMN IF NOT EXISTS "paper_specs" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE IF EXISTS "daily_grid_cards" ADD COLUMN IF NOT EXISTS "three_d_specs" jsonb`,
    );

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.daily_grid_cards') IS NOT NULL THEN
          UPDATE "daily_grid_cards"
          SET "paper_specs" = jsonb_strip_nulls(jsonb_build_object(
            'paperSize', "specs" ->> 'paper_size',
            'colorMode', "specs" ->> 'color_mode',
            'mediaType', "specs" ->> 'media_type',
            'printSides', "specs" ->> 'print_sides',
            'binding', "specs" ->> 'binding'
          ))
          WHERE "category" = 'paper'
            AND "specs" IS NOT NULL
            AND "paper_specs" IS NULL;

          UPDATE "daily_grid_cards"
          SET "three_d_specs" = jsonb_strip_nulls(jsonb_build_object(
            'fileFormat', "specs" ->> 'file_format',
            'material', "specs" ->> 'material',
            'color', "specs" ->> 'color',
            'infillPercentage', "specs" ->> 'infill_percentage',
            'layerHeight', "specs" ->> 'layer_height',
            'supports', "specs" ->> 'supports',
            'notes', "specs" ->> 'notes'
          ))
          WHERE "category" = '3d'
            AND "specs" IS NOT NULL
            AND "three_d_specs" IS NULL;
        END IF;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE IF EXISTS "daily_grid_cards" DROP COLUMN IF EXISTS "specs"`,
    );
  }
}
