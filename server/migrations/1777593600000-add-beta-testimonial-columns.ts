import { MigrationInterface, QueryRunner } from 'typeorm';
import { isAdoptedSchema } from '../src/database/migration-ownership';

export class AddBetaTestimonialColumns1777593600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      return;
    }
    if (!(await queryRunner.hasColumn('users', 'beta_photo_file_id'))) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN beta_photo_file_id int NULL`,
      );
    }
    if (!(await queryRunner.hasColumn('users', 'beta_photo_uploaded_at'))) {
      await queryRunner.query(
        `ALTER TABLE users ADD COLUMN beta_photo_uploaded_at timestamptz NULL`,
      );
    }
    if (!(await queryRunner.hasColumn('users', 'beta_shared_on_social'))) {
      await queryRunner.query(`
        ALTER TABLE users
        ADD COLUMN beta_shared_on_social boolean NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await isAdoptedSchema(queryRunner)) return;

    if (await queryRunner.hasTable('users')) {
      await queryRunner.query(`
        ALTER TABLE users
        DROP COLUMN IF EXISTS beta_photo_file_id,
        DROP COLUMN IF EXISTS beta_photo_uploaded_at,
        DROP COLUMN IF EXISTS beta_shared_on_social
      `);
    }
  }
}
