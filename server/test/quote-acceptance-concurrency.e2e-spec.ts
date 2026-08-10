import { Client } from 'pg';
import { DataSource, type DataSourceOptions } from 'typeorm';

import { databaseOptionsFromEnv } from '../src/database/data-source';
import { User, UserRole } from '../src/users/entities/user.entity';
import { BatchOrder } from '../src/orders/entities/batch-order.entity';
import {
  Order,
  OrderStatus,
  PaymentAuthorizationStatus,
  PricingStatus,
} from '../src/orders/entities/order.entity';
import { SupplierProfile } from '../src/suppliers/entities/supplier-profile.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../src/suppliers/entities/supplier-verification.entity';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../src/matching/entities/supplier-assignment.entity';
import { SupplierJobsService } from '../src/suppliers/supplier-jobs.service';
import type { AuditService } from '../src/audit/audit.service';
import type { FilesService } from '../src/files/files.service';
import type { NotificationsService } from '../src/notifications/notifications.service';

describe('supplier quote acceptance PostgreSQL concurrency (e2e)', () => {
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

  it('serializes concurrent out-of-order line quotes and allocates one shared delivery fee', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('batch_quote'),
    );
    try {
      const users = dataSource.getRepository(User);
      const client = await users.save(
        users.create({
          email: `quote-client-${process.pid}@example.com`,
          passwordHash: 'not-used',
          role: UserRole.CLIENT,
          isActive: true,
        }),
      );
      const supplierUser = await users.save(
        users.create({
          email: `quote-supplier-${process.pid}@example.com`,
          passwordHash: 'not-used',
          role: UserRole.SUPPLIER,
          isActive: true,
        }),
      );
      const profiles = dataSource.getRepository(SupplierProfile);
      const profile = await profiles.save(
        profiles.create({
          userId: supplierUser.id,
          businessName: 'Concurrent Quote Shop',
          isActive: true,
        }),
      );
      await dataSource.getRepository(SupplierVerification).save({
        supplierId: profile.id,
        status: SupplierVerificationStatus.VERIFIED,
      });
      const batches = dataSource.getRepository(BatchOrder);
      const batch = await batches.save(
        batches.create({
          batchRef: `BATCH-Q-${process.pid}`,
          userId: client.id,
          subtotal: 0,
          deliveryFee: 25,
          totalPrice: 0,
          paymentMethod: 'unselected',
          paymentStatus: 'pending',
          deliveryOption: 'delivery',
          deliveryAddressId: null,
        }),
      );
      const orders = dataSource.getRepository(Order);
      const [lower, higher] = await orders.save([
        orders.create({
          orderId: `ORD-Q-${process.pid}-1`,
          userId: client.id,
          batchOrderId: batch.id,
          category: 'flyers',
          quantity: 100,
          totalPrice: 0,
          deliveryFee: 0,
          finalTotalMinor: null,
          deliveryFeeMinor: null,
          pricingStatus: PricingStatus.PENDING_QUOTE,
          paymentMethod: 'unselected',
          paymentStatus: 'pending',
          paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
          orderStatus: OrderStatus.SUPPLIER_ASSIGNED,
          deliveryOption: 'delivery',
        }),
        orders.create({
          orderId: `ORD-Q-${process.pid}-2`,
          userId: client.id,
          batchOrderId: batch.id,
          category: 'custom-apparel',
          quantity: 20,
          totalPrice: 0,
          deliveryFee: 0,
          finalTotalMinor: null,
          deliveryFeeMinor: null,
          pricingStatus: PricingStatus.PENDING_QUOTE,
          paymentMethod: 'unselected',
          paymentStatus: 'pending',
          paymentAuthorizationStatus: PaymentAuthorizationStatus.NONE,
          orderStatus: OrderStatus.SUPPLIER_ASSIGNED,
          deliveryOption: 'delivery',
        }),
      ]);
      expect(lower.id).toBeLessThan(higher.id);
      const assignments = dataSource.getRepository(SupplierAssignment);
      const [lowerAssignment, higherAssignment] = await assignments.save([
        assignments.create({
          orderId: lower.id,
          supplierId: profile.id,
          rankingInputs: {},
          rankPosition: 1,
          acceptanceDeadline: new Date(Date.now() + 86_400_000),
          decision: SupplierAssignmentDecision.PENDING,
        }),
        assignments.create({
          orderId: higher.id,
          supplierId: profile.id,
          rankingInputs: {},
          rankPosition: 1,
          acceptanceDeadline: new Date(Date.now() + 86_400_000),
          decision: SupplierAssignmentDecision.PENDING,
        }),
      ]);

      const service = new SupplierJobsService(
        assignments,
        profiles,
        orders,
        dataSource,
        {
          recordOrderStatusTransition: jest.fn().mockResolvedValue({}),
          append: jest.fn().mockResolvedValue({}),
        } as unknown as AuditService,
        {} as FilesService,
        {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as NotificationsService,
      );
      const promisedDate = new Date(Date.now() + 172_800_000).toISOString();
      const actor = { userId: supplierUser.id, role: 'supplier' as const };

      // Start the higher-id line first to prove fee ownership does not depend
      // on quote arrival order. Both calls then contend on the same batch lock.
      await Promise.all([
        service.acceptJob(
          higherAssignment.id,
          { finalPriceMinor: 20_000, promisedDate },
          actor,
        ),
        service.acceptJob(
          lowerAssignment.id,
          { finalPriceMinor: 10_000, promisedDate },
          actor,
        ),
      ]);

      const quoted = await orders.find({
        where: { batchOrderId: batch.id },
        order: { id: 'ASC' },
      });
      expect(quoted.map(({ quotedTotalMinor }) => quotedTotalMinor)).toEqual([
        '12500',
        '20000',
      ]);
      expect(quoted.map(({ deliveryFeeMinor }) => deliveryFeeMinor)).toEqual([
        '2500',
        '0',
      ]);
      expect(
        quoted.reduce(
          (sum, { quotedTotalMinor }) => sum + BigInt(quotedTotalMinor ?? '0'),
          0n,
        ),
      ).toBe(32_500n);
      expect(
        quoted.every((order) => order.pricingStatus === PricingStatus.QUOTED),
      ).toBe(true);
      expect(
        quoted.every(
          (order) => order.orderStatus === OrderStatus.SUPPLIER_ACCEPTED,
        ),
      ).toBe(true);
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
    const database = `gridgo_quote_${label}_${process.pid}_${created.size}`;
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
});
