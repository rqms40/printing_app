import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Client as MinioClient } from 'minio';
import { Client } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { databaseOptionsFromEnv } from '../src/database/data-source';
import {
  lockRfqCatalog,
  resolveArtworkInLockOrder,
} from '../src/orders/rfq-locking';
import { CATALOG_V1_10_GROUPS } from '../src/products/catalog-v1-10.definition';
import { CatalogReadService } from '../src/products/catalog-read.service';
import { CatalogValidationService } from '../src/products/catalog-validation.service';
import { CatalogPricingService } from '../src/products/catalog-pricing.service';
import { ProductCategory } from '../src/products/entities/product-category.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import {
  FileMetadata,
  FilePurpose,
} from '../src/files/entities/file-metadata.entity';
import { PendingFileUpload } from '../src/files/entities/pending-file-upload.entity';
import { StorageService } from '../src/storage/storage.service';
import { CatalogUploadPolicyService } from '../src/files/catalog-upload-policy.service';
import { PendingUploadCleanupService } from '../src/files/pending-upload-cleanup.service';
import { FilesService } from '../src/files/files.service';
import { FilesController } from '../src/files/files.controller';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { OrderItemSpecValue } from '../src/orders/entities/order-item-spec-value.entity';
import { BatchOrder } from '../src/orders/entities/batch-order.entity';
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
  PricingStatus,
} from '../src/orders/entities/order.entity';
import { OrderStatusHistory } from '../src/orders/entities/order-status-history.entity';
import { DeliveryAssignment } from '../src/riders/entities/delivery-assignment.entity';
import { Address } from '../src/addresses/entities/address.entity';
import { DeliveryDestination } from '../src/orders/entities/delivery-destination.entity';
import { DispatchPlan } from '../src/riders/entities/dispatch-plan.entity';
import { AuditEvent } from '../src/audit/entities/audit-event.entity';
import { AuditService } from '../src/audit/audit.service';
import { CreditTransaction } from '../src/credits/entities/credit-transaction.entity';
import { CreditSettings } from '../src/credits/entities/credit-settings.entity';
import { CreditsService } from '../src/credits/credits.service';
import { PaymentsService } from '../src/payments/payments.service';
import { PaymentTransaction } from '../src/payments/entities/payment-transaction.entity';
import { CodCollection } from '../src/payments/entities/cod-collection.entity';
import { Payout } from '../src/payouts/entities/payout.entity';
import { OrdersService } from '../src/orders/orders.service';
import { QualityService } from '../src/quality/quality.service';
import { QualityDecisionInput } from '../src/quality/dto/quality-decision.dto';
import {
  QualityReview,
  QualityReviewRiskLevel,
} from '../src/quality/entities/quality-review.entity';
import { SuppliersService } from '../src/suppliers/suppliers.service';
import { SupplierProfile } from '../src/suppliers/entities/supplier-profile.entity';
import { SupplierCapability } from '../src/suppliers/entities/supplier-capability.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../src/suppliers/entities/supplier-verification.entity';
import { SupplierAssignment } from '../src/matching/entities/supplier-assignment.entity';
import { MatchingService } from '../src/matching/matching.service';
import { SupplierJobsService } from '../src/suppliers/supplier-jobs.service';
import { TamSurvey } from '../src/tam-surveys/entities/tam-survey.entity';
import { TamSurveySettings } from '../src/tam-surveys/entities/tam-survey-settings.entity';
import { AdminController } from '../src/admin/admin.controller';

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
      expect(
        result.get('rfq-round-flyers')?.specs.map(({ key }) => key),
      ).toEqual(['size']);
      expect(
        result
          .get('rfq-round-flyers')
          ?.specs[0].options.map(({ value }) => value),
      ).toEqual(['a5']);
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

  it('runs the seeded two-line RFQ through upload, QA, matching, quote, acceptance, and authorization', async () => {
    const database = await createDatabase('lifecycle');
    const bucket = `gridgo-rfq-lifecycle-${process.pid}`;
    const dataSource = await initializeDatabase(database);
    const storage = createStorage(bucket);
    try {
      await storage.service.onModuleInit();
      const seeded = runSeed(database, bucket);
      expect(`${seeded.stdout}\n${seeded.stderr}`).toContain('Seed complete!');
      expect(seeded.status).toBe(0);
      expect(await exactCatalogCounts(dataSource)).toEqual({
        activeGroups: 4,
        activeProducts: 17,
        activeLegacy: 0,
      });
      await expect(dataSource.showMigrations()).resolves.toBe(false);

      const services = createLifecycleServices(dataSource, storage.service);
      const users = dataSource.getRepository(User);
      const customer = await users.save(
        users.create({
          email: `rfq-customer-${process.pid}@example.test`,
          passwordHash: 'not-used',
          role: UserRole.CLIENT,
          isActive: true,
          credits: 1_000,
        }),
      );
      const stranger = await users.save(
        users.create({
          email: `rfq-stranger-${process.pid}@example.test`,
          passwordHash: 'not-used',
          role: UserRole.CLIENT,
          isActive: true,
        }),
      );
      const ops = await users.save(
        users.create({
          email: `rfq-ops-${process.pid}@example.test`,
          passwordHash: 'not-used',
          role: UserRole.OPS_ADMIN,
          isActive: true,
        }),
      );
      const supplierUsers = await users.save(
        ['flyers', 'custom-apparel'].map((slug) =>
          users.create({
            email: `rfq-${slug}-${process.pid}@example.test`,
            passwordHash: 'not-used',
            role: UserRole.SUPPLIER,
            isActive: true,
          }),
        ),
      );

      const filesController = new FilesController(
        services.files,
        {} as never,
        {} as never,
      );
      const upload = (productSlug: string, suffix: string) => {
        const buffer = Buffer.from(
          `%PDF-1.4\n% GRIDGO isolated RFQ ${suffix}\n%%EOF\n`,
        );
        return filesController.uploadFile(
          {
            fieldname: 'file',
            originalname: `${suffix}.pdf`,
            encoding: '7bit',
            mimetype: 'application/pdf',
            size: buffer.length,
            buffer,
            destination: '',
            filename: '',
            path: '',
            stream: undefined as never,
          },
          { user: { sub: customer.id, role: UserRole.CLIENT } } as never,
          { purpose: FilePurpose.CATALOG_ARTWORK, productSlug },
        );
      };
      const [flyerFile, apparelFile] = await Promise.all([
        upload('flyers', 'flyer-artwork'),
        upload('custom-apparel', 'apparel-artwork'),
      ]);

      const requiredDate = new Date(Date.now() + 7 * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const submitted = await services.orders.submitRfq(customer.id, {
        deliveryOption: 'delivery',
        temporaryAddress: {
          label: 'RFQ test address',
          fullAddress: '123 Isolated Test Street, Davao City',
          barangay: 'Poblacion',
          city: 'Davao City',
          province: 'Davao del Sur',
          zipCode: '8000',
          landmark: 'Test gate',
          latitude: 7.0731,
          longitude: 125.6128,
        },
        items: [
          {
            categorySlug: 'flyers',
            quantity: 100,
            requiredDate,
            fileMetadataId: flyerFile.id,
            specs: {
              dimensions_or_standard_size: 'A5',
              stock_or_material: 'Matte 120 gsm',
              color: 'Full color',
              sides: 2,
              finish: 'Trimmed',
            },
          },
          {
            categorySlug: 'custom-apparel',
            quantity: 12,
            requiredDate,
            fileMetadataId: apparelFile.id,
            specs: {
              item_subtype: 'T-shirt',
              variant_or_size: 'Mixed adult sizes',
              color: 'Black',
              branding_method: 'Screen print',
              artwork_placement: 'Front chest',
            },
          },
        ],
      });
      expect(submitted.orders).toHaveLength(2);
      expect(submitted.orders.map((order) => order.category)).toEqual([
        'flyers',
        'custom-apparel',
      ]);
      expect(
        submitted.orders.every(
          (order) =>
            order.pricingStatus === PricingStatus.PENDING_QUOTE &&
            order.quotedTotalMinor === null &&
            order.totalPrice === null,
        ),
      ).toBe(true);
      await expectNoPaymentMutation(dataSource, customer.id);

      for (const order of submitted.orders) {
        await services.quality.recordDecision(
          order.id,
          {
            decision: QualityDecisionInput.APPROVED_FOR_MATCHING,
            checklist: { product_compatibility: true, address: true },
            riskLevel: QualityReviewRiskLevel.LOW,
            evidence: { fileMetadataId: order.fileMetadataId },
          },
          { userId: ops.id, role: 'ops_admin' },
        );
      }

      for (const order of submitted.orders) {
        await expect(
          services.matching.getCandidates(order.id),
        ).resolves.toMatchObject({
          outcome: { code: 'no_eligible_supplier' },
          candidates: [],
        });
      }
      const beforeCoverage = await services.admin.getAllOrders();
      const projectedBefore = beforeCoverage.filter((order) =>
        submitted.orders.some((created) => created.id === order.id),
      );
      expect(projectedBefore).toHaveLength(2);
      expect(projectedBefore.every((order) => order.unmet_coverage)).toBe(true);

      const profiles = [] as SupplierProfile[];
      for (const [index, slug] of ['flyers', 'custom-apparel'].entries()) {
        const profile = await services.suppliers.createProfile({
          userId: supplierUsers[index].id,
          businessName: `Exact ${slug} supplier`,
          serviceZones: [],
          serviceFocusRanks: [],
          isActive: true,
        });
        await services.suppliers.setVerification(
          profile.id,
          {
            status: SupplierVerificationStatus.VERIFIED,
            payoutDetailsRef: `test-vault://${slug}`,
            notes: 'Isolated lifecycle fixture',
          },
          ops.id,
        );
        await services.suppliers.addOwnCapability(supplierUsers[index].id, {
          productFamily: slug,
          materials: [],
          maxCapacity: 10_000,
          leadTimeDays: 3,
        });
        profiles.push(profile);
      }

      const assignments: SupplierAssignment[] = [];
      for (const [index, order] of submitted.orders.entries()) {
        const candidates = await services.matching.getCandidates(order.id);
        expect(candidates.outcome.code).toBe('eligible_suppliers_found');
        expect(
          candidates.candidates.map((candidate) => candidate.supplierId),
        ).toEqual([profiles[index].id]);
        const matched = await services.matching.autoMatch(order.id, {
          userId: ops.id,
          role: 'ops_admin',
        });
        assignments.push(matched.assignment);
      }
      await expectNoPaymentMutation(dataSource, customer.id);

      const promisedDate = new Date(Date.now() + 3 * 86_400_000).toISOString();
      for (const [index, assignment] of assignments.entries()) {
        await services.supplierJobs.acceptJob(
          assignment.id,
          {
            finalPriceMinor: index === 0 ? 10_000 : 20_000,
            promisedDate,
          },
          { userId: supplierUsers[index].id, role: 'supplier' },
        );
      }
      const quoted = await dataSource.getRepository(Order).find({
        where: { batchOrderId: submitted.orders[0].batchOrderId },
        order: { id: 'ASC' },
      });
      expect(quoted.map((order) => order.quotedTotalMinor)).toEqual([
        '12700',
        '20000',
      ]);
      expect(quoted.map((order) => order.deliveryFeeMinor)).toEqual([
        '2700',
        '0',
      ]);
      await expectNoPaymentMutation(dataSource, customer.id);

      await expect(
        services.orders.acceptQuote(quoted[0].id, stranger.id, {
          supplierAssignmentId: assignments[0].id,
          paymentMethod: 'pilot_credit',
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(
        services.orders.acceptQuote(quoted[0].id, customer.id, {
          supplierAssignmentId: assignments[1].id,
          paymentMethod: 'pilot_credit',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);

      for (const [index, order] of quoted.entries()) {
        await services.orders.acceptQuote(order.id, customer.id, {
          supplierAssignmentId: assignments[index].id,
          paymentMethod: 'pilot_credit',
        });
      }
      await expectNoPaymentMutation(dataSource, customer.id);

      for (const order of quoted) {
        await services.orders.authorizePayment(order.id, {
          actorUserId: ops.id,
          actorRole: 'ops_admin',
          reason: 'Isolated RFQ lifecycle authorization',
        });
      }

      const finalOrders = await services.orders.findByUser(customer.id);
      expect(finalOrders).toHaveLength(2);
      expect(finalOrders.map((order) => order.category).sort()).toEqual([
        'custom-apparel',
        'flyers',
      ]);
      expect(
        finalOrders.every(
          (order) =>
            order.pricingStatus === PricingStatus.ACCEPTED &&
            order.orderStatus === OrderStatus.PAYMENT_AUTHORIZED &&
            order.paymentAuthorizationStatus ===
              PaymentAuthorizationStatus.AUTHORIZED &&
            order.quoteAcceptedAt != null &&
            order.authorizationSnapshot != null,
        ),
      ).toBe(true);
      expect(
        finalOrders.map((order) => String(order.quotedTotalMinor)).sort(),
      ).toEqual(['12700', '20000']);
      expect(
        finalOrders
          .flatMap((order) => order.items)
          .map((item) => ({
            slug: item.categorySlug,
            name: item.categoryName,
            group: (item as OrderItem & { groupSlug?: string }).groupSlug,
            examples: (item as OrderItem & { examples?: string[] }).examples,
            displays: (
              item as OrderItem & { specs?: Array<{ displayValue: string }> }
            ).specs?.map((spec) => spec.displayValue),
          })),
      ).toEqual([
        expect.objectContaining({
          slug: 'flyers',
          name: 'Flyers',
          group: 'marketing-promo',
          examples: expect.arrayContaining(['Single sheets']),
          displays: expect.arrayContaining(['A5', 'Trimmed']),
        }),
        expect.objectContaining({
          slug: 'custom-apparel',
          name: 'Custom Apparel',
          group: 'corporate-merch',
          examples: expect.arrayContaining(['T-shirts']),
          displays: expect.arrayContaining(['T-shirt', 'Front chest']),
        }),
      ]);

      const histories = await dataSource
        .getRepository(OrderStatusHistory)
        .find({
          where: submitted.orders.map((order) => ({ orderId: order.id })),
          order: { orderId: 'ASC', id: 'ASC' },
        });
      for (const order of submitted.orders) {
        expect(
          histories
            .filter((history) => history.orderId === order.id)
            .map((history) => history.toStatus),
        ).toEqual([
          OrderStatus.NEEDS_QA,
          OrderStatus.APPROVED_FOR_MATCHING,
          OrderStatus.SUPPLIER_ASSIGNED,
          OrderStatus.SUPPLIER_ACCEPTED,
          OrderStatus.AWAITING_PAYMENT,
          OrderStatus.PAYMENT_AUTHORIZED,
        ]);
      }
      const audits = await dataSource.getRepository(AuditEvent).find({
        where: submitted.orders.map((order) => ({ orderId: order.id })),
      });
      expect(audits.map((audit) => audit.action)).toEqual(
        expect.arrayContaining([
          'status_transition',
          'supplier_assigned',
          'supplier_job_accepted',
          'customer_quote_accepted',
          'quality_review_decision',
        ]),
      );
      expect(
        await dataSource.getRepository(CreditTransaction).count({
          where: { userId: customer.id },
        }),
      ).toBe(4);
      expect(await dataSource.getRepository(PaymentTransaction).count()).toBe(
        0,
      );
      expect(await dataSource.getRepository(CodCollection).count()).toBe(0);
      expect(
        await dataSource.getRepository(FileMetadata).find({
          where: [{ id: flyerFile.id }, { id: apparelFile.id }],
          order: { id: 'ASC' },
        }),
      ).toEqual([
        expect.objectContaining({
          purpose: FilePurpose.CATALOG_ARTWORK,
          catalogProductSlug: 'flyers',
        }),
        expect.objectContaining({
          purpose: FilePurpose.CATALOG_ARTWORK,
          catalogProductSlug: 'custom-apparel',
        }),
      ]);
      await expect(
        storage.service.objectExists(flyerFile.objectKey!),
      ).resolves.toBe(true);
      await expect(
        storage.service.objectExists(apparelFile.objectKey!),
      ).resolves.toBe(true);
    } finally {
      await dataSource.destroy();
      await emptyAndRemoveBucket(storage.client, bucket);
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
      VALUES
        (900003, 900002, 'size', 'Size', 'select', 'string', true, true),
        (900005, 900002, 'retired', 'Retired required', 'text', 'string', true, false)
    `);
    await dataSource.query(`
      INSERT INTO product_spec_options
        (id, spec_definition_id, label, value, is_active)
      VALUES
        (900004, 900003, 'A5', 'a5', true),
        (900006, 900003, 'Old size', 'old', false),
        (900007, 900005, 'Retired', 'retired', true)
    `);
  }

  function requiredLifecycleEnv(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`${name} is required for isolated catalog RFQ tests`);
    }
    return value;
  }

  function createStorage(bucket: string) {
    const endPoint = requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_ENDPOINT');
    const port = Number(requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_PORT'));
    const accessKey = requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_ACCESS_KEY');
    const secretKey = requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_SECRET_KEY');
    const client = new MinioClient({
      endPoint,
      port,
      useSSL: false,
      accessKey,
      secretKey,
    });
    const config = new ConfigService({
      MINIO_ENDPOINT: endPoint,
      MINIO_PORT: port,
      MINIO_USE_SSL: 'false',
      MINIO_ACCESS_KEY: accessKey,
      MINIO_SECRET_KEY: secretKey,
      MINIO_BUCKET: bucket,
      MINIO_PUBLIC_URL: `http://${endPoint}:${port}`,
    });
    return { client, service: new StorageService(client, client, config) };
  }

  function runSeed(database: string, bucket: string) {
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
        JWT_SECRET: 'catalog-rfq-lifecycle-test-only',
        MINIO_ENDPOINT: requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_ENDPOINT'),
        MINIO_PORT: requiredLifecycleEnv('GRIDGO_LIFECYCLE_MINIO_PORT'),
        MINIO_USE_SSL: 'false',
        MINIO_ACCESS_KEY: requiredLifecycleEnv(
          'GRIDGO_LIFECYCLE_MINIO_ACCESS_KEY',
        ),
        MINIO_SECRET_KEY: requiredLifecycleEnv(
          'GRIDGO_LIFECYCLE_MINIO_SECRET_KEY',
        ),
        MINIO_BUCKET: bucket,
        GRIDGO_SEED_CUSTOMER_PASSWORD: 'catalog-test-customer-password',
        GRIDGO_SEED_RIDER_PASSWORD: 'catalog-test-rider-password',
        GRIDGO_SEED_ADMIN_PASSWORD: 'catalog-test-admin-password',
      },
    });
  }

  async function exactCatalogCounts(dataSource: DataSource) {
    const [row] = await dataSource.query<
      Array<{
        active_groups: number;
        active_products: number;
        active_legacy: number;
      }>
    >(`
      SELECT
        (count(DISTINCT group_slug) FILTER (WHERE is_active))::int AS active_groups,
        (count(*) FILTER (
          WHERE is_active AND pricing_model = 'quote_required'
        ))::int AS active_products,
        (count(*) FILTER (
          WHERE is_active AND slug IN ('paper', '3d')
        ))::int AS active_legacy
      FROM product_categories
    `);
    expect(
      await dataSource.query<{ group_slug: string }[]>(`
        SELECT DISTINCT group_slug
        FROM product_categories
        WHERE is_active
        ORDER BY group_slug
      `),
    ).toEqual(
      CATALOG_V1_10_GROUPS.map((group) => ({ group_slug: group.slug })).sort(
        (left, right) => left.group_slug.localeCompare(right.group_slug),
      ),
    );
    return {
      activeGroups: row.active_groups,
      activeProducts: row.active_products,
      activeLegacy: row.active_legacy,
    };
  }

  async function expectNoPaymentMutation(
    dataSource: DataSource,
    customerId: number,
  ) {
    await expect(
      Promise.all([
        dataSource.getRepository(CreditTransaction).count({
          where: { userId: customerId },
        }),
        dataSource.getRepository(PaymentTransaction).count(),
        dataSource.getRepository(CodCollection).count(),
      ]),
    ).resolves.toEqual([0, 0, 0]);
  }

  function createLifecycleServices(
    dataSource: DataSource,
    storage: StorageService,
  ) {
    const repository = <T extends object>(entity: new () => T) =>
      dataSource.getRepository(entity);
    const noOp = new Proxy(
      {},
      {
        get: () => jest.fn().mockResolvedValue(null),
      },
    ) as never;
    const config = new ConfigService({
      PAYMONGO_LIVE_ENABLED: 'false',
      MATCHING_ACCEPTANCE_SLA_HOURS: '24',
    });
    const audit = new AuditService(repository(AuditEvent));
    const catalogRead = new CatalogReadService(repository(ProductCategory));
    const catalogPricing = new CatalogPricingService(
      catalogRead,
      new CatalogValidationService(),
    );
    const pendingCleanup = new PendingUploadCleanupService(
      repository(PendingFileUpload),
      repository(FileMetadata),
      storage,
      dataSource,
    );
    const files = new FilesService(
      repository(FileMetadata),
      repository(ProductCategory),
      storage,
      { analyze: jest.fn().mockResolvedValue(null) } as never,
      new CatalogUploadPolicyService(),
      pendingCleanup,
      dataSource,
    );
    const credits = new CreditsService(
      repository(CreditTransaction),
      repository(CreditSettings),
      noOp,
      noOp,
      noOp,
      noOp,
      dataSource,
    );
    const payments = new PaymentsService(
      repository(PaymentTransaction),
      repository(CodCollection),
      repository(Order),
      repository(User),
      repository(Payout),
      config,
    );
    const orders = new OrdersService(
      repository(Order),
      repository(OrderItem),
      repository(OrderItemSpecValue),
      repository(DeliveryAssignment),
      repository(SupplierAssignment),
      repository(Address),
      repository(DeliveryDestination),
      repository(BatchOrder),
      noOp,
      noOp,
      noOp,
      credits,
      payments,
      noOp,
      files,
      noOp,
      dataSource,
      noOp,
      { isInsideServiceArea: jest.fn().mockResolvedValue(true) } as never,
      noOp,
      noOp,
      catalogPricing,
      repository(FileMetadata),
      repository(DispatchPlan),
      audit,
      undefined,
      undefined,
      undefined,
      catalogRead,
    );
    const quality = new QualityService(
      repository(QualityReview),
      repository(Order),
      dataSource,
      audit,
      files,
    );
    const suppliers = new SuppliersService(
      repository(SupplierProfile),
      repository(SupplierCapability),
      repository(ProductCategory),
      repository(SupplierVerification),
      repository(FileMetadata),
      repository(SupplierAssignment),
      dataSource,
      files,
    );
    const matching = new MatchingService(
      repository(SupplierAssignment),
      repository(Order),
      repository(SupplierProfile),
      repository(ProductCategory),
      dataSource,
      audit,
      config,
      noOp,
    );
    const supplierJobs = new SupplierJobsService(
      repository(SupplierAssignment),
      repository(SupplierProfile),
      repository(Order),
      dataSource,
      audit,
      files,
      noOp,
    );
    const adminController = new AdminController(
      orders,
      noOp,
      credits,
      noOp,
      noOp,
      suppliers,
      repository(Order),
      repository(User),
      repository(TamSurvey),
      repository(TamSurveySettings),
      repository(DeliveryAssignment),
      repository(SupplierAssignment),
      matching,
    );
    return {
      files,
      orders,
      quality,
      suppliers,
      matching,
      supplierJobs,
      admin: adminController,
    };
  }

  async function emptyAndRemoveBucket(client: MinioClient, bucket: string) {
    if (!(await client.bucketExists(bucket))) return;
    const names = await new Promise<string[]>((resolve, reject) => {
      const found: string[] = [];
      const stream = client.listObjectsV2(bucket, '', true);
      stream.on('data', (object) => {
        if (object.name) found.push(object.name);
      });
      stream.on('error', reject);
      stream.on('end', () => resolve(found));
    });
    if (names.length > 0) await client.removeObjects(bucket, names);
    await client.removeBucket(bucket);
  }
});
