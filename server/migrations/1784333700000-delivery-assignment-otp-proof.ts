import { MigrationInterface, QueryRunner } from 'typeorm';
import { isBaselineOwned } from '../src/database/migration-ownership';

/**
 * Marketplace Phase 7 Task 7.1:
 * Pickup / delivery OTP hashes+codes and pickup photo proof columns.
 */
export class DeliveryAssignmentOtpProof1784333700000
  implements MigrationInterface
{
  name = 'DeliveryAssignmentOtpProof1784333700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('delivery_assignments'))) {
      return;
    }

    const columns: Array<[string, string]> = [
      ['pickup_otp_hash', 'character varying(64)'],
      ['pickup_otp_code', 'character varying(8)'],
      ['pickup_otp_verified_at', 'TIMESTAMP'],
      ['delivery_otp_hash', 'character varying(64)'],
      ['delivery_otp_code', 'character varying(8)'],
      ['delivery_otp_verified_at', 'TIMESTAMP'],
      ['pickup_proof_file_id', 'integer'],
      ['pickup_proof_object_key', 'character varying'],
      ['pickup_proof_signature_data', 'text'],
      ['pickup_proof_captured_at', 'TIMESTAMP'],
    ];

    for (const [column, type] of columns) {
      if (!(await queryRunner.hasColumn('delivery_assignments', column))) {
        await queryRunner.query(`
          ALTER TABLE "delivery_assignments"
          ADD COLUMN "${column}" ${type}
        `);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await isBaselineOwned(queryRunner))) return;
    if (!(await queryRunner.hasTable('delivery_assignments'))) return;

    for (const column of [
      'pickup_proof_captured_at',
      'pickup_proof_signature_data',
      'pickup_proof_object_key',
      'pickup_proof_file_id',
      'delivery_otp_verified_at',
      'delivery_otp_code',
      'delivery_otp_hash',
      'pickup_otp_verified_at',
      'pickup_otp_code',
      'pickup_otp_hash',
    ]) {
      if (await queryRunner.hasColumn('delivery_assignments', column)) {
        await queryRunner.query(`
          ALTER TABLE "delivery_assignments" DROP COLUMN "${column}"
        `);
      }
    }
  }
}
