import { MigrationInterface, QueryRunner } from 'typeorm';

const previousRole = ['dri', 'ver'].join('');
const currentRole = 'rider';

function assignedStatus(role: string): string {
  return `${role}_assigned`;
}

function profileTable(role: string): string {
  return `${role}_profiles`;
}

function assignedOrderColumn(role: string): string {
  return `assigned_${role}_id`;
}

function assignmentColumn(role: string): string {
  return `${role}_id`;
}

function assignmentIndex(role: string): string {
  return `idx_delivery_assignments_${role}`;
}

async function renameTable(
  queryRunner: QueryRunner,
  from: string,
  to: string,
): Promise<void> {
  await queryRunner.query(`
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL
        AND to_regclass('public.${to}') IS NULL THEN
        ALTER TABLE "${from}" RENAME TO "${to}";
      END IF;
    END $$;
  `);
}

async function renameColumn(
  queryRunner: QueryRunner,
  table: string,
  from: string,
  to: string,
): Promise<void> {
  await queryRunner.query(`
    DO $$
    BEGIN
      IF to_regclass('public.${table}') IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${table}'
            AND column_name = '${from}'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${table}'
            AND column_name = '${to}'
        ) THEN
        ALTER TABLE "${table}" RENAME COLUMN "${from}" TO "${to}";
      END IF;
    END $$;
  `);
}

async function renameIndex(
  queryRunner: QueryRunner,
  from: string,
  to: string,
): Promise<void> {
  await queryRunner.query(`
    DO $$
    BEGIN
      IF to_regclass('public.${from}') IS NOT NULL
        AND to_regclass('public.${to}') IS NULL THEN
        ALTER INDEX "${from}" RENAME TO "${to}";
      END IF;
    END $$;
  `);
}

async function renameMatchingConstraints(
  queryRunner: QueryRunner,
  tables: string[],
  from: string,
  to: string,
): Promise<void> {
  const tableRefs = tables.map((table) => `'public.${table}'`).join(', ');

  await queryRunner.query(`
    DO $$
    DECLARE
      item record;
      next_name text;
    BEGIN
      FOR item IN
        SELECT conrelid AS relid, conrelid::regclass AS table_name, conname
        FROM pg_constraint
        WHERE conrelid IN (
          SELECT to_regclass(table_name)
          FROM unnest(ARRAY[${tableRefs}]) AS names(table_name)
          WHERE to_regclass(table_name) IS NOT NULL
        )
          AND conname LIKE '%' || '${from}' || '%'
      LOOP
        next_name := replace(item.conname, '${from}', '${to}');

        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conrelid = item.relid
            AND conname = next_name
        ) THEN
          EXECUTE format(
            'ALTER TABLE %s RENAME CONSTRAINT %I TO %I',
            item.table_name,
            item.conname,
            next_name
          );
        END IF;
      END LOOP;
    END $$;
  `);
}

async function renameEnumValue(
  queryRunner: QueryRunner,
  table: string,
  column: string,
  from: string,
  to: string,
): Promise<void> {
  await queryRunner.query(`
    DO $$
    DECLARE
      enum_type regtype;
    BEGIN
      IF to_regclass('public.${table}') IS NOT NULL THEN
        SELECT a.atttypid::regtype
        INTO enum_type
        FROM pg_attribute a
        WHERE a.attrelid = 'public.${table}'::regclass
          AND a.attname = '${column}'
          AND NOT a.attisdropped;

        IF enum_type IS NOT NULL THEN
          IF EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = enum_type::oid
              AND enumlabel = '${from}'
          )
          AND NOT EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = enum_type::oid
              AND enumlabel = '${to}'
          ) THEN
            EXECUTE format(
              'ALTER TYPE %s RENAME VALUE %L TO %L',
              enum_type,
              '${from}',
              '${to}'
            );
          ELSIF EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = enum_type::oid
              AND enumlabel = '${from}'
          )
          AND EXISTS (
            SELECT 1
            FROM pg_enum
            WHERE enumtypid = enum_type::oid
              AND enumlabel = '${to}'
          ) THEN
            EXECUTE format(
              'UPDATE %I SET %I = %L WHERE %I = %L',
              '${table}',
              '${column}',
              '${to}',
              '${column}',
              '${from}'
            );
          END IF;
        END IF;
      END IF;
    END $$;
  `);
}

async function renameSchemaTerms(
  queryRunner: QueryRunner,
  from: string,
  to: string,
): Promise<void> {
  await renameEnumValue(queryRunner, 'users', 'role', from, to);
  await renameEnumValue(
    queryRunner,
    'orders',
    'order_status',
    assignedStatus(from),
    assignedStatus(to),
  );
  await renameTable(queryRunner, profileTable(from), profileTable(to));
  await renameColumn(
    queryRunner,
    'orders',
    assignedOrderColumn(from),
    assignedOrderColumn(to),
  );
  await renameColumn(
    queryRunner,
    'delivery_assignments',
    assignmentColumn(from),
    assignmentColumn(to),
  );
  await renameIndex(queryRunner, assignmentIndex(from), assignmentIndex(to));
  await renameMatchingConstraints(
    queryRunner,
    ['orders', 'delivery_assignments', profileTable(to)],
    from,
    to,
  );
}

export class RiderTerminologyRename1777853200000
  implements MigrationInterface
{
  name = 'RiderTerminologyRename1777853200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await renameSchemaTerms(queryRunner, previousRole, currentRole);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await renameSchemaTerms(queryRunner, currentRole, previousRole);
  }
}
