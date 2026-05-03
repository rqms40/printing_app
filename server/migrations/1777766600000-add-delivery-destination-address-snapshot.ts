import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryDestinationAddressSnapshot1777766600000 implements MigrationInterface {
  name = 'AddDeliveryDestinationAddressSnapshot1777766600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "delivery_destinations"
      ALTER COLUMN "address_id" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_destinations"
      ADD COLUMN IF NOT EXISTS "full_address" text,
      ADD COLUMN IF NOT EXISTS "barangay" varchar(100),
      ADD COLUMN IF NOT EXISTS "city" varchar(100),
      ADD COLUMN IF NOT EXISTS "province" varchar(100),
      ADD COLUMN IF NOT EXISTS "zip_code" varchar(10),
      ADD COLUMN IF NOT EXISTS "landmark" text,
      ADD COLUMN IF NOT EXISTS "latitude" numeric(10,7),
      ADD COLUMN IF NOT EXISTS "longitude" numeric(10,7)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM "delivery_destinations" WHERE "address_id" IS NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_destinations"
      DROP COLUMN IF EXISTS "longitude",
      DROP COLUMN IF EXISTS "latitude",
      DROP COLUMN IF EXISTS "landmark",
      DROP COLUMN IF EXISTS "zip_code",
      DROP COLUMN IF EXISTS "province",
      DROP COLUMN IF EXISTS "city",
      DROP COLUMN IF EXISTS "barangay",
      DROP COLUMN IF EXISTS "full_address"
    `);
    await queryRunner.query(`
      ALTER TABLE "delivery_destinations"
      ALTER COLUMN "address_id" SET NOT NULL
    `);
  }
}
