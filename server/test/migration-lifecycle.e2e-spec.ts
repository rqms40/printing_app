import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { databaseOptionsFromEnv } from '../src/database/data-source';

type CountRow = { count: number };

describe('production migration lifecycle (e2e)', () => {
  jest.setTimeout(120_000);

  const createdDatabases = new Set<string>();
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
    for (const database of [...createdDatabases]) {
      await dropDatabase(database);
    }
  });

  afterAll(async () => {
    await admin.end();
  });

  it('preserves populated paper and 3D specification tables during adoption', async () => {
    const database = await createDatabase('adoption_data');
    await createSynchronizedFixture(database, true);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();

      await expect(tableExists(dataSource, 'paper_specs')).resolves.toBe(true);
      await expect(tableExists(dataSource, 'three_d_specs')).resolves.toBe(
        true,
      );
      await expect(rowCount(dataSource, 'paper_specs')).resolves.toBe(1);
      await expect(rowCount(dataSource, 'three_d_specs')).resolves.toBe(1);
    } finally {
      await dataSource.destroy();
    }
  });

  it('fully reverts and reapplies a baseline-owned empty database', async () => {
    const database = await createDatabase('owned_lifecycle');
    const dataSource = await initializeMigrationDataSource(database);

    try {
      const firstRun = await dataSource.runMigrations();
      expect(firstRun.length).toBeGreaterThan(0);
      await expect(dataSource.runMigrations()).resolves.toHaveLength(0);

      await undoAllMigrations(dataSource);

      await expect(tableExists(dataSource, 'users')).resolves.toBe(false);
      await expect(tableExists(dataSource, 'paper_specs')).resolves.toBe(false);
      await expect(tableExists(dataSource, 'three_d_specs')).resolves.toBe(
        false,
      );

      const reapplied = await dataSource.runMigrations();
      expect(reapplied.length).toBe(firstRun.length);
      await expect(tableExists(dataSource, 'users')).resolves.toBe(true);
      await expect(tableExists(dataSource, 'paper_specs')).resolves.toBe(true);
      await expect(tableExists(dataSource, 'three_d_specs')).resolves.toBe(
        true,
      );
    } finally {
      await dataSource.destroy();
    }
  });

  it('makes a full migration revert non-destructive for adopted schemas', async () => {
    const database = await createDatabase('adoption_revert');
    await createSynchronizedFixture(database, true);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      await undoAllMigrations(dataSource);

      await expect(tableExists(dataSource, 'users')).resolves.toBe(true);
      await expect(tableExists(dataSource, 'paper_specs')).resolves.toBe(true);
      await expect(tableExists(dataSource, 'three_d_specs')).resolves.toBe(
        true,
      );
      await expect(rowCount(dataSource, 'paper_specs')).resolves.toBe(1);
      await expect(rowCount(dataSource, 'three_d_specs')).resolves.toBe(1);
      await expect(
        dataSource.query(
          `SELECT ownership FROM gridgo_schema_baseline WHERE migration_name = $1`,
          ['CurrentSchemaBaseline1700000000000'],
        ),
      ).resolves.toEqual([{ ownership: 'adopted' }]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('rejects users-only schemas and accepts completely migrated schemas before seed', async () => {
    const usersOnlyDatabase = await createDatabase('users_only');
    const usersOnly = new Client({
      ...adminConfig,
      database: usersOnlyDatabase,
    });
    await usersOnly.connect();
    await usersOnly.query(`CREATE TABLE users (id integer PRIMARY KEY)`);
    await usersOnly.query(`INSERT INTO users (id) VALUES (1)`);
    await usersOnly.end();

    const rejected = runSeedGuard(usersOnlyDatabase);
    expect(rejected.status).not.toBe(0);
    expect(`${rejected.stdout}\n${rejected.stderr}`).toContain(
      'Run npm run migration:run before seeding',
    );

    const migratedDatabase = await createDatabase('seed_ready');
    const dataSource = await initializeMigrationDataSource(migratedDatabase);
    await dataSource.runMigrations();
    await dataSource.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2)`,
      ['migration-seed-check@example.test', 'not-used'],
    );
    await dataSource.destroy();

    const accepted = runSeedGuard(migratedDatabase);
    expect(accepted.status).toBe(0);
    expect(accepted.stdout).toContain('seed skipped');
  });

  async function createDatabase(label: string): Promise<string> {
    const database = `gridgo_${label}_${process.pid}_${createdDatabases.size}`;
    if (!/^[a-z0-9_]+$/.test(database)) {
      throw new Error('Unsafe test database identifier');
    }
    await admin.query(`CREATE DATABASE "${database}"`);
    createdDatabases.add(database);
    return database;
  }

  async function dropDatabase(database: string): Promise<void> {
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [database],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    createdDatabases.delete(database);
  }

  function optionsForDatabase(database: string): DataSourceOptions {
    return {
      ...databaseOptionsFromEnv({
        ...process.env,
        DATABASE_HOST: adminConfig.host,
        DATABASE_PORT: String(adminConfig.port),
        DATABASE_NAME: database,
        DATABASE_USER: adminConfig.user,
        DATABASE_PASSWORD: adminConfig.password,
      }),
      logging: false,
    };
  }

  async function initializeMigrationDataSource(
    database: string,
  ): Promise<DataSource> {
    const dataSource = new DataSource(optionsForDatabase(database));
    await dataSource.initialize();
    return dataSource;
  }

  async function createSynchronizedFixture(
    database: string,
    withLegacyRows: boolean,
  ): Promise<void> {
    const dataSource = new DataSource({
      ...optionsForDatabase(database),
      migrations: [],
      synchronize: true,
    });
    await dataSource.initialize();

    if (withLegacyRows) {
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2) RETURNING id`,
        [`migration-adoption-${database}@example.test`, 'not-used'],
      );
      const [paperOrder] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO orders
           (order_id, user_id, category, total_price, delivery_fee, payment_method)
         VALUES ($1, $2, 'paper', 10, 0, 'cash') RETURNING id`,
        [`PAPER-${database}`, user.id],
      );
      const [threeDOrder] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO orders
           (order_id, user_id, category, total_price, delivery_fee, payment_method)
         VALUES ($1, $2, '3d', 20, 0, 'cash') RETURNING id`,
        [`3D-${database}`, user.id],
      );

      await dataSource.query(
        `INSERT INTO paper_specs
           (order_id, paper_size, color_mode, media_type, print_sides, binding)
         VALUES ($1, 'A4', 'color', 'plain', 'single', 'none')`,
        [paperOrder.id],
      );
      await dataSource.query(
        `INSERT INTO three_d_specs
           (order_id, file_format, material, color, infill_percentage, layer_height, supports)
         VALUES ($1, 'stl', 'pla', 'white', 20, 0.20, false)`,
        [threeDOrder.id],
      );
    }

    await dataSource.destroy();
  }

  async function undoAllMigrations(dataSource: DataSource): Promise<void> {
    const [row] = await dataSource.query<CountRow[]>(
      `SELECT count(*)::int AS count FROM migrations`,
    );
    for (let remaining = row.count; remaining > 0; remaining -= 1) {
      await dataSource.undoLastMigration();
    }
  }

  async function tableExists(
    dataSource: DataSource,
    table: string,
  ): Promise<boolean> {
    const queryRunner = dataSource.createQueryRunner();
    try {
      return await queryRunner.hasTable(table);
    } finally {
      await queryRunner.release();
    }
  }

  async function rowCount(
    dataSource: DataSource,
    table: 'paper_specs' | 'three_d_specs',
  ): Promise<number> {
    const [row] = await dataSource.query<CountRow[]>(
      `SELECT count(*)::int AS count FROM "${table}"`,
    );
    return row.count;
  }

  function runSeedGuard(database: string) {
    return spawnSync(process.execPath, ['scripts/seed-if-empty.mjs'], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_HOST: adminConfig.host,
        DATABASE_PORT: String(adminConfig.port),
        DATABASE_NAME: database,
        DATABASE_USER: adminConfig.user,
        DATABASE_PASSWORD: adminConfig.password,
        JWT_SECRET: 'test-only',
      },
    });
  }
});
