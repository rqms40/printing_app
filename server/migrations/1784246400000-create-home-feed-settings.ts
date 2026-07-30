import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class CreateHomeFeedSettings1784246400000 implements MigrationInterface {
  name = 'CreateHomeFeedSettings1784246400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('home_feed_settings')) return;

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.home_feed_settings_mode_enum') IS NULL THEN
          CREATE TYPE "public"."home_feed_settings_mode_enum"
            AS ENUM ('auto', 'community', 'promo');
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      CREATE TABLE "home_feed_settings" (
        "id" SERIAL PRIMARY KEY,
        "mode" "public"."home_feed_settings_mode_enum" NOT NULL DEFAULT 'auto',
        "promo_title" varchar(80),
        "promo_body" varchar(220),
        "promo_cta_label" varchar(32),
        "promo_cta_target" varchar(255),
        "promo_image_url" varchar(2048),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    await queryRunner.query(`DROP TABLE IF EXISTS "home_feed_settings"`);
    await queryRunner.query(
      `DROP TYPE IF EXISTS "public"."home_feed_settings_mode_enum"`,
    );
  }
}
