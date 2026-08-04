import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 1 Task 1.4:
 * Nullable client_account_type metadata on users
 * (business | organization | teacher). Not an auth role.
 */
export class ClientAccountType1784333100000 implements MigrationInterface {
  name = 'ClientAccountType1784333100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      return;
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF to_regtype('public.users_client_account_type_enum') IS NULL THEN
          CREATE TYPE "public"."users_client_account_type_enum" AS ENUM (
            'business',
            'organization',
            'teacher'
          );
        END IF;
      END $$;
    `);

    if (!(await queryRunner.hasColumn('users', 'client_account_type'))) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "client_account_type"
          "public"."users_client_account_type_enum" NULL
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    if (await queryRunner.hasTable('users')) {
      if (await queryRunner.hasColumn('users', 'client_account_type')) {
        await queryRunner.query(`
          ALTER TABLE "users" DROP COLUMN "client_account_type"
        `);
      }
    }

    await queryRunner.query(`
      DROP TYPE IF EXISTS "public"."users_client_account_type_enum"
    `);
  }
}
