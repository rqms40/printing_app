import { MigrationInterface, QueryRunner } from 'typeorm';

const INDEX_NAME = 'uq_users_fcm_token';
const METADATA_TABLE = 'gridgo_schema_baseline';
const MIGRATION_NAME = 'UniqueFcmTokenOwnership1777854200000';

export class UniqueFcmTokenOwnership1777854200000 implements MigrationInterface {
  name = 'UniqueFcmTokenOwnership1777854200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) return;

    const table = await queryRunner.getTable('users');
    const existing = table?.indices.find((index) => index.name === INDEX_NAME);
    if (existing) {
      const where = existing.where?.replace(/\s+/g, ' ').trim();
      const compatibleWhere =
        where === '"fcm_token" IS NOT NULL' ||
        where === '(fcm_token IS NOT NULL)';
      if (
        !existing.isUnique ||
        existing.columnNames.length !== 1 ||
        existing.columnNames[0] !== 'fcm_token' ||
        !compatibleWhere
      ) {
        throw new Error(
          'incompatible adopted FCM token ownership index; refusing migration',
        );
      }
      await this.recordOwnership(queryRunner, 'adopted');
      return;
    }

    // PostgreSQL B-tree entries have a page-size bound. Legacy endpoints did
    // not validate token size, so clear values that cannot be indexed safely.
    await queryRunner.query(`
      UPDATE "users"
      SET "fcm_token" = NULL
      WHERE "fcm_token" IS NOT NULL
        AND octet_length("fcm_token") > 2048
    `);

    // The legacy schema has no trustworthy token-registration timestamp.
    // Ambiguous duplicates must therefore fail closed for every prior owner;
    // an active client will safely re-register after migration.
    await queryRunner.query(`
      WITH duplicate_tokens AS (
        SELECT "fcm_token"
        FROM "users"
        WHERE "fcm_token" IS NOT NULL
        GROUP BY "fcm_token"
        HAVING COUNT(*) > 1
      )
      UPDATE "users"
      SET "fcm_token" = NULL
      WHERE "fcm_token" IN (SELECT "fcm_token" FROM duplicate_tokens)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "${INDEX_NAME}"
      ON "users" ("fcm_token")
      WHERE "fcm_token" IS NOT NULL
    `);
    await this.recordOwnership(queryRunner, 'owned');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) return;
    const ownership = await this.getOwnership(queryRunner);
    if (ownership === null) {
      // Ownership is unknown, so fail closed by preserving the privacy index.
      // This matches the repository's non-destructive partial-revert policy.
      return;
    }
    if (ownership === 'adopted') {
      await this.clearOwnership(queryRunner);
      return;
    }

    const table = await queryRunner.getTable('users');
    if (table?.indices.some((index) => index.name === INDEX_NAME)) {
      await queryRunner.query(`DROP INDEX "${INDEX_NAME}"`);
    }
    await this.clearOwnership(queryRunner);
  }

  private async recordOwnership(
    queryRunner: QueryRunner,
    ownership: 'owned' | 'adopted',
  ): Promise<void> {
    if (!(await queryRunner.hasTable(METADATA_TABLE))) {
      throw new Error(
        'missing schema ownership table; refusing FCM token migration',
      );
    }
    await queryRunner.query(
      `INSERT INTO "${METADATA_TABLE}" ("migration_name", "ownership")
       VALUES ($1, $2)
       ON CONFLICT ("migration_name") DO UPDATE
       SET "ownership" = EXCLUDED."ownership"`,
      [MIGRATION_NAME, ownership],
    );
  }

  private async getOwnership(
    queryRunner: QueryRunner,
  ): Promise<'owned' | 'adopted' | null> {
    if (!(await queryRunner.hasTable(METADATA_TABLE))) return null;
    const rows = (await queryRunner.query(
      `SELECT "ownership" FROM "${METADATA_TABLE}"
       WHERE "migration_name" = $1`,
      [MIGRATION_NAME],
    )) as Array<{ ownership: 'owned' | 'adopted' }>;
    return rows[0]?.ownership ?? null;
  }

  private async clearOwnership(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "${METADATA_TABLE}" WHERE "migration_name" = $1`,
      [MIGRATION_NAME],
    );
  }
}
