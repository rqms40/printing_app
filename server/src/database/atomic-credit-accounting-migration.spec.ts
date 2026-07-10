import { QueryRunner } from 'typeorm';
import { AtomicCreditAccounting1777853500000 } from '../../migrations/1777853500000-atomic-credit-accounting';

describe('AtomicCreditAccounting1777853500000', () => {
  it('converges legacy beta ledgers and creates only the refund partial unique index', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await new AtomicCreditAccounting1777853500000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain('BETA-ENROLLMENT:');
    expect(sql).toContain('transaction_record.user_id::text');
    expect(sql).toContain('SET reference_id = NULL');
    expect(sql).toContain('beta_credits_granted = true');
    expect(sql).toContain('INSERT INTO credit_transactions');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).not.toContain('UPDATE users SET credits');
    expect(sql).toContain('uq_credit_transactions_refund_reference');
    expect(sql).toContain("reference_id LIKE 'ORDER-REFUND:%'");
    expect(sql).toContain("reference_id LIKE 'BATCH-REFUND:%'");
  });
});
