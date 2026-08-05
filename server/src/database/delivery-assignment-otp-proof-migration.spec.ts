import type { QueryRunner } from 'typeorm';
import { DeliveryAssignmentOtpProof1784333700000 } from '../../migrations/1784333700000-delivery-assignment-otp-proof';

describe('DeliveryAssignmentOtpProof1784333700000', () => {
  function createQueryRunner(opts: {
    hasTable?: boolean;
    existingColumns?: string[];
    ownership?: string;
  } = {}) {
    const {
      hasTable = true,
      existingColumns = [],
      ownership = 'baseline',
    } = opts;
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async () => hasTable),
      hasColumn: jest.fn(async (_table: string, column: string) =>
        existingColumns.includes(column),
      ),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('ownership') || sql.includes('schema_ownership')) {
          return [{ ownership }];
        }
        return [];
      }),
    } as unknown as QueryRunner;
    return { queryRunner, queries };
  }

  it('adds pickup/delivery OTP and pickup proof columns', async () => {
    const { queryRunner, queries } = createQueryRunner();

    await new DeliveryAssignmentOtpProof1784333700000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('"pickup_otp_hash"');
    expect(sql).toContain('"pickup_otp_code"');
    expect(sql).toContain('"delivery_otp_hash"');
    expect(sql).toContain('"delivery_otp_code"');
    expect(sql).toContain('"pickup_proof_file_id"');
    expect(sql).toContain('"pickup_proof_object_key"');
  });

  it('is idempotent when columns already exist', async () => {
    const { queryRunner, queries } = createQueryRunner({
      existingColumns: [
        'pickup_otp_hash',
        'pickup_otp_code',
        'pickup_otp_verified_at',
        'delivery_otp_hash',
        'delivery_otp_code',
        'delivery_otp_verified_at',
        'pickup_proof_file_id',
        'pickup_proof_object_key',
        'pickup_proof_signature_data',
        'pickup_proof_captured_at',
      ],
    });

    await new DeliveryAssignmentOtpProof1784333700000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });

  it('skips when delivery_assignments table is missing', async () => {
    const { queryRunner, queries } = createQueryRunner({ hasTable: false });

    await new DeliveryAssignmentOtpProof1784333700000().up(queryRunner);

    expect(queries).toHaveLength(0);
  });
});
