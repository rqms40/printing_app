import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBetaTestimonialColumns1777593600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS beta_photo_file_id int NULL,
      ADD COLUMN IF NOT EXISTS beta_photo_uploaded_at timestamptz NULL,
      ADD COLUMN IF NOT EXISTS beta_shared_on_social boolean NOT NULL DEFAULT false
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      DROP COLUMN IF EXISTS beta_photo_file_id,
      DROP COLUMN IF EXISTS beta_photo_uploaded_at,
      DROP COLUMN IF EXISTS beta_shared_on_social
    `);
  }
}
