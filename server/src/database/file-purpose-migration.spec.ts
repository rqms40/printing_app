import { QueryRunner } from 'typeorm';
import { FilePurposeAndDeliveryCompletion1777853700000 } from '../../migrations/1777853700000-file-purpose-and-delivery-completion';

describe('FilePurposeAndDeliveryCompletion1777853700000', () => {
  it('normalizes adopted purposes and classifies only recognized object prefixes', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
      query,
    } as unknown as QueryRunner;

    await new FilePurposeAndDeliveryCompletion1777853700000().up(queryRunner);

    const sql = query.mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain('file_metadata_purpose_enum');
    expect(sql).toContain("'proof_of_delivery'");
    expect(sql).toContain("'beta_testimonial'");
    expect(sql).toContain("'paper'");
    expect(sql).toContain("'general'");
    expect(sql).toContain("'legacy'");
    expect(sql).toContain('uploads/proof_of_delivery/%');
    expect(sql).toContain('uploads/proof-of-delivery/%');
    expect(sql).toContain('uploads/beta_testimonial/%');
    expect(sql).toContain('purpose::text');
    expect(sql).toContain('SET NOT NULL');
    expect(sql).toContain("SET DEFAULT 'general'");
  });

  it('fails closed on down for an adopted schema', async () => {
    const query = jest.fn().mockResolvedValueOnce([{ ownership: 'adopted' }]);
    const queryRunner = {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
      query,
    } as unknown as QueryRunner;

    await new FilePurposeAndDeliveryCompletion1777853700000().down(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][0]).toContain('SELECT "ownership"');
  });
});
