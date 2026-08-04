import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marketplace Phase 1: expand users.role enum.
 * Hard migrate: customer → client, admin → ops_admin.
 * Add: supplier, super_admin.
 *
 * Uses ALTER TYPE ... RENAME VALUE (same pattern as rider-terminology-rename)
 * so existing rows keep valid labels after rename; no dual enum values left.
 */
export class MarketplaceUserRoles1784332800000 implements MigrationInterface {
  name = 'MarketplaceUserRoles1784332800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Drop default before renames so it is not bound to a removed label.
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT
    `);

    await this.renameEnumValue(queryRunner, 'customer', 'client');
    await this.renameEnumValue(queryRunner, 'admin', 'ops_admin');

    // RENAME VALUE already remapped stored values; ensure no stragglers if
    // both old and new labels ever coexisted mid-deploy.
    await queryRunner.query(`
      UPDATE "users" SET "role" = 'client' WHERE "role"::text = 'customer'
    `);
    await queryRunner.query(`
      UPDATE "users" SET "role" = 'ops_admin' WHERE "role"::text = 'admin'
    `);

    await this.addEnumValueIfMissing(queryRunner, 'supplier');
    await this.addEnumValueIfMissing(queryRunner, 'super_admin');

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'client'::"public"."users_role_enum"
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT
    `);

    // Cannot remove enum values safely; demote new roles to nearest legacy.
    await queryRunner.query(`
      UPDATE "users" SET "role" = 'ops_admin' WHERE "role"::text = 'super_admin'
    `);
    await queryRunner.query(`
      UPDATE "users" SET "role" = 'client' WHERE "role"::text = 'supplier'
    `);

    await this.renameEnumValue(queryRunner, 'ops_admin', 'admin');
    await this.renameEnumValue(queryRunner, 'client', 'customer');

    await queryRunner.query(`
      ALTER TABLE "users"
      ALTER COLUMN "role" SET DEFAULT 'customer'::"public"."users_role_enum"
    `);
  }

  private async renameEnumValue(
    queryRunner: QueryRunner,
    from: string,
    to: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_type regtype;
      BEGIN
        SELECT a.atttypid::regtype
        INTO enum_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'users'
          AND a.attname = 'role'
          AND NOT a.attisdropped;

        IF enum_type IS NULL THEN
          RETURN;
        END IF;

        IF EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = enum_type::oid AND enumlabel = '${from}'
        )
        AND NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = enum_type::oid AND enumlabel = '${to}'
        ) THEN
          EXECUTE format(
            'ALTER TYPE %s RENAME VALUE %L TO %L',
            enum_type,
            '${from}',
            '${to}'
          );
        ELSIF EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = enum_type::oid AND enumlabel = '${from}'
        )
        AND EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = enum_type::oid AND enumlabel = '${to}'
        ) THEN
          EXECUTE format(
            'UPDATE %I SET %I = %L WHERE %I = %L',
            'users',
            'role',
            '${to}',
            'role',
            '${from}'
          );
        END IF;
      END $$;
    `);
  }

  private async addEnumValueIfMissing(
    queryRunner: QueryRunner,
    value: string,
  ): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        enum_type regtype;
      BEGIN
        SELECT a.atttypid::regtype
        INTO enum_type
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = 'users'
          AND a.attname = 'role'
          AND NOT a.attisdropped;

        IF enum_type IS NULL THEN
          RETURN;
        END IF;

        IF NOT EXISTS (
          SELECT 1 FROM pg_enum
          WHERE enumtypid = enum_type::oid AND enumlabel = '${value}'
        ) THEN
          EXECUTE format(
            'ALTER TYPE %s ADD VALUE %L',
            enum_type,
            '${value}'
          );
        END IF;
      END $$;
    `);
  }
}
