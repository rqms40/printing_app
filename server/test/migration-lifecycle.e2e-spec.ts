import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { databaseOptionsFromEnv } from '../src/database/data-source';

type CountRow = { count: number };
type LegacyCatalogRelationshipRow = {
  addon_name: string;
  product_id: number;
  product_slug: string;
};
type ProductCategoryRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  base_rate: string;
  allowed_extensions: string[];
  file_processing_type: string;
  pricing_model: string;
};
type CategoryForeignKeyRow = {
  constraint_name: string;
  referenced_table: string;
  delete_action: string;
};
type LegacySpecRelationshipRow = {
  option_group: string;
  option_value: string;
  category_slug: string;
};

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

  it('adopts a populated legacy catalog and remaps addons by category slug', async () => {
    const database = await createDatabase('legacy_catalog');
    await createSynchronizedFixture(database, false);
    await createLegacyCatalogFixture(database);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();

      await expect(rowCount(dataSource, 'service_categories')).resolves.toBe(2);
      await expect(rowCount(dataSource, 'spec_options')).resolves.toBe(2);
      await expect(rowCount(dataSource, 'service_addons')).resolves.toBe(2);

      const productCategories = await dataSource.query<ProductCategoryRow[]>(
        `SELECT id, slug, name, description, icon, base_rate,
                allowed_extensions, file_processing_type, pricing_model
         FROM product_categories
         WHERE slug IN ('paper', 'legacy-3d')
         ORDER BY slug`,
      );
      expect(productCategories).toEqual([
        expect.objectContaining({
          slug: 'legacy-3d',
          name: 'Legacy 3D Printing',
          description: 'Historical model printing',
          icon: 'legacy-model-icon',
          base_rate: '50.00',
          allowed_extensions: ['stl', 'obj'],
          file_processing_type: 'model_3d',
          pricing_model: 'base_plus_material_estimate',
        }),
        expect.objectContaining({
          id: 100,
          slug: 'paper',
          name: 'Current Paper Name',
          description: 'Historical document printing',
          icon: 'legacy-paper-icon',
          base_rate: '99.00',
          allowed_extensions: ['pdf', 'png'],
        }),
      ]);

      const relationships = await dataSource.query<
        LegacyCatalogRelationshipRow[]
      >(
        `SELECT addon.name AS addon_name,
                  category.id AS product_id,
                  category.slug AS product_slug
           FROM service_addons addon
           JOIN product_categories category ON category.id = addon.category_id
           ORDER BY addon.name`,
      );
      expect(relationships).toEqual([
        {
          addon_name: 'Legacy Lamination',
          product_id: 100,
          product_slug: 'paper',
        },
        expect.objectContaining({
          addon_name: 'Legacy Model Cleanup',
          product_slug: 'legacy-3d',
        }),
      ]);

      const legacySpecRelationships = await dataSource.query<
        LegacySpecRelationshipRow[]
      >(
        `SELECT option_record.option_group,
                  option_record.value AS option_value,
                  category.slug AS category_slug
           FROM spec_options option_record
           JOIN service_categories category
             ON category.id = option_record.category_id
           ORDER BY option_record.option_group`,
      );
      expect(legacySpecRelationships).toEqual([
        {
          option_group: 'material',
          option_value: 'pla',
          category_slug: 'legacy-3d',
        },
        {
          option_group: 'paper_size',
          option_value: 'a4',
          category_slug: 'paper',
        },
      ]);

      const foreignKeys = await dataSource.query<CategoryForeignKeyRow[]>(
        `SELECT constraint_record.conname AS constraint_name,
                referenced_table.relname AS referenced_table,
                constraint_record.confdeltype AS delete_action
         FROM pg_constraint constraint_record
         JOIN pg_class referenced_table
           ON referenced_table.oid = constraint_record.confrelid
         JOIN pg_attribute column_record
           ON column_record.attrelid = constraint_record.conrelid
          AND column_record.attnum = ANY (constraint_record.conkey)
         WHERE constraint_record.contype = 'f'
           AND constraint_record.conrelid = 'public.service_addons'::regclass
           AND column_record.attname = 'category_id'`,
      );
      expect(foreignKeys).toEqual([
        {
          constraint_name: 'FK_service_addons_product_category',
          referenced_table: 'product_categories',
          delete_action: 'n',
        },
      ]);
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

  it('fails closed when ownership metadata is missing during a partial revert', async () => {
    for (const metadataState of ['missing-table', 'missing-row'] as const) {
      const database = await createDatabase(
        `unknown_${metadataState.replace('-', '_')}`,
      );
      const dataSource = await initializeMigrationDataSource(database);

      try {
        await dataSource.runMigrations();
        if (metadataState === 'missing-table') {
          await dataSource.query(`DROP TABLE gridgo_schema_baseline`);
        } else {
          await dataSource.query(`DELETE FROM gridgo_schema_baseline`);
        }

        await dataSource.undoLastMigration();

        await expect(
          columnExists(dataSource, 'delivery_assignments', 'proof_type'),
        ).resolves.toBe(true);
        await expect(
          columnExists(
            dataSource,
            'delivery_assignments',
            'proof_captured_by_rider_id',
          ),
        ).resolves.toBe(true);
      } finally {
        await dataSource.destroy();
      }
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

  async function createLegacyCatalogFixture(database: string): Promise<void> {
    const dataSource = await initializeMigrationDataSource(database);
    try {
      await dataSource.query(`
        DO $$
        DECLARE
          category_fk record;
        BEGIN
          FOR category_fk IN
            SELECT constraint_record.conname
            FROM pg_constraint constraint_record
            JOIN pg_attribute column_record
              ON column_record.attrelid = constraint_record.conrelid
             AND column_record.attnum = ANY (constraint_record.conkey)
            WHERE constraint_record.contype = 'f'
              AND constraint_record.conrelid = 'public.service_addons'::regclass
              AND column_record.attname = 'category_id'
          LOOP
            EXECUTE format(
              'ALTER TABLE service_addons DROP CONSTRAINT %I',
              category_fk.conname
            );
          END LOOP;
        END $$
      `);
      await dataSource.query(`
        ALTER TABLE service_addons
        ADD CONSTRAINT "FK_2f041a59cfc5c4b85b2f04708d4"
        FOREIGN KEY (category_id)
        REFERENCES service_categories(id)
        ON DELETE SET NULL
      `);

      await dataSource.query(`
        INSERT INTO product_categories (
          id, name, slug, description, mobile_description, icon,
          file_processing_type, pricing_model, base_rate, quantity_unit,
          max_file_size_mb, allowed_extensions, is_active, sort_order
        ) VALUES
          (7, 'Unrelated Existing Category', 'existing-seven', NULL, NULL, NULL,
           'generic_file', 'per_page_modifiers', 7, 'item',
           25, '["bin"]'::jsonb, true, 7),
          (100, 'Current Paper Name', 'paper', NULL, NULL, NULL,
           'document', 'per_page_modifiers', 99, 'copy',
           75, '[]'::jsonb, true, 50)
      `);
      await dataSource.query(`
        INSERT INTO service_categories (
          id, name, slug, description, icon, base_rate, max_file_size_mb,
          allowed_extensions, is_active, sort_order
        ) VALUES
          (7, 'Legacy Paper Printing', 'paper',
           'Historical document printing', 'legacy-paper-icon', 2, 50,
           '["pdf","png"]', true, 1),
          (9, 'Legacy 3D Printing', 'legacy-3d',
           'Historical model printing', 'legacy-model-icon', 50, 200,
           '["stl","obj"]', true, 2)
      `);
      await dataSource.query(`
        INSERT INTO spec_options (
          category_id, option_group, label, value, multiplier, fixed_fee,
          unit_cost, is_default, is_active, sort_order
        ) VALUES
          (7, 'paper_size', 'A4', 'a4', 1, 0, 0, true, true, 1),
          (9, 'material', 'PLA', 'pla', 1, 0, 1.5, true, true, 1)
      `);
      await dataSource.query(`
        INSERT INTO service_addons (
          category_id, name, description, price, price_type, is_active,
          sort_order
        ) VALUES
          (7, 'Legacy Lamination', 'Protective finish', 20, 'per_unit', true, 1),
          (9, 'Legacy Model Cleanup', 'Remove supports', 75, 'flat', true, 2)
      `);
    } finally {
      await dataSource.destroy();
    }
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

  async function columnExists(
    dataSource: DataSource,
    table: string,
    column: string,
  ): Promise<boolean> {
    const queryRunner = dataSource.createQueryRunner();
    try {
      return await queryRunner.hasColumn(table, column);
    } finally {
      await queryRunner.release();
    }
  }

  async function rowCount(
    dataSource: DataSource,
    table:
      | 'paper_specs'
      | 'three_d_specs'
      | 'service_categories'
      | 'spec_options'
      | 'service_addons',
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
