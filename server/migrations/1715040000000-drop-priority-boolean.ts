import { MigrationInterface, QueryRunner } from 'typeorm';

export class DropPriorityBoolean1715040000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE batch_orders DROP COLUMN IF EXISTS priority
    `);
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE batch_orders ADD COLUMN priority BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      UPDATE batch_orders SET priority = TRUE WHERE speed_tier = 'priority'
    `);
  }
}
