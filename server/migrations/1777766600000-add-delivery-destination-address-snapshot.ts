import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeliveryDestinationAddressSnapshot1777766600000 implements MigrationInterface {
  name = 'AddDeliveryDestinationAddressSnapshot1777766600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('delivery_destinations'))) {
      return;
    }
    if (await queryRunner.hasColumn('delivery_destinations', 'address_id')) {
      await queryRunner.query(`
        ALTER TABLE "delivery_destinations"
        ALTER COLUMN "address_id" DROP NOT NULL
      `);
    }
    const columns = [
      ['full_address', 'text'],
      ['barangay', 'varchar(100)'],
      ['city', 'varchar(100)'],
      ['province', 'varchar(100)'],
      ['zip_code', 'varchar(10)'],
      ['landmark', 'text'],
      ['latitude', 'numeric(10,7)'],
      ['longitude', 'numeric(10,7)'],
    ] as const;
    for (const [column, type] of columns) {
      if (!(await queryRunner.hasColumn('delivery_destinations', column))) {
        await queryRunner.query(
          `ALTER TABLE "delivery_destinations" ADD COLUMN "${column}" ${type}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('delivery_destinations'))) {
      return;
    }
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
    if (await queryRunner.hasColumn('delivery_destinations', 'address_id')) {
      await queryRunner.query(`
        ALTER TABLE "delivery_destinations"
        ALTER COLUMN "address_id" SET NOT NULL
      `);
    }
  }
}
