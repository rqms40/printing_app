import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProofOfDelivery1777853300000 implements MigrationInterface {
  name = 'AddProofOfDelivery1777853300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_proof_type_enum') THEN
          CREATE TYPE "delivery_proof_type_enum" AS ENUM ('photo', 'signature');
        END IF;
      END
      $$;
    `);
    if (!(await queryRunner.hasTable('delivery_assignments'))) {
      return;
    }
    const columns = [
      ['proof_type', '"delivery_proof_type_enum"'],
      ['proof_file_id', 'int'],
      ['proof_object_key', 'varchar'],
      ['proof_signature_data', 'text'],
      ['proof_captured_at', 'timestamp'],
      ['proof_captured_by_rider_id', 'int'],
    ] as const;
    for (const [column, type] of columns) {
      if (!(await queryRunner.hasColumn('delivery_assignments', column))) {
        await queryRunner.query(
          `ALTER TABLE "delivery_assignments" ADD COLUMN "${column}" ${type}`,
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('delivery_assignments')) {
      await queryRunner.query(`
        ALTER TABLE "delivery_assignments"
        DROP COLUMN IF EXISTS "proof_captured_by_rider_id",
        DROP COLUMN IF EXISTS "proof_captured_at",
        DROP COLUMN IF EXISTS "proof_signature_data",
        DROP COLUMN IF EXISTS "proof_object_key",
        DROP COLUMN IF EXISTS "proof_file_id",
        DROP COLUMN IF EXISTS "proof_type"
      `);
    }
    await queryRunner.query(`
      DROP TYPE IF EXISTS "delivery_proof_type_enum"
    `);
  }
}
