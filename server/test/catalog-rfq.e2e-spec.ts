import { Client } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { databaseOptionsFromEnv } from '../src/database/data-source';
import {
  lockRfqCatalog,
  resolveArtworkInLockOrder,
} from '../src/orders/rfq-locking';

describe('catalog RFQ PostgreSQL locks (e2e)', () => {
  jest.setTimeout(120_000);
  const created = new Set<string>();
  const adminConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: process.env.DATABASE_NAME ?? 'grid_print',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
  };
  const admin = new Client(adminConfig);

  beforeAll(async () => {
    await admin.connect();
  });
  afterEach(async () => {
    for (const database of [...created]) await dropDatabase(database);
  });
  afterAll(async () => {
    await admin.end();
  });

  it('executes the join-free category/spec/option lock path in a transaction', async () => {
    const dataSource = await initializeDatabase(await createDatabase('graph'));
    try {
      await seedCatalog(dataSource);
      const result = await dataSource.transaction((manager) =>
        lockRfqCatalog(manager, [
          'rfq-round-flyers',
          'rfq-round-apparel',
          'rfq-round-flyers',
        ]),
      );
      expect([...result.keys()].sort()).toEqual([
        'rfq-round-apparel',
        'rfq-round-flyers',
      ]);
      expect(result.get('rfq-round-flyers')?.specs[0].options[0].value).toBe(
        'a5',
      );
    } finally {
      await dataSource.destroy();
    }
  });

  it('serializes reversed artwork inputs without deadlock and rolls back failures', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('concurrency'),
    );
    try {
      await dataSource.query(
        'CREATE TABLE rfq_lock_files (id int PRIMARY KEY, touches int NOT NULL DEFAULT 0)',
      );
      await dataSource.query(
        'INSERT INTO rfq_lock_files (id) VALUES (41), (42)',
      );
      const submit = (ids: number[], fail = false) =>
        dataSource.transaction(async (manager) => {
          await manager.query("SET LOCAL lock_timeout = '5s'");
          const resolved = await resolveArtworkInLockOrder(
            ids.map((fileMetadataId) => ({
              fileMetadataId,
              categorySlug: 'flyers',
            })),
            async ({ fileMetadataId }) => {
              await manager.query(
                'SELECT id FROM rfq_lock_files WHERE id = $1 FOR UPDATE',
                [fileMetadataId],
              );
              await manager.query(
                'UPDATE rfq_lock_files SET touches = touches + 1 WHERE id = $1',
                [fileMetadataId],
              );
              return fileMetadataId;
            },
          );
          if (fail) throw new Error('rollback fixture');
          return [...resolved.keys()];
        });

      await expect(
        Promise.all([submit([41, 42]), submit([42, 41])]),
      ).resolves.toEqual([
        [41, 42],
        [41, 42],
      ]);
      await expect(submit([42, 41], true)).rejects.toThrow('rollback fixture');
      await expect(
        dataSource.query('SELECT id, touches FROM rfq_lock_files ORDER BY id'),
      ).resolves.toEqual([
        { id: 41, touches: 2 },
        { id: 42, touches: 2 },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  function options(database: string): DataSourceOptions {
    return databaseOptionsFromEnv({
      ...process.env,
      DATABASE_HOST: adminConfig.host,
      DATABASE_PORT: String(adminConfig.port),
      DATABASE_NAME: database,
      DATABASE_USER: adminConfig.user,
      DATABASE_PASSWORD: adminConfig.password,
    });
  }
  async function initializeDatabase(database: string) {
    const dataSource = new DataSource(options(database));
    await dataSource.initialize();
    await dataSource.runMigrations();
    return dataSource;
  }
  async function createDatabase(label: string) {
    const database = `gridgo_rfq_${label}_${process.pid}_${created.size}`;
    await admin.query(`CREATE DATABASE "${database}"`);
    created.add(database);
    return database;
  }
  async function dropDatabase(database: string) {
    await admin.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    created.delete(database);
  }
  async function seedCatalog(dataSource: DataSource) {
    await dataSource.query(`
      INSERT INTO product_categories
        (id, name, slug, pricing_model, base_rate, is_active)
      VALUES
        (900001, 'Apparel', 'rfq-round-apparel', 'quote_required', 0, true),
        (900002, 'Flyers', 'rfq-round-flyers', 'quote_required', 0, true)
    `);
    await dataSource.query(`
      INSERT INTO product_spec_definitions
        (id, category_id, key, label, input_type, value_type, is_required, is_active)
      VALUES (900003, 900002, 'size', 'Size', 'select', 'string', true, true)
    `);
    await dataSource.query(`
      INSERT INTO product_spec_options
        (id, spec_definition_id, label, value, is_active)
      VALUES (900004, 900003, 'A5', 'a5', true)
    `);
  }
});
