import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class HomeFeedPromoCards1784246500000 implements MigrationInterface {
  name = 'HomeFeedPromoCards1784246500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "home_feed_promo_cards" (
        "id" SERIAL PRIMARY KEY,
        "title" varchar(80) NOT NULL,
        "body" varchar(220),
        "cta_label" varchar(32),
        "cta_target" varchar(255),
        "image_url" varchar(2048),
        "sort_order" int NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.home_feed_settings') IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'home_feed_settings'
              AND column_name = 'promo_title'
          )
          AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'home_feed_settings'
              AND column_name = 'promo_body'
          )
          THEN
          EXECUTE $sql$
            INSERT INTO "home_feed_promo_cards" (
              "title",
              "body",
              "cta_label",
              "cta_target",
              "image_url",
              "sort_order",
              "is_active"
            )
            SELECT
              settings."promo_title",
              settings."promo_body",
              to_jsonb(settings) ->> 'promo_cta_label',
              to_jsonb(settings) ->> 'promo_cta_target',
              to_jsonb(settings) ->> 'promo_image_url',
              COALESCE((
                SELECT MIN(card."sort_order") - 1
                FROM "home_feed_promo_cards" AS card
              ), 0),
              true
            FROM "home_feed_settings" AS settings
            WHERE nullif(btrim(settings."promo_title"), '') IS NOT NULL
              AND nullif(btrim(settings."promo_body"), '') IS NOT NULL
              AND NOT EXISTS (
                SELECT 1
                FROM "home_feed_promo_cards" AS existing
                WHERE existing."title" = settings."promo_title"
                  AND existing."body" = settings."promo_body"
                  AND existing."cta_label" IS NOT DISTINCT FROM
                    to_jsonb(settings) ->> 'promo_cta_label'
                  AND existing."cta_target" IS NOT DISTINCT FROM
                    to_jsonb(settings) ->> 'promo_cta_target'
                  AND existing."image_url" IS NOT DISTINCT FROM
                    to_jsonb(settings) ->> 'promo_image_url'
              )
            ORDER BY settings."id"
            LIMIT 1
          $sql$;
        END IF;
      END $$;
    `);

    for (const column of [
      'promo_title',
      'promo_body',
      'promo_cta_label',
      'promo_cta_target',
      'promo_image_url',
    ]) {
      await queryRunner.query(
        `ALTER TABLE IF EXISTS "home_feed_settings" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    await queryRunner.query(`
      ALTER TABLE IF EXISTS "home_feed_settings"
        ADD COLUMN IF NOT EXISTS "promo_title" varchar(80),
        ADD COLUMN IF NOT EXISTS "promo_body" varchar(220),
        ADD COLUMN IF NOT EXISTS "promo_cta_label" varchar(32),
        ADD COLUMN IF NOT EXISTS "promo_cta_target" varchar(255),
        ADD COLUMN IF NOT EXISTS "promo_image_url" varchar(2048)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regclass('public.home_feed_settings') IS NOT NULL
          AND to_regclass('public.home_feed_promo_cards') IS NOT NULL THEN
          UPDATE "home_feed_settings" AS settings
          SET
            "promo_title" = card."title",
            "promo_body" = card."body",
            "promo_cta_label" = card."cta_label",
            "promo_cta_target" = card."cta_target",
            "promo_image_url" = card."image_url"
          FROM (
            SELECT *
            FROM "home_feed_promo_cards"
            ORDER BY "sort_order" ASC, "id" ASC
            LIMIT 1
          ) AS card;
        END IF;
      END $$;
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS "home_feed_promo_cards"`);
  }
}
