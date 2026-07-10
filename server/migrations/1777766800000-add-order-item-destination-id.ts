import { MigrationInterface, QueryRunner } from 'typeorm';
import { isAdoptedSchema } from '../src/database/migration-ownership';

export class AddOrderItemDestinationId1777766800000 implements MigrationInterface {
  name = 'AddOrderItemDestinationId1777766800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('order_items'))) {
      return;
    }
    if (!(await queryRunner.hasColumn('order_items', 'destination_id'))) {
      await queryRunner.query(`
        ALTER TABLE "order_items" ADD COLUMN "destination_id" int
      `);
    }
    if (!(await queryRunner.hasTable('delivery_destinations'))) {
      return;
    }
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint constraint_record
          JOIN pg_attribute column_record
            ON column_record.attrelid = constraint_record.conrelid
            AND column_record.attnum = ANY (constraint_record.conkey)
          WHERE constraint_record.contype = 'f'
            AND constraint_record.conrelid = 'public.order_items'::regclass
            AND constraint_record.confrelid = 'public.delivery_destinations'::regclass
            AND column_record.attname = 'destination_id'
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
    if (await isAdoptedSchema(queryRunner)) return;

    if (!(await queryRunner.hasTable('order_items'))) {
      return;
    }
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
