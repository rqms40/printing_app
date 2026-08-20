import { MatchingPreference1786516700000 } from '../../migrations/1786516700000-matching-preference';

describe('MatchingPreference1786516700000', () => {
  it('adds matching preference and preferred supplier columns', async () => {
    const queries: string[] = [];
    const queryRunner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        return [];
      }),
    } as any;

    await new MatchingPreference1786516700000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('matching_preference_enum');
    expect(sql).toContain('matching_preference');
    expect(sql).toContain('preferred_supplier_id');
  });
});
