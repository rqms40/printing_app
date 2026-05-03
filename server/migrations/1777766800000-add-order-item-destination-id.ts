import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrderItemDestinationId1777766800000 implements MigrationInterface {
  name = 'AddOrderItemDestinationId1777766800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items"
      ADD COLUMN IF NOT EXISTS "destination_id" int
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'fk_order_items_destination_id'
        ) THEN
          ALTER TABLE "order_items"
          ADD CONSTRAINT "fk_order_items_destination_id"
          FOREIGN KEY ("destination_id")
          REFERENCES "delivery_destinations"("id")
          ON DELETE SET NULL;
        END IF;
      END
      $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "order_items"
      DROP CONSTRAINT IF EXISTS "fk_order_items_destination_id"
    `);
    await queryRunner.query(`
      ALTER TABLE "order_items"
      DROP COLUMN IF EXISTS "destination_id"
    `);
  }
}
