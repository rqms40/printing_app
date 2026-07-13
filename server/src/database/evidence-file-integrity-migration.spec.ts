import { QueryRunner } from 'typeorm';
import { EvidenceFileIntegrity1777853800000 } from '../../migrations/1777853800000-evidence-file-integrity';

describe('EvidenceFileIntegrity1777853800000', () => {
  it('sanitizes dangling references before adding restrictive file foreign keys', async () => {
    const queryRunner = {
      query: jest.fn().mockResolvedValue([]),
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
    } as unknown as QueryRunner;

    await new EvidenceFileIntegrity1777853800000().up(queryRunner);

    const sql = (queryRunner.query as jest.Mock).mock.calls
      .map(([statement]) => String(statement))
      .join('\n');
    expect(sql).toContain('UPDATE "delivery_assignments"');
    expect(sql).toContain('SET "proof_file_id" = NULL');
    expect(sql).toContain('UPDATE "users"');
    expect(sql).toContain('SET "beta_photo_file_id" = NULL');
    expect(sql).toContain('UPDATE "orders"');
    expect(sql).toContain('UPDATE "order_items"');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).toContain('FK_delivery_assignments_proof_file');
    expect(sql).toContain('FK_users_beta_photo_file');
    expect(sql).toContain('FK_orders_file_metadata');
    expect(sql).toContain('FK_order_items_file_metadata');
  });

  it('only removes constraints from baseline-owned schemas on rollback', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([{ ownership: 'adopted' }])
      .mockResolvedValue([]);
    const queryRunner = {
      query,
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
    } as unknown as QueryRunner;

    await new EvidenceFileIntegrity1777853800000().down(queryRunner);

    expect(query).toHaveBeenCalledTimes(1);
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('DROP CONSTRAINT'),
    );
  });
});
