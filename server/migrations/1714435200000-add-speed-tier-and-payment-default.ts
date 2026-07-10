import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSpeedTierAndPaymentDefault1714435200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('batch_orders')) {
      if (!(await queryRunner.hasColumn('batch_orders', 'speed_tier'))) {
        await queryRunner.query(`
          ALTER TABLE batch_orders
          ADD COLUMN speed_tier VARCHAR(20) NOT NULL DEFAULT 'standard'
        `);
      }
      if (await queryRunner.hasColumn('batch_orders', 'priority_fee')) {
        await queryRunner.query(`
          UPDATE batch_orders
          SET speed_tier = 'priority'
          WHERE priority_fee > 0
        `);
      }
    }
    if (
      (await queryRunner.hasTable('users')) &&
      !(await queryRunner.hasColumn('users', 'default_payment_method'))
    ) {
      await queryRunner.query(`
        ALTER TABLE users
        ADD COLUMN default_payment_method VARCHAR(20)
      `);
    }
    if (
      (await queryRunner.hasTable('delivery_slot_templates')) &&
      !(await queryRunner.hasColumn('delivery_slot_templates', 'allows_pickup'))
    ) {
      await queryRunner.query(`
        ALTER TABLE delivery_slot_templates
        ADD COLUMN allows_pickup BOOLEAN NOT NULL DEFAULT TRUE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('delivery_slot_templates')) {
      await queryRunner.query(`
        ALTER TABLE delivery_slot_templates DROP COLUMN IF EXISTS allows_pickup
      `);
    }
    if (await queryRunner.hasTable('users')) {
      await queryRunner.query(`
        ALTER TABLE users DROP COLUMN IF EXISTS default_payment_method
      `);
    }
    if (await queryRunner.hasTable('batch_orders')) {
      await queryRunner.query(`
        ALTER TABLE batch_orders DROP COLUMN IF EXISTS speed_tier
      `);
    }
  }
}
