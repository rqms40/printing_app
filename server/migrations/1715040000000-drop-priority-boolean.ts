import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPriorityBoolean1715040000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('batch_orders')) &&
      (await queryRunner.hasColumn('batch_orders', 'priority'))
    ) {
      await queryRunner.query(`
        ALTER TABLE batch_orders DROP COLUMN priority
      `);
    }
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('batch_orders'))) {
      return;
    }
    if (!(await queryRunner.hasColumn('batch_orders', 'priority'))) {
      await queryRunner.query(`
        ALTER TABLE batch_orders ADD COLUMN priority BOOLEAN NOT NULL DEFAULT FALSE
      `);
    }
    if (await queryRunner.hasColumn('batch_orders', 'speed_tier')) {
      await queryRunner.query(`
        UPDATE batch_orders SET priority = TRUE WHERE speed_tier = 'priority'
      `);
    }
  }
}
