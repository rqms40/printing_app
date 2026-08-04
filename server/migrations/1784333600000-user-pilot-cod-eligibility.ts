import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 3 Task 3.2:
 * User-level pilot COD verification flag + ops risk block.
 */
export class UserPilotCodEligibility1784333600000
  implements MigrationInterface
{
  name = 'UserPilotCodEligibility1784333600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('users'))) {
      return;
    }

    if (!(await queryRunner.hasColumn('users', 'pilot_cod_eligible'))) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "pilot_cod_eligible" boolean NOT NULL DEFAULT false
      `);
    }

    if (!(await queryRunner.hasColumn('users', 'cod_ops_risk_blocked'))) {
      await queryRunner.query(`
        ALTER TABLE "users"
        ADD COLUMN "cod_ops_risk_blocked" boolean NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    if (!(await queryRunner.hasTable('users'))) {
      return;
    }

    if (await queryRunner.hasColumn('users', 'cod_ops_risk_blocked')) {
      await queryRunner.query(`
        ALTER TABLE "users" DROP COLUMN "cod_ops_risk_blocked"
      `);
    }

    if (await queryRunner.hasColumn('users', 'pilot_cod_eligible')) {
      await queryRunner.query(`
        ALTER TABLE "users" DROP COLUMN "pilot_cod_eligible"
      `);
    }
  }
}
