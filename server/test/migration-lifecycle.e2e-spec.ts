import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { Client } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { CreditsService } from '../src/credits/credits.service';
import { CreditTransaction } from '../src/credits/entities/credit-transaction.entity';
import { CreditSettings } from '../src/credits/entities/credit-settings.entity';
import { UsersService } from '../src/users/users.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { FirebaseService } from '../src/firebase/firebase.service';
import { NotificationsGateway } from '../src/notifications/notifications.gateway';
import { User } from '../src/users/entities/user.entity';
import { CATALOG_V1_10_GROUPS } from '../src/products/catalog-v1-10.definition';

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
type CatalogCounts = {
  active_groups: number;
  active_quote_products: number;
  active_legacy_products: number;
  categories: number;
  specs: number;
  options: number;
  duplicate_categories: number;
  duplicate_specs: number;
  duplicate_options: number;
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

  it('adopts multiple pending per-order survey requirements for one user', async () => {
    const database = await createDatabase('per_order_pending_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, role, is_beta_user)
         VALUES ($1, 'not-used', 'client', true)
         RETURNING id`,
        [`pending-adoption-${database}@example.test`],
      );
      const orders = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO orders
           (order_id, user_id, category, total_price, delivery_fee,
            payment_method, delivery_option)
         VALUES
           ($1, $3, 'paper', 10, 0, 'gridCredits', 'delivery'),
           ($2, $3, 'paper', 10, 0, 'gridCredits', 'delivery')
         RETURNING id`,
        [`PENDING-A-${database}`, `PENDING-B-${database}`, user.id],
      );
      await dataSource.query(
        `INSERT INTO tam_survey_requirements
           (user_id, order_id, reason, status, required_at)
         VALUES
           ($1, $2, 'post_delivery', 'pending', NOW()),
           ($1, $3, 'post_delivery', 'pending', NOW())`,
        [user.id, orders[0].id, orders[1].id],
      );

      await dataSource.runMigrations();

      await expect(
        dataSource.query<Array<{ count: number }>>(
          `SELECT count(*)::int AS count
           FROM tam_survey_requirements
           WHERE user_id = $1 AND status = 'pending'`,
          [user.id],
        ),
      ).resolves.toEqual([{ count: 2 }]);
      await expect(
        dataSource.query<Array<{ indexname: string }>>(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname = 'public'
             AND indexname IN (
               'uq_tam_survey_requirements_user_pending',
               'uq_tam_survey_requirements_order_reason'
             )
           ORDER BY indexname`,
        ),
      ).resolves.toEqual([
        { indexname: 'uq_tam_survey_requirements_order_reason' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('deduplicates adopted FCM tokens and enforces exclusive device ownership', async () => {
    const database = await createDatabase('fcm_token_ownership_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.query(`DROP INDEX IF EXISTS "uq_users_fcm_token"`);
      const users = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, fcm_token)
         VALUES
           ($1, 'not-used', 'shared-device-token'),
           ($2, 'not-used', 'shared-device-token')
         RETURNING id`,
        [
          `fcm-owner-a-${database}@example.test`,
          `fcm-owner-b-${database}@example.test`,
        ],
      );
      const [oversizedUser] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, fcm_token)
         VALUES ($1, 'not-used', $2)
         RETURNING id`,
        [
          `fcm-oversized-${database}@example.test`,
          'oversized-device-token-'.repeat(160),
        ],
      );

      await dataSource.runMigrations();

      await expect(
        dataSource.query(
          `SELECT id, fcm_token FROM users
           WHERE id = ANY($1::int[])
           ORDER BY id`,
          [users.map((user) => user.id)],
        ),
      ).resolves.toEqual([
        { id: users[0].id, fcm_token: null },
        { id: users[1].id, fcm_token: null },
      ]);
      await expect(
        dataSource.query(`SELECT fcm_token FROM users WHERE id = $1`, [
          oversizedUser.id,
        ]),
      ).resolves.toEqual([{ fcm_token: null }]);
      await expect(
        dataSource.query(
          `SELECT indexdef FROM pg_indexes
           WHERE schemaname = 'public' AND indexname = 'uq_users_fcm_token'`,
        ),
      ).resolves.toEqual([
        {
          indexdef: expect.stringMatching(
            /CREATE UNIQUE INDEX .* ON public\.users.*fcm_token.*IS NOT NULL/i,
          ),
        },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('preserves a compatible adopted FCM ownership index on rollback', async () => {
    const database = await createDatabase('fcm_token_index_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      await dataSource.undoLastMigration();

      await expect(
        dataSource.query(
          `SELECT to_regclass('public.uq_users_fcm_token') IS NOT NULL
             AS index_preserved`,
        ),
      ).resolves.toEqual([{ index_preserved: true }]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('serializes concurrent cross-device FCM token swaps without deadlock', async () => {
    const database = await createDatabase('fcm_token_concurrent_swap');
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      const users = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, 'not-used'), ($2, 'not-used')
         RETURNING id`,
        [
          `fcm-swap-a-${database}@example.test`,
          `fcm-swap-b-${database}@example.test`,
        ],
      );
      const service = new UsersService(
        dataSource.getRepository(User),
        dataSource,
      );
      await service.updateFcmToken(users[0].id, 'device-token-a');
      await service.updateFcmToken(users[1].id, 'device-token-b');

      await expect(
        Promise.all([
          service.updateFcmToken(users[0].id, 'device-token-b'),
          service.updateFcmToken(users[1].id, 'device-token-a'),
        ]),
      ).resolves.toEqual([undefined, undefined]);
      await expect(
        dataSource.query(
          `SELECT id, fcm_token FROM users
           WHERE id = ANY($1::int[])
           ORDER BY id`,
          [users.map((user) => user.id)],
        ),
      ).resolves.toEqual([
        { id: users[0].id, fcm_token: 'device-token-b' },
        { id: users[1].id, fcm_token: 'device-token-a' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('adopts file purposes without treating ambiguous rows as proof or testimonial files', async () => {
    const database = await createDatabase('file_purpose_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.query(`
        ALTER TABLE file_metadata ALTER COLUMN purpose DROP DEFAULT;
        ALTER TABLE file_metadata ALTER COLUMN purpose DROP NOT NULL;
        ALTER TABLE file_metadata
          ALTER COLUMN purpose TYPE varchar USING purpose::text
      `);
      await dataSource.query(`
        INSERT INTO file_metadata
          (original_name, mime_type, size, url, object_key, purpose)
        VALUES
          ('explicit-general.png', 'image/png', 10, 'https://files/1',
           'uploads/beta_testimonial/explicit.png', 'general'),
          ('proof.png', 'image/png', 10, 'https://files/2',
           'uploads/proof_of_delivery/proof.png', NULL),
          ('legacy-proof.jpg', 'image/jpeg', 10, 'https://files/3',
           'uploads/proof-of-delivery/proof.jpg', NULL),
          ('testimonial.webp', 'image/webp', 10, 'https://files/4',
           'uploads/beta_testimonial/photo.webp', NULL),
          ('ambiguous.png', 'image/png', 10, 'https://files/5',
           'archive/customer/photo.png', NULL),
          ('normalized.png', 'image/png', 10, 'https://files/6',
           'archive/explicit/photo.png', ' proof-of-delivery ')
      `);

      await dataSource.runMigrations();

      await expect(
        dataSource.query<Array<{ original_name: string; purpose: string }>>(
          `SELECT original_name, purpose::text AS purpose
           FROM file_metadata
           ORDER BY id`,
        ),
      ).resolves.toEqual([
        { original_name: 'explicit-general.png', purpose: 'general' },
        { original_name: 'proof.png', purpose: 'proof_of_delivery' },
        { original_name: 'legacy-proof.jpg', purpose: 'proof_of_delivery' },
        { original_name: 'testimonial.webp', purpose: 'beta_testimonial' },
        { original_name: 'ambiguous.png', purpose: 'legacy' },
        { original_name: 'normalized.png', purpose: 'proof_of_delivery' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('sanitizes dangling file references and restricts deletion across every adopted reference surface', async () => {
    const database = await createDatabase('evidence_file_integrity');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      const users = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users
           (email, password_hash, role, beta_photo_file_id,
            beta_photo_uploaded_at, beta_shared_on_social)
         VALUES
           ($1, 'not-used', 'client', 900001, NOW(), true),
           ($2, 'not-used', 'rider', NULL, NULL, false)
         RETURNING id`,
        [
          `evidence-customer-${database}@example.test`,
          `evidence-rider-${database}@example.test`,
        ],
      );
      const [order] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO orders
           (order_id, user_id, category, file_url, file_name,
            file_metadata_id, total_price, delivery_fee, payment_method,
            delivery_option, order_status)
         VALUES
           ($1, $2, 'paper', 'https://audit/order', 'order-audit.pdf',
            900002, 10, 0, 'cash', 'delivery', 'out_for_delivery')
         RETURNING id`,
        [`EVIDENCE-${database}`, users[0].id],
      );
      const [orderItem] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO order_items
           (order_id, category, file_url, file_name, file_metadata_id,
            quantity, total_price)
         VALUES
           ($1, 'paper', 'https://audit/item', 'item-audit.pdf', 900003, 1, 10)
         RETURNING id`,
        [order.id],
      );
      const [rider] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO rider_profiles (user_id, vehicle_type, is_available)
         VALUES ($1, 'bike', true)
         RETURNING id`,
        [users[1].id],
      );
      const [assignment] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO delivery_assignments
           (order_id, rider_id, status, proof_type, proof_file_id,
            proof_object_key, proof_captured_at, proof_captured_by_rider_id)
         VALUES
           ($1, $2, 'arrived', 'photo', 900004,
            'uploads/proof_of_delivery/audit.png', NOW(), $3)
         RETURNING id`,
        [order.id, rider.id, users[1].id],
      );
      const [file] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO file_metadata
           (original_name, mime_type, size, url, object_key, purpose)
         VALUES
           ('evidence.png', 'image/png', 10, 'https://files/evidence',
            'uploads/proof_of_delivery/evidence.png', 'proof_of_delivery')
         RETURNING id`,
      );

      await dataSource.runMigrations();

      await expect(
        dataSource.query(
          `SELECT proof_file_id, proof_object_key,
                  proof_captured_by_rider_id
           FROM delivery_assignments WHERE id = $1`,
          [assignment.id],
        ),
      ).resolves.toEqual([
        {
          proof_file_id: null,
          proof_object_key: 'uploads/proof_of_delivery/audit.png',
          proof_captured_by_rider_id: users[1].id,
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT beta_photo_file_id, beta_photo_uploaded_at IS NOT NULL AS uploaded,
                  beta_shared_on_social
           FROM users WHERE id = $1`,
          [users[0].id],
        ),
      ).resolves.toEqual([
        {
          beta_photo_file_id: null,
          uploaded: false,
          beta_shared_on_social: false,
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT file_metadata_id, file_url, file_name
           FROM orders WHERE id = $1`,
          [order.id],
        ),
      ).resolves.toEqual([
        {
          file_metadata_id: null,
          file_url: 'https://audit/order',
          file_name: 'order-audit.pdf',
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT file_metadata_id, file_url, file_name
           FROM order_items WHERE id = $1`,
          [orderItem.id],
        ),
      ).resolves.toEqual([
        {
          file_metadata_id: null,
          file_url: 'https://audit/item',
          file_name: 'item-audit.pdf',
        },
      ]);

      const constraints = await dataSource.query<
        Array<{ constraint_name: string; delete_action: string }>
      >(
        `SELECT conname AS constraint_name, confdeltype AS delete_action
         FROM pg_constraint
         WHERE conname = ANY($1::text[])
         ORDER BY conname`,
        [
          [
            'FK_delivery_assignments_proof_file',
            'FK_users_beta_photo_file',
            'FK_orders_file_metadata',
            'FK_order_items_file_metadata',
          ],
        ],
      );
      expect(constraints).toEqual([
        {
          constraint_name: 'FK_delivery_assignments_proof_file',
          delete_action: 'r',
        },
        {
          constraint_name: 'FK_order_items_file_metadata',
          delete_action: 'r',
        },
        { constraint_name: 'FK_orders_file_metadata', delete_action: 'r' },
        { constraint_name: 'FK_users_beta_photo_file', delete_action: 'r' },
      ]);

      await dataSource.query(
        `UPDATE delivery_assignments SET proof_file_id = $1 WHERE id = $2`,
        [file.id, assignment.id],
      );
      await dataSource.query(
        `UPDATE users SET beta_photo_file_id = $1 WHERE id = $2`,
        [file.id, users[0].id],
      );
      await dataSource.query(
        `UPDATE orders SET file_metadata_id = $1 WHERE id = $2`,
        [file.id, order.id],
      );
      await dataSource.query(
        `UPDATE order_items SET file_metadata_id = $1 WHERE id = $2`,
        [file.id, orderItem.id],
      );
      await expect(
        dataSource.query(`DELETE FROM file_metadata WHERE id = $1`, [file.id]),
      ).rejects.toMatchObject({ code: '23503' });
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

  it('consolidates identical capabilities and restores asymmetric legacy activation through catalog up/down/up', async () => {
    const database = await createDatabase('catalog_v110_lifecycle');
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      await dataSource.undoLastMigration();
      await insertLegacyCatalogActivationFixture(dataSource);
      const capabilityIds = await insertCapabilityFixture(dataSource, [
        {
          productFamily: 'flyers',
          materials: ['matte'],
          maxCapacity: 10,
          leadTimeDays: 2,
        },
        {
          productFamily: 'flyers',
          materials: ['matte'],
          maxCapacity: 10,
          leadTimeDays: 2,
        },
      ]);

      await expect(dataSource.runMigrations()).resolves.toHaveLength(1);
      await expect(
        dataSource.query(
          `SELECT id, product_family
           FROM supplier_capabilities
           ORDER BY id`,
        ),
      ).resolves.toEqual([{ id: capabilityIds[0], product_family: 'flyers' }]);
      await expectCatalogCounts(dataSource, {
        active_groups: 4,
        active_quote_products: 17,
        active_legacy_products: 0,
        categories: 21,
        specs: 85,
        options: 2,
        duplicate_categories: 0,
        duplicate_specs: 0,
        duplicate_options: 0,
      });
      await expectStaleCatalogRowsDeactivated(dataSource);

      await dataSource.undoLastMigration();
      await expect(
        dataSource.query(
          `SELECT slug, is_active
           FROM product_categories
           WHERE slug IN ('paper', '3d')
           ORDER BY slug`,
        ),
      ).resolves.toEqual([
        { slug: '3d', is_active: false },
        { slug: 'paper', is_active: true },
      ]);

      await expect(dataSource.runMigrations()).resolves.toHaveLength(1);
      await expect(dataSource.showMigrations()).resolves.toBe(false);
      await expectCatalogCounts(dataSource, {
        active_groups: 4,
        active_quote_products: 17,
        active_legacy_products: 0,
        categories: 21,
        specs: 85,
        options: 2,
        duplicate_categories: 0,
        duplicate_specs: 0,
        duplicate_options: 0,
      });
      await expectStaleCatalogRowsDeactivated(dataSource);
    } finally {
      await dataSource.destroy();
    }
  });

  it('aborts catalog migration before deleting any capability when one duplicate pair conflicts', async () => {
    const database = await createDatabase('catalog_v110_conflict');
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      await dataSource.undoLastMigration();
      const ids = await insertCapabilityFixture(dataSource, [
        {
          productFamily: 'flyers',
          materials: ['matte'],
          maxCapacity: 10,
          leadTimeDays: 2,
        },
        {
          productFamily: 'flyers',
          materials: ['matte'],
          maxCapacity: 10,
          leadTimeDays: 2,
        },
        {
          productFamily: 'brochures',
          materials: ['matte'],
          maxCapacity: 5,
          leadTimeDays: 2,
        },
        {
          productFamily: 'brochures',
          materials: ['glossy'],
          maxCapacity: 25,
          leadTimeDays: 1,
        },
      ]);

      await expect(dataSource.runMigrations()).rejects.toThrow(
        `supplier_id=1, product_family="brochures", capability_ids=[${ids[2]}, ${ids[3]}]`,
      );
      await expect(
        dataSource.query(
          `SELECT id, product_family
           FROM supplier_capabilities
           ORDER BY id`,
        ),
      ).resolves.toEqual([
        { id: ids[0], product_family: 'flyers' },
        { id: ids[1], product_family: 'flyers' },
        { id: ids[2], product_family: 'brochures' },
        { id: ids[3], product_family: 'brochures' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('seeds and reseeds the exact catalog without duplicates or pending migrations', async () => {
    const database = await createDatabase('catalog_v110_seed');
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      const firstSeed = runSeed(database);
      expect(`${firstSeed.stdout}\n${firstSeed.stderr}`).toContain(
        'Seed complete!',
      );
      expect(firstSeed.status).toBe(0);

      const firstCounts = await catalogCounts(dataSource);
      expect(firstCounts).toEqual({
        active_groups: 4,
        active_quote_products: 17,
        active_legacy_products: 0,
        categories: 17,
        specs: 83,
        options: 0,
        duplicate_categories: 0,
        duplicate_specs: 0,
        duplicate_options: 0,
      });
      await expectExactCatalog(dataSource);
      await expectRfqDailyGrid(dataSource);

      const secondSeed = runSeed(database);
      expect(`${secondSeed.stdout}\n${secondSeed.stderr}`).toContain(
        'Seed complete!',
      );
      expect(secondSeed.status).toBe(0);
      await expect(catalogCounts(dataSource)).resolves.toEqual(firstCounts);
      await expectExactCatalog(dataSource);
      await expectRfqDailyGrid(dataSource);
      await expect(dataSource.showMigrations()).resolves.toBe(false);
    } finally {
      await dataSource.destroy();
    }
  });

  it('applies the beta ledger migration to adopted duplicate and null references without constraining order references', async () => {
    const database = await createDatabase('beta_ledger_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.query(`
        DROP INDEX IF EXISTS uq_credit_transactions_beta_enrollment_reference
      `);
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2) RETURNING id`,
        [`beta-ledger-adoption-${database}@example.test`, 'not-used'],
      );
      const [legacyGrantedUser] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (
           email, password_hash, credits, beta_credits_granted
         ) VALUES ($1, $2, 321, true) RETURNING id`,
        [`beta-ledger-legacy-${database}@example.test`, 'not-used'],
      );
      await dataSource.query(
        `INSERT INTO credit_transactions
           (user_id, type, "amountCredits", status, reference_id)
         VALUES
           ($1, 'top_up', 50, 'rejected', $2),
           ($1, 'top_up', 100, 'approved', $2),
           ($1, 'deduction', 10, 'approved', 'order_placed'),
           ($1, 'deduction', 10, 'approved', 'order_placed'),
           ($1, 'top_up', 5, 'approved', NULL),
           ($1, 'top_up', 100, 'approved', $3)`,
        [
          user.id,
          `BETA-ENROLLMENT:${user.id}`,
          `BETA-ENROLLMENT:${legacyGrantedUser.id}`,
        ],
      );

      await dataSource.runMigrations();

      const [references] = await dataSource.query<
        Array<{
          total: number;
          beta_references: number;
          order_references: number;
          null_references: number;
        }>
      >(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (
                  WHERE reference_id LIKE 'BETA-ENROLLMENT:%'
                )::int AS beta_references,
                COUNT(*) FILTER (
                  WHERE reference_id = 'order_placed'
                )::int AS order_references,
                COUNT(*) FILTER (
                  WHERE reference_id IS NULL
                )::int AS null_references
         FROM credit_transactions`,
      );
      expect(references).toEqual({
        total: 7,
        beta_references: 2,
        order_references: 2,
        null_references: 3,
      });
      await expect(
        dataSource.query(
          `SELECT user_id, type::text AS type, "amountCredits" AS amount,
                  status::text AS status, reference_id
           FROM credit_transactions
           WHERE reference_id = $1`,
          [`BETA-ENROLLMENT:${user.id}`],
        ),
      ).resolves.toEqual([
        {
          user_id: user.id,
          type: 'top_up',
          amount: '100.00',
          status: 'approved',
          reference_id: `BETA-ENROLLMENT:${user.id}`,
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT id, credits, beta_credits_granted
           FROM users
           WHERE id IN ($1, $2)
           ORDER BY id`,
          [user.id, legacyGrantedUser.id],
        ),
      ).resolves.toEqual([
        { id: user.id, credits: '0.00', beta_credits_granted: true },
        {
          id: legacyGrantedUser.id,
          credits: '321.00',
          beta_credits_granted: true,
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT
             to_regclass('public.uq_credit_transactions_beta_enrollment_reference') IS NOT NULL
               AS beta_ledger_index,
             to_regclass('public.idx_users_beta_enrollment_rank') IS NOT NULL
               AS beta_rank_index,
             to_regclass('public.uq_credit_transactions_refund_reference') IS NOT NULL
               AS refund_index`,
        ),
      ).resolves.toEqual([
        {
          beta_ledger_index: true,
          beta_rank_index: true,
          refund_index: true,
        },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('preserves legacy assignment audit rows while enforcing one current assignment', async () => {
    const database = await createDatabase('assignment_integrity_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.query(
        `DROP INDEX IF EXISTS uq_delivery_assignments_current_order`,
      );
      const users = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES
           ($1, 'not-used', 'client', true),
           ($2, 'not-used', 'rider', true),
           ($3, 'not-used', 'rider', true),
           ($4, 'not-used', 'rider', true)
         RETURNING id`,
        [
          `assignment-customer-${database}@example.test`,
          `assignment-rider-a-${database}@example.test`,
          `assignment-rider-b-${database}@example.test`,
          `assignment-rider-c-${database}@example.test`,
        ],
      );
      const [order] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO orders
           (order_id, user_id, category, total_price, delivery_fee,
            payment_method, order_status)
         VALUES ($1, $2, 'paper', 10, 0, 'cash', 'delivered')
         RETURNING id`,
        [`ASSIGNMENT-${database}`, users[0].id],
      );
      const riders = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO rider_profiles
           (user_id, vehicle_type, is_available)
         VALUES ($1, 'bike', true), ($2, 'bike', true), ($3, 'bike', true)
         RETURNING id`,
        [users[1].id, users[2].id, users[3].id],
      );
      await dataSource.query(
        `UPDATE orders SET assigned_rider_id = $1 WHERE id = $2`,
        [users[3].id, order.id],
      );
      await dataSource.query(
        `INSERT INTO delivery_assignments
           (order_id, rider_id, status, is_current, assigned_at,
            proof_type, proof_signature_data)
         VALUES
           ($1, $2, 'declined', true, '2026-01-01T00:00:00Z', NULL, NULL),
           ($1, $3, 'assigned', true, '2026-01-02T00:00:00Z', NULL, NULL),
           ($1, $4, 'delivered', true, '2026-01-03T00:00:00Z',
            'signature', 'legacy-proof')`,
        [order.id, riders[0].id, riders[1].id, riders[2].id],
      );

      await dataSource.runMigrations();

      await expect(
        dataSource.query(
          `SELECT status::text AS status, is_current, proof_signature_data
           FROM delivery_assignments
           WHERE order_id = $1
           ORDER BY assigned_at`,
          [order.id],
        ),
      ).resolves.toEqual([
        {
          status: 'declined',
          is_current: false,
          proof_signature_data: null,
        },
        {
          status: 'assigned',
          is_current: false,
          proof_signature_data: null,
        },
        {
          status: 'delivered',
          is_current: true,
          proof_signature_data: 'legacy-proof',
        },
      ]);
      await expect(
        dataSource.query(
          `INSERT INTO delivery_assignments
             (order_id, rider_id, status, is_current)
           VALUES ($1, $2, 'assigned', true)`,
          [order.id, riders[0].id],
        ),
      ).rejects.toMatchObject({ code: '23505' });
      await expect(
        dataSource.query(
          `INSERT INTO delivery_assignments
             (order_id, rider_id, status, is_current)
           VALUES ($1, $2, 'declined', false)`,
          [order.id, riders[0].id],
        ),
      ).resolves.toBeDefined();

      await dataSource.undoLastMigration();
      await expect(
        dataSource.query(
          `SELECT to_regclass(
             'public.uq_delivery_assignments_current_order'
           ) AS index_name`,
        ),
      ).resolves.toEqual([
        { index_name: 'uq_delivery_assignments_current_order' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('reconciles legacy current assignments from owning order state', async () => {
    const database = await createDatabase('assignment_state_reconciliation');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.query(
        `DROP INDEX IF EXISTS uq_delivery_assignments_current_order`,
      );
      const users = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, role, is_active)
         VALUES
           ($1, 'not-used', 'client', true),
           ($2, 'not-used', 'rider', true),
           ($3, 'not-used', 'rider', true),
           ($4, 'not-used', 'rider', true)
         RETURNING id`,
        [
          `state-customer-${database}@example.test`,
          `state-rider-a-${database}@example.test`,
          `state-rider-b-${database}@example.test`,
          `state-rider-c-${database}@example.test`,
        ],
      );
      const riders = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO rider_profiles
           (user_id, vehicle_type, is_available)
         VALUES ($1, 'bike', true), ($2, 'bike', true), ($3, 'bike', true)
         RETURNING id`,
        [users[1].id, users[2].id, users[3].id],
      );
      const insertOrder = async (
        reference: string,
        status: string,
        assignedRiderId: number | null = null,
      ): Promise<number> => {
        const [order] = await dataSource.query<Array<{ id: number }>>(
          `INSERT INTO orders
             (order_id, user_id, category, total_price, delivery_fee,
              payment_method, delivery_option, order_status,
              assigned_rider_id)
           VALUES ($1, $2, 'paper', 10, 0, 'cash', 'delivery', $3, $4)
           RETURNING id`,
          [reference, users[0].id, status, assignedRiderId],
        );
        return order.id;
      };
      const insertAssignment = async (
        orderId: number,
        riderId: number,
        status: string,
        assignedAt: string,
        proofSignatureData: string | null = null,
      ): Promise<void> => {
        await dataSource.query(
          `INSERT INTO delivery_assignments
             (order_id, rider_id, status, is_current, assigned_at,
              proof_type, proof_signature_data)
           VALUES ($1, $2, $3, true, $4,
             CASE WHEN $5::text IS NULL THEN NULL
                  ELSE 'signature'::delivery_proof_type_enum END,
             $5)`,
          [orderId, riderId, status, assignedAt, proofSignatureData],
        );
      };
      const insertRiderConversation = async (
        orderId: number,
        riderUserId: number,
        status: 'open' | 'assigned' = 'open',
      ): Promise<number> => {
        const [conversation] = await dataSource.query<Array<{ id: number }>>(
          `INSERT INTO chat_conversations
             (customer_id, type, order_id, assigned_rider_id, status)
           VALUES ($1, 'rider', $2, $3, $4)
           RETURNING id`,
          [users[0].id, orderId, riderUserId, status],
        );
        return conversation.id;
      };

      const orderIds = {
        ready: await insertOrder('STATE-READY', 'ready_for_dispatch'),
        cancelled: await insertOrder('STATE-CANCELLED', 'cancelled'),
        declined: await insertOrder('STATE-DECLINED', 'file_rejected'),
        pickup: await insertOrder('STATE-PICKUP', 'collected_by_customer'),
        delivered: await insertOrder('STATE-DELIVERED', 'delivered'),
        compatible: await insertOrder(
          'STATE-COMPATIBLE',
          'picked_up',
          users[1].id,
        ),
        exact: await insertOrder(
          'STATE-EXACT',
          'out_for_delivery',
          users[3].id,
        ),
      };

      await insertAssignment(
        orderIds.ready,
        riders[0].id,
        'assigned',
        '2026-01-01T00:00:00Z',
      );
      await insertAssignment(
        orderIds.cancelled,
        riders[0].id,
        'accepted',
        '2026-01-01T00:00:00Z',
      );
      await insertAssignment(
        orderIds.declined,
        riders[0].id,
        'picked_up',
        '2026-01-01T00:00:00Z',
      );
      await insertAssignment(
        orderIds.pickup,
        riders[0].id,
        'delivered',
        '2026-01-01T00:00:00Z',
        'pickup-proof',
      );
      await insertAssignment(
        orderIds.delivered,
        riders[0].id,
        'delivered',
        '2026-01-01T00:00:00Z',
        'delivered-proof',
      );
      await insertAssignment(
        orderIds.delivered,
        riders[1].id,
        'assigned',
        '2026-01-02T00:00:00Z',
      );
      await insertAssignment(
        orderIds.compatible,
        riders[1].id,
        'picked_up',
        '2026-01-01T00:00:00Z',
      );
      await insertAssignment(
        orderIds.compatible,
        riders[0].id,
        'assigned',
        '2026-01-02T00:00:00Z',
      );
      await insertAssignment(
        orderIds.exact,
        riders[2].id,
        'on_the_way',
        '2026-01-01T00:00:00Z',
      );
      await insertAssignment(
        orderIds.exact,
        riders[0].id,
        'on_the_way',
        '2026-01-02T00:00:00Z',
      );
      const chatIds = {
        ready: await insertRiderConversation(orderIds.ready, users[1].id),
        cancelled: await insertRiderConversation(
          orderIds.cancelled,
          users[1].id,
          'assigned',
        ),
        declined: await insertRiderConversation(orderIds.declined, users[1].id),
        pickup: await insertRiderConversation(orderIds.pickup, users[1].id),
        deliveredCurrent: await insertRiderConversation(
          orderIds.delivered,
          users[1].id,
        ),
        deliveredStale: await insertRiderConversation(
          orderIds.delivered,
          users[2].id,
          'assigned',
        ),
        compatibleCurrent: await insertRiderConversation(
          orderIds.compatible,
          users[2].id,
        ),
        compatibleStale: await insertRiderConversation(
          orderIds.compatible,
          users[1].id,
        ),
        exact: await insertRiderConversation(orderIds.exact, users[3].id),
      };
      await dataSource.query(
        `INSERT INTO chat_messages
           (conversation_id, sender_id, sender_role, content)
         VALUES ($1, $2, 'rider', 'preserved migration audit message')`,
        [chatIds.ready, users[1].id],
      );

      await dataSource.runMigrations();

      await expect(
        dataSource.query(
          `SELECT order_id, assigned_rider_id
           FROM orders
           WHERE order_id LIKE 'STATE-%'
           ORDER BY order_id`,
        ),
      ).resolves.toEqual([
        { order_id: 'STATE-CANCELLED', assigned_rider_id: null },
        {
          order_id: 'STATE-COMPATIBLE',
          assigned_rider_id: users[2].id,
        },
        { order_id: 'STATE-DECLINED', assigned_rider_id: null },
        { order_id: 'STATE-DELIVERED', assigned_rider_id: users[1].id },
        { order_id: 'STATE-EXACT', assigned_rider_id: users[3].id },
        { order_id: 'STATE-PICKUP', assigned_rider_id: null },
        { order_id: 'STATE-READY', assigned_rider_id: null },
      ]);

      await expect(
        dataSource.query(
          `SELECT owning_order.order_id,
                  assignment.status::text AS status,
                  assignment.is_current,
                  rider.user_id AS rider_user_id,
                  assignment.proof_signature_data
           FROM delivery_assignments AS assignment
           JOIN orders AS owning_order ON owning_order.id = assignment.order_id
           JOIN rider_profiles AS rider ON rider.id = assignment.rider_id
           WHERE owning_order.order_id LIKE 'STATE-%'
           ORDER BY owning_order.order_id, assignment.assigned_at`,
        ),
      ).resolves.toEqual([
        {
          order_id: 'STATE-CANCELLED',
          status: 'accepted',
          is_current: false,
          rider_user_id: users[1].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-COMPATIBLE',
          status: 'picked_up',
          is_current: true,
          rider_user_id: users[2].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-COMPATIBLE',
          status: 'assigned',
          is_current: false,
          rider_user_id: users[1].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-DECLINED',
          status: 'picked_up',
          is_current: false,
          rider_user_id: users[1].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-DELIVERED',
          status: 'delivered',
          is_current: true,
          rider_user_id: users[1].id,
          proof_signature_data: 'delivered-proof',
        },
        {
          order_id: 'STATE-DELIVERED',
          status: 'assigned',
          is_current: false,
          rider_user_id: users[2].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-EXACT',
          status: 'on_the_way',
          is_current: true,
          rider_user_id: users[3].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-EXACT',
          status: 'on_the_way',
          is_current: false,
          rider_user_id: users[1].id,
          proof_signature_data: null,
        },
        {
          order_id: 'STATE-PICKUP',
          status: 'delivered',
          is_current: false,
          rider_user_id: users[1].id,
          proof_signature_data: 'pickup-proof',
        },
        {
          order_id: 'STATE-READY',
          status: 'assigned',
          is_current: false,
          rider_user_id: users[1].id,
          proof_signature_data: null,
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT owning_order.order_id,
                  conversation.assigned_rider_id,
                  conversation.status::text AS status,
                  conversation.closed_at IS NOT NULL AS has_closed_at
           FROM chat_conversations AS conversation
           JOIN orders AS owning_order ON owning_order.id = conversation.order_id
           WHERE owning_order.order_id LIKE 'STATE-%'
           ORDER BY owning_order.order_id, conversation.assigned_rider_id`,
        ),
      ).resolves.toEqual([
        {
          order_id: 'STATE-CANCELLED',
          assigned_rider_id: users[1].id,
          status: 'closed',
          has_closed_at: true,
        },
        {
          order_id: 'STATE-COMPATIBLE',
          assigned_rider_id: users[1].id,
          status: 'closed',
          has_closed_at: true,
        },
        {
          order_id: 'STATE-COMPATIBLE',
          assigned_rider_id: users[2].id,
          status: 'open',
          has_closed_at: false,
        },
        {
          order_id: 'STATE-DECLINED',
          assigned_rider_id: users[1].id,
          status: 'closed',
          has_closed_at: true,
        },
        {
          order_id: 'STATE-DELIVERED',
          assigned_rider_id: users[1].id,
          status: 'open',
          has_closed_at: false,
        },
        {
          order_id: 'STATE-DELIVERED',
          assigned_rider_id: users[2].id,
          status: 'closed',
          has_closed_at: true,
        },
        {
          order_id: 'STATE-EXACT',
          assigned_rider_id: users[3].id,
          status: 'open',
          has_closed_at: false,
        },
        {
          order_id: 'STATE-PICKUP',
          assigned_rider_id: users[1].id,
          status: 'closed',
          has_closed_at: true,
        },
        {
          order_id: 'STATE-READY',
          assigned_rider_id: users[1].id,
          status: 'closed',
          has_closed_at: true,
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT conversation_id, content
           FROM chat_messages
           WHERE conversation_id = $1`,
          [chatIds.ready],
        ),
      ).resolves.toEqual([
        {
          conversation_id: chatIds.ready,
          content: 'preserved migration audit message',
        },
      ]);

      await expect(
        dataSource.query(
          `INSERT INTO delivery_assignments
             (order_id, rider_id, status, is_current)
           VALUES ($1, $2, 'assigned', true)`,
          [orderIds.ready, riders[0].id],
        ),
      ).resolves.toBeDefined();
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM delivery_assignments
           WHERE order_id = ANY($1::int[])`,
          [Object.values(orderIds)],
        ),
      ).resolves.toEqual([{ count: 11 }]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('commits exactly one beta enrollment ledger grant under concurrent service calls', async () => {
    const database = await createDatabase('beta_ledger_concurrency');
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.runMigrations();
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2) RETURNING id`,
        [`beta-ledger-concurrency-${database}@example.test`, 'not-used'],
      );
      const creditsService = new CreditsService(
        dataSource.getRepository(CreditTransaction),
        dataSource.getRepository(CreditSettings),
        {} as UsersService,
        {} as NotificationsService,
        {} as FirebaseService,
        {} as NotificationsGateway,
        dataSource,
      );

      await Promise.all(
        Array.from({ length: 8 }, () =>
          creditsService.grantBetaEnrollmentCredits(user.id, 100),
        ),
      );

      await expect(
        dataSource.query(
          `SELECT credits, beta_credits_granted
           FROM users
           WHERE id = $1`,
          [user.id],
        ),
      ).resolves.toEqual([{ credits: '100.00', beta_credits_granted: true }]);
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count,
                  MIN("amountCredits") AS amount,
                  MIN(type::text) AS type,
                  MIN(status::text) AS status
           FROM credit_transactions
           WHERE reference_id = $1`,
          [`BETA-ENROLLMENT:${user.id}`],
        ),
      ).resolves.toEqual([
        { count: 1, amount: '100.00', type: 'top_up', status: 'approved' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('normalizes only unambiguous legacy raw refund references during adoption', async () => {
    const database = await createDatabase('legacy_refund_adoption');
    await createSynchronizedFixture(database, false);
    const dataSource = await initializeMigrationDataSource(database);

    try {
      await dataSource.query(`
        DROP INDEX IF EXISTS uq_credit_transactions_refund_reference
      `);
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, credits)
         VALUES ($1, 'not-used', 145) RETURNING id`,
        [`legacy-refund-adoption-${database}@example.test`],
      );
      const [batch] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO batch_orders (
           batch_ref, user_id, subtotal, delivery_fee, total_price,
           payment_method, payment_status, delivery_option,
           priority_fee, extra_destination_fee
         ) VALUES (
           'BATCH-LEGACY-MIGRATION', $1, 40, 20, 85,
           'gridCredits', 'paid', 'pickup', 15, 10
         ) RETURNING id`,
        [user.id],
      );
      await dataSource.query(
        `INSERT INTO orders (
           order_id, user_id, batch_order_id, category, total_price,
           delivery_fee, payment_method, payment_status, order_status,
           delivery_option
         ) VALUES
           ('ORD-LEGACY-MIGRATION-I', $1, NULL, 'paper', 40, 20,
            'gridCredits', 'paid', 'submitted', 'pickup'),
           ('ORD-LEGACY-MIGRATION-B', $1, $2, 'paper', 40, 20,
            'gridCredits', 'paid', 'submitted', 'pickup')`,
        [user.id, batch.id],
      );
      const inserted = await dataSource.query<
        Array<{ id: number; reference_id: string; created_at: Date }>
      >(
        `INSERT INTO credit_transactions (
           user_id, type, "amountCredits", status, reference_id
         ) VALUES
           ($1, 'top_up', 60, 'approved', 'ORD-LEGACY-MIGRATION-I'),
           ($1, 'top_up', 85, 'approved', 'ORD-LEGACY-MIGRATION-B'),
           ($1, 'deduction', 5, 'approved', 'ORD-UNRELATED-AUDIT')
         RETURNING id, reference_id, created_at`,
        [user.id],
      );

      await dataSource.runMigrations();

      await expect(
        dataSource.query(
          `SELECT id, reference_id, created_at
           FROM credit_transactions ORDER BY id`,
        ),
      ).resolves.toEqual([
        {
          ...inserted[0],
          reference_id: 'ORDER-REFUND:ORD-LEGACY-MIGRATION-I',
        },
        {
          ...inserted[1],
          reference_id: 'BATCH-REFUND:BATCH-LEGACY-MIGRATION',
        },
        inserted[2],
      ]);
      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [user.id]),
      ).resolves.toEqual([{ credits: '145.00' }]);
      await expect(
        dataSource.query(
          `SELECT to_regclass(
             'public.uq_credit_transactions_refund_reference'
           ) IS NOT NULL AS refund_index`,
        ),
      ).resolves.toEqual([{ refund_index: true }]);
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
          dataSource.query(
            `SELECT
               to_regclass('public.uq_credit_transactions_refund_reference') IS NOT NULL
                 AS refund_index`,
          ),
        ).resolves.toEqual([{ refund_index: true }]);

        await dataSource.undoLastMigration();

        await expect(
          dataSource.query(
            `SELECT
               to_regclass('public.uq_credit_transactions_beta_enrollment_reference') IS NOT NULL
                 AS beta_ledger_index,
               to_regclass('public.idx_users_beta_enrollment_rank') IS NOT NULL
                 AS beta_rank_index`,
          ),
        ).resolves.toEqual([
          { beta_ledger_index: true, beta_rank_index: true },
        ]);

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

    const staleMigration = new Client({
      ...adminConfig,
      database: migratedDatabase,
    });
    await staleMigration.connect();
    await staleMigration.query(
      `DELETE FROM migrations WHERE timestamp = $1 AND name = $2`,
      ['1777854200000', 'UniqueFcmTokenOwnership1777854200000'],
    );
    await staleMigration.end();

    const staleRejected = runSeedGuard(migratedDatabase);
    expect(staleRejected.status).not.toBe(0);
    expect(`${staleRejected.stdout}\n${staleRejected.stderr}`).toContain(
      'Run npm run migration:run before seeding',
    );

    const repairedDataSource =
      await initializeMigrationDataSource(migratedDatabase);
    await repairedDataSource.runMigrations();
    await repairedDataSource.destroy();

    const accepted = runSeedGuard(migratedDatabase);
    expect(accepted.status).toBe(0);
    expect(accepted.stdout).toContain('seed skipped');
  });

  it('rejects a same-named active-plan index with the wrong predicate before mutating adopted data', async () => {
    const database = await createDatabase('dispatch_wrong_index');
    const dataSource = await initializeMigrationDataSource(database);
    await dataSource.runMigrations();
    const [riderUser] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, 'not-used', 'rider') RETURNING id`,
      [`dispatch-index-preserved-${database}@example.test`],
    );
    const [riderProfile] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO rider_profiles (user_id, vehicle_type, is_available)
       VALUES ($1, 'bike', true) RETURNING id`,
      [riderUser.id],
    );
    await dataSource.query(
      `INSERT INTO dispatch_plans
         (rider_id, version, status, origin_latitude, origin_longitude,
          provider, profile, total_duration_seconds, total_distance_meters,
          routing_data_stale, planned_at)
       VALUES ($1, 1, 'active', 7.064, 125.6079,
               'preserved-provider', 'driving', 10, 100, false, NOW())`,
      [riderProfile.id],
    );
    await dataSource.query(`DROP INDEX "uq_dispatch_plans_active_rider"`);
    await dataSource.query(`
      CREATE UNIQUE INDEX "uq_dispatch_plans_active_rider"
      ON "dispatch_plans" ("rider_id")
      WHERE "status" = 'completed'
    `);
    await dataSource.query(
      `DELETE FROM migrations WHERE timestamp = $1 AND name = $2`,
      ['1777853900000', 'PersistedDispatchPlans1777853900000'],
    );

    await expect(dataSource.runMigrations()).rejects.toThrow(
      'invalid index uq_dispatch_plans_active_rider',
    );
    await expect(
      dataSource.query<Array<{ count: number }>>(
        `SELECT count(*)::int AS count FROM users WHERE email = $1`,
        [`dispatch-index-preserved-${database}@example.test`],
      ),
    ).resolves.toEqual([{ count: 1 }]);
    await expect(
      dataSource.query<Array<{ provider: string; version: number }>>(
        `SELECT provider, version FROM dispatch_plans WHERE rider_id = $1`,
        [riderProfile.id],
      ),
    ).resolves.toEqual([{ provider: 'preserved-provider', version: 1 }]);
    await expect(
      dataSource.query<Array<{ predicate: string }>>(`
        SELECT pg_get_expr(indexprs.indpred, indexprs.indrelid) AS predicate
        FROM pg_index AS indexprs
        JOIN pg_class AS index_class ON index_class.oid = indexprs.indexrelid
        WHERE index_class.relname = 'uq_dispatch_plans_active_rider'
      `),
    ).resolves.toEqual([
      expect.objectContaining({
        predicate: expect.stringContaining('completed'),
      }),
    ]);
    await dataSource.destroy();
  });

  it('rejects an adopted stop table without its primary key before mutating data', async () => {
    const database = await createDatabase('dispatch_missing_pk');
    const dataSource = await initializeMigrationDataSource(database);
    await dataSource.runMigrations();
    await dataSource.query(
      `INSERT INTO users (email, password_hash) VALUES ($1, 'not-used')`,
      [`dispatch-pk-preserved-${database}@example.test`],
    );
    await dataSource.query(
      `ALTER TABLE "dispatch_plan_stops" DROP CONSTRAINT "PK_dispatch_plan_stops"`,
    );
    await dataSource.query(
      `DELETE FROM migrations WHERE timestamp = $1 AND name = $2`,
      ['1777853900000', 'PersistedDispatchPlans1777853900000'],
    );

    await expect(dataSource.runMigrations()).rejects.toThrow(
      'dispatch_plan_stops table: expected id primary key',
    );
    await expect(
      dataSource.query<Array<{ count: number }>>(
        `SELECT count(*)::int AS count FROM users WHERE email = $1`,
        [`dispatch-pk-preserved-${database}@example.test`],
      ),
    ).resolves.toEqual([{ count: 1 }]);
    await expect(
      dataSource.query<Array<{ count: number }>>(`
        SELECT count(*)::int AS count
        FROM pg_constraint
        WHERE conrelid = 'dispatch_plan_stops'::regclass AND contype = 'p'
      `),
    ).resolves.toEqual([{ count: 0 }]);
    await dataSource.destroy();
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

  async function insertLegacyCatalogActivationFixture(
    dataSource: DataSource,
  ): Promise<void> {
    await dataSource.query(`
      ALTER TABLE product_categories
      ADD COLUMN IF NOT EXISTS group_slug varchar(50)
    `);
    await dataSource.query(`
      INSERT INTO product_categories (
        name, slug, description, mobile_description, icon,
        file_processing_type, pricing_model, base_rate, quantity_unit,
        max_file_size_mb, allowed_extensions, is_active, sort_order,
        group_slug
      ) VALUES
        ('Paper Printing', 'paper', 'Historical paper', NULL, NULL,
         'document', 'per_page_modifiers', 2, 'copy', 50, '[]'::jsonb, true, 1,
         NULL),
        ('3D Printing', '3d', 'Historical 3D', NULL, NULL,
         'model_3d', 'base_plus_material_estimate', 50, 'model', 200,
         '[]'::jsonb, false, 2, NULL),
        ('Removed v1.10 leaf', 'removed-v110-leaf', 'Stale canonical leaf',
         NULL, NULL, 'generic_file', 'quote_required', 0, 'piece', 100,
         '[]'::jsonb, true, 99, 'marketing-promo'),
        ('Unrelated historical leaf', 'unrelated-historical-leaf',
         'Unrelated historical catalog row', NULL, NULL, 'generic_file',
         'per_page_modifiers', 5, 'piece', 50, '[]'::jsonb, true, 100, NULL)
      ON CONFLICT (slug) DO UPDATE SET is_active = EXCLUDED.is_active
    `);
    await dataSource.query(`
      INSERT INTO product_spec_definitions (
        category_id, key, label, input_type, value_type, is_required,
        is_active, pricing_role, sort_order
      )
      SELECT id, 'legacy_spec', 'Legacy spec', 'text', 'string', true, true,
             'none', 1
      FROM product_categories
      WHERE slug IN ('removed-v110-leaf', 'unrelated-historical-leaf')
    `);
    await dataSource.query(`
      INSERT INTO product_spec_options (
        spec_definition_id, label, value, is_active, sort_order
      )
      SELECT spec.id, 'Legacy option', 'legacy-option', true, 1
      FROM product_spec_definitions spec
      JOIN product_categories category ON category.id = spec.category_id
      WHERE category.slug IN (
        'removed-v110-leaf',
        'unrelated-historical-leaf'
      )
    `);
  }

  async function insertCapabilityFixture(
    dataSource: DataSource,
    capabilities: Array<{
      productFamily: string;
      materials: string[];
      maxCapacity: number;
      leadTimeDays: number;
    }>,
  ): Promise<number[]> {
    const [user] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO users (email, password_hash, role)
       VALUES ($1, 'not-used', 'supplier')
       RETURNING id`,
      [`catalog-supplier-${Date.now()}-${Math.random()}@example.test`],
    );
    const [supplier] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO supplier_profiles (user_id, business_name)
       VALUES ($1, 'Catalog lifecycle supplier')
       RETURNING id`,
      [user.id],
    );
    const ids: number[] = [];
    for (const capability of capabilities) {
      const [row] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO supplier_capabilities (
           supplier_id, product_family, materials, max_capacity,
           lead_time_days
         ) VALUES ($1, $2, $3::jsonb, $4, $5)
         RETURNING id`,
        [
          supplier.id,
          capability.productFamily,
          JSON.stringify(capability.materials),
          capability.maxCapacity,
          capability.leadTimeDays,
        ],
      );
      ids.push(row.id);
    }
    return ids;
  }

  async function catalogCounts(dataSource: DataSource): Promise<CatalogCounts> {
    const [counts] = await dataSource.query<CatalogCounts[]>(`
      SELECT
        count(DISTINCT group_slug) FILTER (WHERE is_active)::int AS active_groups,
        count(*) FILTER (
          WHERE is_active AND pricing_model = 'quote_required'
        )::int AS active_quote_products,
        count(*) FILTER (
          WHERE is_active AND slug IN ('paper', '3d')
        )::int AS active_legacy_products,
        count(*)::int AS categories,
        (SELECT count(*)::int FROM product_spec_definitions) AS specs,
        (SELECT count(*)::int FROM product_spec_options) AS options,
        (
          SELECT count(*)::int FROM (
            SELECT slug FROM product_categories GROUP BY slug HAVING count(*) > 1
          ) duplicate_category
        ) AS duplicate_categories,
        (
          SELECT count(*)::int FROM (
            SELECT category_id, key FROM product_spec_definitions
            GROUP BY category_id, key HAVING count(*) > 1
          ) duplicate_spec
        ) AS duplicate_specs,
        (
          SELECT count(*)::int FROM (
            SELECT spec_definition_id, value FROM product_spec_options
            GROUP BY spec_definition_id, value HAVING count(*) > 1
          ) duplicate_option
        ) AS duplicate_options
      FROM product_categories
    `);
    return counts;
  }

  async function expectCatalogCounts(
    dataSource: DataSource,
    expected: CatalogCounts,
  ): Promise<void> {
    await expect(catalogCounts(dataSource)).resolves.toEqual(expected);
  }

  async function expectExactCatalog(dataSource: DataSource): Promise<void> {
    const products = await dataSource.query(`
      SELECT
        slug, name, description, mobile_description, examples, group_slug,
        group_name, group_description, group_sort_order, file_processing_type,
        pricing_model, base_rate::float8 AS base_rate, quantity_unit,
        max_file_size_mb, allowed_extensions, is_active, sort_order
      FROM product_categories
      WHERE slug NOT IN ('paper', '3d')
      ORDER BY group_sort_order, sort_order, slug
    `);
    expect(products).toEqual(
      CATALOG_V1_10_GROUPS.flatMap((group) =>
        group.products.map((product) => ({
          slug: product.slug,
          name: product.name,
          description: product.description,
          mobile_description: product.mobileDescription,
          examples: [...product.examples],
          group_slug: group.slug,
          group_name: group.name,
          group_description: group.description,
          group_sort_order: group.sortOrder,
          file_processing_type: product.fileProcessingType,
          pricing_model: product.pricingModel,
          base_rate: product.baseRate,
          quantity_unit: product.quantityUnit,
          max_file_size_mb: product.maxFileSizeMb,
          allowed_extensions: [...product.allowedExtensions],
          is_active: product.isActive,
          sort_order: product.sortOrder,
        })),
      ),
    );

    const specs = await dataSource.query(`
      SELECT
        category.slug AS category_slug, spec.key, spec.label, spec.help_text,
        spec.input_type, spec.value_type, spec.is_required, spec.is_active,
        spec.default_value, spec.pricing_role, spec.unit_label,
        spec.placeholder, spec.min_value::float8 AS min_value,
        spec.max_value::float8 AS max_value,
        spec.step_value::float8 AS step_value, spec.sort_order, spec.metadata
      FROM product_spec_definitions spec
      JOIN product_categories category ON category.id = spec.category_id
      ORDER BY category.group_sort_order, category.sort_order,
               spec.sort_order, spec.key
    `);
    expect(specs).toEqual(
      CATALOG_V1_10_GROUPS.flatMap((group) =>
        group.products.flatMap((product) =>
          product.specs.map((spec) => ({
            category_slug: product.slug,
            key: spec.key,
            label: spec.label,
            help_text: 'helpText' in spec ? spec.helpText : null,
            input_type: spec.inputType,
            value_type: spec.valueType,
            is_required: spec.isRequired,
            is_active: true,
            default_value: 'defaultValue' in spec ? spec.defaultValue : null,
            pricing_role: spec.pricingRole,
            unit_label: 'unitLabel' in spec ? spec.unitLabel : null,
            placeholder: 'placeholder' in spec ? spec.placeholder : null,
            min_value: 'minValue' in spec ? spec.minValue : null,
            max_value: 'maxValue' in spec ? spec.maxValue : null,
            step_value: 'stepValue' in spec ? spec.stepValue : null,
            sort_order: spec.sortOrder,
            metadata: 'metadata' in spec ? spec.metadata : null,
          })),
        ),
      ),
    );
  }

  async function expectRfqDailyGrid(dataSource: DataSource): Promise<void> {
    await expect(
      dataSource.query(`
        SELECT card.category, card.subtitle, card.specs,
               category.is_active AS category_is_active,
               category.pricing_model
        FROM daily_grid_cards card
        JOIN product_categories category ON category.slug = card.category
        WHERE card."isActive" = true
        ORDER BY card."sortOrder", card.id
      `),
    ).resolves.toEqual(
      [
        'flyers',
        'posters-standees',
        '3d-printing-scale-models',
        'tarpaulins-outdoor-banners',
        'business-cards',
      ].map((category) => ({
        category,
        subtitle: 'Quote required',
        specs: {},
        category_is_active: true,
        pricing_model: 'quote_required',
      })),
    );
  }

  async function expectStaleCatalogRowsDeactivated(
    dataSource: DataSource,
  ): Promise<void> {
    await expect(
      dataSource.query(`
        SELECT category.slug,
               category.is_active AS category_active,
               spec.is_active AS spec_active,
               option_record.is_active AS option_active
        FROM product_categories category
        JOIN product_spec_definitions spec ON spec.category_id = category.id
        JOIN product_spec_options option_record
          ON option_record.spec_definition_id = spec.id
        WHERE category.slug IN (
          'removed-v110-leaf',
          'unrelated-historical-leaf'
        )
        ORDER BY category.slug
      `),
    ).resolves.toEqual([
      {
        slug: 'removed-v110-leaf',
        category_active: false,
        spec_active: false,
        option_active: false,
      },
      {
        slug: 'unrelated-historical-leaf',
        category_active: true,
        spec_active: true,
        option_active: true,
      },
    ]);
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

  function runSeed(database: string) {
    const minioEndpoint = requiredLifecycleEnv(
      'GRIDGO_LIFECYCLE_MINIO_ENDPOINT',
    );
    const minioPort = requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_PORT');
    const minioAccessKey = requiredLifecycleEnv(
      'GRIDGO_LIFECYCLE_MINIO_ACCESS_KEY',
    );
    const minioSecretKey = requiredLifecycleEnv(
      'GRIDGO_LIFECYCLE_MINIO_SECRET_KEY',
    );
    const minioBucket = `gridgo-${database.replaceAll('_', '-')}`;
    return spawnSync('npm', ['run', 'seed', '--silent'], {
      cwd: join(__dirname, '..'),
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_HOST: adminConfig.host,
        DATABASE_PORT: String(adminConfig.port),
        DATABASE_NAME: database,
        DATABASE_USER: adminConfig.user,
        DATABASE_PASSWORD: adminConfig.password,
        JWT_SECRET: 'catalog-lifecycle-test-jwt-secret',
        MINIO_ENDPOINT: minioEndpoint,
        MINIO_PORT: minioPort,
        MINIO_USE_SSL: 'false',
        MINIO_ACCESS_KEY: minioAccessKey,
        MINIO_SECRET_KEY: minioSecretKey,
        MINIO_BUCKET: minioBucket,
        GRIDGO_SEED_CUSTOMER_PASSWORD: 'catalog-test-customer-password',
        GRIDGO_SEED_RIDER_PASSWORD: 'catalog-test-rider-password',
        GRIDGO_SEED_ADMIN_PASSWORD: 'catalog-test-admin-password',
      },
    });
  }

  function requiredLifecycleEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is required for isolated seed lifecycle tests`);
    }
    return value;
  }
});
