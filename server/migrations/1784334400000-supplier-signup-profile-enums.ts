import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extend user profile enums for the supplier sign-up lane.
 */
export class SupplierSignupProfileEnums1784334400000
  implements MigrationInterface
{
  name = 'SupplierSignupProfileEnums1784334400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'users_profile_category_enum' AND e.enumlabel = 'supplier'
        ) THEN
          ALTER TYPE "public"."users_profile_category_enum" ADD VALUE 'supplier';
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_enum e
          JOIN pg_type t ON e.enumtypid = t.oid
          WHERE t.typname = 'users_profile_field_enum' AND e.enumlabel = 'print_shop'
        ) THEN
          ALTER TYPE "public"."users_profile_field_enum" ADD VALUE 'print_shop';
        END IF;
      END $$;
    `);
  }

  public async down(): Promise<void> {
    // Postgres cannot remove enum values safely; leave labels in place.
  }
}
