import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorialSeenKeys1777507200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS tutorial_seen_keys text[] NOT NULL DEFAULT '{}'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS tutorial_seen_keys
    `);
  }
}
