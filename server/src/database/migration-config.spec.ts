import { ConfigService } from '@nestjs/config';
import { createTypeOrmOptions } from './typeorm.config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('createTypeOrmOptions migration configuration', () => {
  it('registers migrations and disables production synchronization', () => {
    const config = new ConfigService({ NODE_ENV: 'production' });

    const options = createTypeOrmOptions(config);

    expect(options.synchronize).toBe(false);
    expect(options.migrations).toEqual([
      expect.stringContaining('migrations/*{.ts,.js}'),
    ]);
  });

  it('enables synchronization only when explicitly requested', () => {
    const defaultOptions = createTypeOrmOptions(
      new ConfigService({ NODE_ENV: 'development' }),
    );
    const optedInOptions = createTypeOrmOptions(
      new ConfigService({
        NODE_ENV: 'development',
        DATABASE_SYNCHRONIZE: 'true',
      }),
    );

    expect(defaultOptions.synchronize).toBe(false);
    expect(optedInOptions.synchronize).toBe(true);
  });

  it('requires the latest dispatch-plan migration before seeding', () => {
    const seedGuard = readFileSync(
      join(process.cwd(), 'scripts', 'seed-if-empty.mjs'),
      'utf8',
    );

    expect(seedGuard).toContain("timestamp: '1777853900000'");
    expect(seedGuard).toContain("name: 'PersistedDispatchPlans1777853900000'");
  });
});
