import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorialSeenKeys1777507200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('users')) &&
      !(await queryRunner.hasColumn('users', 'tutorial_seen_keys'))
    ) {
      await queryRunner.query(`
        ALTER TABLE users
        ADD COLUMN tutorial_seen_keys text[] NOT NULL DEFAULT '{}'
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      await queryRunner.query(`
        ALTER TABLE users DROP COLUMN IF EXISTS tutorial_seen_keys
      `);
    }
  }
}
