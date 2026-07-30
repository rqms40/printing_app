import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

export class AddMarketingNotificationImageUrl1784160000000 implements MigrationInterface {
  name = 'AddMarketingNotificationImageUrl1784160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (
      (await queryRunner.hasTable('marketing_notifications')) &&
      !(await queryRunner.hasColumn('marketing_notifications', 'image_url'))
    ) {
      await queryRunner.query(
        `ALTER TABLE "marketing_notifications" ADD COLUMN "image_url" varchar(2048)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;

    if (await queryRunner.hasTable('marketing_notifications')) {
      await queryRunner.query(
        `ALTER TABLE "marketing_notifications" DROP COLUMN IF EXISTS "image_url"`,
      );
    }
  }
}
