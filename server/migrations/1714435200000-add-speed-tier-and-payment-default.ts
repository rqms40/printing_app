import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpeedTierAndPaymentDefault1714435200000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE batch_orders
      ADD COLUMN IF NOT EXISTS speed_tier VARCHAR(20) NOT NULL DEFAULT 'standard'
    `);
    await queryRunner.query(`
      UPDATE batch_orders
      SET speed_tier = 'priority'
      WHERE priority_fee > 0
    `);
    await queryRunner.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS default_payment_method VARCHAR(20)
    `);
    await queryRunner.query(`
      ALTER TABLE delivery_slot_templates
      ADD COLUMN IF NOT EXISTS allows_pickup BOOLEAN NOT NULL DEFAULT TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE delivery_slot_templates DROP COLUMN IF EXISTS allows_pickup
    `);
    await queryRunner.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS default_payment_method
    `);
    await queryRunner.query(`
      ALTER TABLE batch_orders DROP COLUMN IF EXISTS speed_tier
    `);
  }
}
