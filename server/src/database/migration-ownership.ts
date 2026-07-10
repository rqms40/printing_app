import type { QueryRunner } from 'typeorm';

export const BASELINE_MIGRATION_NAME = 'CurrentSchemaBaseline1700000000000';
export const BASELINE_METADATA_TABLE = 'gridgo_schema_baseline';

export type BaselineOwnership = 'owned' | 'adopted';

export async function recordBaselineOwnership(
  queryRunner: QueryRunner,
  ownership: BaselineOwnership,
): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "${BASELINE_METADATA_TABLE}" (
      "migration_name" varchar(255) PRIMARY KEY,
      "ownership" varchar(20) NOT NULL CHECK ("ownership" IN ('owned', 'adopted')),
      "recorded_at" timestamptz NOT NULL DEFAULT now()
    )
  `);
  await queryRunner.query(
    `INSERT INTO "${BASELINE_METADATA_TABLE}" ("migration_name", "ownership")
     VALUES ($1, $2)
     ON CONFLICT ("migration_name") DO UPDATE
     SET "ownership" = EXCLUDED."ownership"`,
    [BASELINE_MIGRATION_NAME, ownership],
  );
}

export async function getBaselineOwnership(
  queryRunner: QueryRunner,
): Promise<BaselineOwnership | null> {
  if (!(await queryRunner.hasTable(BASELINE_METADATA_TABLE))) {
    return null;
  }
  const rows = (await queryRunner.query(
    `SELECT "ownership"
     FROM "${BASELINE_METADATA_TABLE}"
     WHERE "migration_name" = $1`,
    [BASELINE_MIGRATION_NAME],
  )) as Array<{ ownership: BaselineOwnership }>;
  return rows[0]?.ownership ?? null;
}

export async function isAdoptedSchema(
  queryRunner: QueryRunner,
): Promise<boolean> {
  return (await getBaselineOwnership(queryRunner)) === 'adopted';
}
