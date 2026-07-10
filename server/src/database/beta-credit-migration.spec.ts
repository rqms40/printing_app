import { QueryRunner } from 'typeorm';
import { BetaCreditLedgerAndRankIndex1777853400000 } from '../../migrations/1777853400000-beta-credit-ledger-and-rank-index';

describe('BetaCreditLedgerAndRankIndex1777853400000', () => {
  it('deduplicates only beta references and creates partial ledger/rank indexes', async () => {
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
      query: jest.fn().mockResolvedValue(undefined),
    } as unknown as QueryRunner;

    await new BetaCreditLedgerAndRankIndex1777853400000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain('ROW_NUMBER() OVER');
    expect(sql).toContain("reference_id LIKE 'BETA-ENROLLMENT:%'");
    expect(sql).toContain('SET reference_id = NULL');
    expect(sql).toContain('uq_credit_transactions_beta_enrollment_reference');
    expect(sql).toContain('idx_users_beta_enrollment_rank');
    expect(sql).toContain('beta_enrolled_at, id');
  });
});
