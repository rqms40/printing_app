import type { QueryRunner } from 'typeorm';
import { SuperAdminConfig1784333900000 } from '../../migrations/1784333900000-super-admin-config';

describe('SuperAdminConfig1784333900000', () => {
  function createQueryRunner(tables: string[] = []) {
    const queries: string[] = [];
    const queryRunner = {
      hasTable: jest.fn(async (name: string) => tables.includes(name)),
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        // column existence probe for rider_profiles
        if (sql.includes('information_schema.columns')) {
          return [];
        }
        return [];
      }),
    } as unknown as QueryRunner;
    return { queryRunner, queries };
  }

  it('creates geo_zones, commerce settings, and rider verification columns', async () => {
    const { queryRunner, queries } = createQueryRunner(['rider_profiles']);

    await new SuperAdminConfig1784333900000().up(queryRunner);

    const sql = queries.join('\n');
    expect(sql).toContain('CREATE TABLE "geo_zones"');
    expect(sql).toContain('CREATE TABLE "platform_commerce_settings"');
    expect(sql).toContain('rider_verification_status_enum');
    expect(sql).toContain('verification_status');
    expect(sql).toContain('davao_city_core');
    expect(sql).toContain('toril');
  });
});
