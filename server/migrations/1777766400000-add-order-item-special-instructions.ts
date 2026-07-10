import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderItemSpecialInstructions1777766400000 implements MigrationInterface {
  name = 'AddOrderItemSpecialInstructions1777766400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('order_items')) &&
      !(await queryRunner.hasColumn('order_items', 'special_instructions'))
    ) {
      await queryRunner.query(
        `ALTER TABLE "order_items" ADD COLUMN "special_instructions" text`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('order_items')) {
      await queryRunner.query(
        `ALTER TABLE "order_items" DROP COLUMN IF EXISTS "special_instructions"`,
      );
    }
  }
}
