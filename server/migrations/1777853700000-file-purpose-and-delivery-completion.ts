import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class FilePurposeAndDeliveryCompletion1777853700000 implements MigrationInterface {
  name = 'FilePurposeAndDeliveryCompletion1777853700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('file_metadata'))) return;

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_type WHERE typname = 'file_metadata_purpose_enum'
        ) THEN
          CREATE TYPE "file_metadata_purpose_enum" AS ENUM (
            'general',
            'paper',
            'proof_of_delivery',
            'beta_testimonial',
            'legacy'
          );
        END IF;
      END
      $$;
    `);

    if (!(await queryRunner.hasColumn('file_metadata', 'purpose'))) {
      await queryRunner.query(`
        ALTER TABLE "file_metadata"
        ADD COLUMN "purpose" varchar NULL
      `);
    }

    await queryRunner.query(`
      ALTER TABLE "file_metadata"
      ALTER COLUMN "purpose" DROP DEFAULT
    `);
    await queryRunner.query(`
      ALTER TABLE "file_metadata"
      ALTER COLUMN "purpose" TYPE "file_metadata_purpose_enum"
      USING (
        CASE
          WHEN lower(replace(btrim(COALESCE(purpose::text, '')), '-', '_'))
            IN ('general', 'paper', 'proof_of_delivery', 'beta_testimonial', 'legacy')
            THEN lower(replace(btrim(purpose::text), '-', '_'))::"file_metadata_purpose_enum"
          WHEN object_key LIKE 'uploads/proof_of_delivery/%'
            OR object_key LIKE 'uploads/proof-of-delivery/%'
            THEN 'proof_of_delivery'::"file_metadata_purpose_enum"
          WHEN object_key LIKE 'uploads/beta_testimonial/%'
            THEN 'beta_testimonial'::"file_metadata_purpose_enum"
          WHEN object_key LIKE 'uploads/paper/%'
            THEN 'paper'::"file_metadata_purpose_enum"
          WHEN object_key LIKE 'uploads/general/%'
            THEN 'general'::"file_metadata_purpose_enum"
          ELSE 'legacy'::"file_metadata_purpose_enum"
        END
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "file_metadata"
      ALTER COLUMN "purpose" SET DEFAULT 'general',
      ALTER COLUMN "purpose" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('file_metadata'))) return;

    if (await queryRunner.hasColumn('file_metadata', 'purpose')) {
      await queryRunner.query(`
        ALTER TABLE "file_metadata" DROP COLUMN "purpose"
      `);
    }
    await queryRunner.query(`
      DROP TYPE IF EXISTS "file_metadata_purpose_enum"
    `);
  }
}
