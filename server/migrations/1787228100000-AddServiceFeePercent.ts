import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddServiceFeePercent1787228100000 implements MigrationInterface {
  name = 'AddServiceFeePercent1787228100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_settings"
        ADD COLUMN IF NOT EXISTS "service_fee_percent" numeric(5,2) NOT NULL DEFAULT '0'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_settings"
        DROP COLUMN IF EXISTS "service_fee_percent"
    `);
  }
}
