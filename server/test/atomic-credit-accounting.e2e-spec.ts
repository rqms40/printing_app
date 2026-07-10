import { Client } from 'pg';
import { DataSource, type DataSourceOptions, EntityManager } from 'typeorm';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { BetaModeService } from '../src/beta-mode/beta-mode.service';
import { BetaModeSettings } from '../src/beta-mode/entities/beta-mode-settings.entity';
import { CreditsService } from '../src/credits/credits.service';
import { CreditSettings } from '../src/credits/entities/credit-settings.entity';
import { CreditTransaction } from '../src/credits/entities/credit-transaction.entity';
import { Order } from '../src/orders/entities/order.entity';
import { OrderItem } from '../src/orders/entities/order-item.entity';
import { OrderItemSpecValue } from '../src/orders/entities/order-item-spec-value.entity';
import { BatchOrder } from '../src/orders/entities/batch-order.entity';
import { DeliveryDestination } from '../src/orders/entities/delivery-destination.entity';
import { OrdersService } from '../src/orders/orders.service';
import { DeliveryAssignment } from '../src/riders/entities/delivery-assignment.entity';
import { Address } from '../src/addresses/entities/address.entity';
import { FileMetadata } from '../src/files/entities/file-metadata.entity';
import { UsersService } from '../src/users/users.service';
import { User } from '../src/users/entities/user.entity';
import { NotificationsService } from '../src/notifications/notifications.service';
import { NotificationsGateway } from '../src/notifications/notifications.gateway';
import { FirebaseService } from '../src/firebase/firebase.service';
import { OrdersGateway } from '../src/orders/orders.gateway';
import { FilesService } from '../src/files/files.service';
import { TamSurveysService } from '../src/tam-surveys/tam-surveys.service';
import { DeliverySlotsService } from '../src/delivery-slots/delivery-slots.service';
import { DeliverySettingsService } from '../src/delivery-slots/delivery-settings.service';
import { DeliverySlotsGateway } from '../src/delivery-slots/delivery-slots.gateway';
import { PrinterProfileService } from '../src/printer-profile/printer-profile.service';
import { CatalogPricingService } from '../src/products/catalog-pricing.service';

describe('atomic credit accounting (e2e)', () => {
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

  it('serializes multi-instance enrollment and preserves the first timestamp', async () => {
    const database = await createDatabase('enrollment');
    const dataSource = await initializeDatabase(database);
    try {
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, 'not-used') RETURNING id`,
        [`atomic-enrollment-${database}@example.test`],
      );
      const credits = makeCreditsService(dataSource);
      let firstTimestamp: Date | null = null;
      let releaseFirst: () => void = () => undefined;
      const firstCanCommit = new Promise<void>((resolve) => {
        releaseFirst = resolve;
      });
      let firstLocked: () => void = () => undefined;
      const firstHasLock = new Promise<void>((resolve) => {
        firstLocked = resolve;
      });
      const gatedCredits = {
        grantBetaEnrollmentCredits: async (
          userId: number,
          amount: number,
          manager: EntityManager,
        ) => {
          const locked = await manager.getRepository(User).findOneOrFail({
            where: { id: userId },
          });
          firstTimestamp = locked.betaEnrolledAt;
          firstLocked();
          await firstCanCommit;
          await credits.grantBetaEnrollmentCredits(userId, amount, manager);
        },
      } as CreditsService;
      const firstService = makeBetaService(dataSource, gatedCredits);
      const secondService = makeBetaService(dataSource, credits);

      const firstEnrollment = firstService.enrollUser(user.id);
      await firstHasLock;
      const secondEnrollment = secondService.enrollUser(user.id);
      releaseFirst();
      await Promise.all([firstEnrollment, secondEnrollment]);

      const [state] = await dataSource.query<
        Array<{
          is_beta_user: boolean;
          beta_enrolled_at: Date;
          beta_credits_granted: boolean;
          credits: string;
        }>
      >(
        `SELECT is_beta_user, beta_enrolled_at, beta_credits_granted, credits
         FROM users WHERE id = $1`,
        [user.id],
      );
      expect(state).toEqual({
        is_beta_user: true,
        beta_enrolled_at: firstTimestamp,
        beta_credits_granted: true,
        credits: '100.00',
      });
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM credit_transactions
           WHERE reference_id = $1`,
          [`BETA-ENROLLMENT:${user.id}`],
        ),
      ).resolves.toEqual([{ count: 1 }]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('rolls back enrollment state, balance, and ledger when the grant fails', async () => {
    const database = await createDatabase('enrollment_rollback');
    const dataSource = await initializeDatabase(database);
    try {
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, 'not-used') RETURNING id`,
        [`atomic-enrollment-rollback-${database}@example.test`],
      );
      const credits = makeCreditsService(dataSource);
      const failingCredits = {
        grantBetaEnrollmentCredits: async (
          userId: number,
          amount: number,
          manager: EntityManager,
        ) => {
          await credits.grantBetaEnrollmentCredits(userId, amount, manager);
          throw new Error('forced enrollment failure');
        },
      } as CreditsService;

      await expect(
        makeBetaService(dataSource, failingCredits).enrollUser(user.id),
      ).rejects.toThrow('forced enrollment failure');

      await expect(
        dataSource.query(
          `SELECT is_beta_user, beta_enrolled_at, beta_credits_granted, credits
           FROM users WHERE id = $1`,
          [user.id],
        ),
      ).resolves.toEqual([
        {
          is_beta_user: false,
          beta_enrolled_at: null,
          beta_credits_granted: false,
          credits: '0.00',
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count FROM credit_transactions`,
        ),
      ).resolves.toEqual([{ count: 0 }]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('rolls back a failed individual save and prevents concurrent overspend', async () => {
    const database = await createDatabase('individual_debit');
    const dataSource = await initializeDatabase(database);
    try {
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, credits)
         VALUES ($1, 'not-used', 100) RETURNING id`,
        [`atomic-debit-${database}@example.test`],
      );
      const credits = makeCreditsService(dataSource);
      const failingOrderService = makeOrdersService(dataSource, credits, 80, {
        pricingModel: 'x'.repeat(80),
      });

      await expect(
        failingOrderService.create(creditOrderInput(user.id)),
      ).rejects.toThrow();
      await expect(accountingCounts(dataSource, user.id)).resolves.toEqual({
        credits: '100.00',
        orders: 0,
        items: 0,
        deductions: 0,
      });

      const orderService = makeOrdersService(dataSource, credits, 80);
      const attempts = await Promise.allSettled([
        orderService.create(creditOrderInput(user.id)),
        orderService.create(creditOrderInput(user.id)),
      ]);
      expect(
        attempts.filter((attempt) => attempt.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = attempts.find(
        (attempt): attempt is PromiseRejectedResult =>
          attempt.status === 'rejected',
      );
      expect(rejected?.reason as unknown).toMatchObject({
        message: 'Insufficient credits',
      });
      await expect(accountingCounts(dataSource, user.id)).resolves.toEqual({
        credits: '20.00',
        orders: 1,
        items: 1,
        deductions: 1,
      });
    } finally {
      await dataSource.destroy();
    }
  });

  it('refunds a multi-row batch once under concurrent retries', async () => {
    const database = await createDatabase('batch_refund');
    const dataSource = await initializeDatabase(database);
    try {
      const fixture = await createBatchFixture(dataSource, database);
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );

      await Promise.all([
        service.cancelBatch(fixture.batchId, fixture.userId),
        service.cancelBatch(fixture.batchId, fixture.userId),
      ]);

      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [
          fixture.userId,
        ]),
      ).resolves.toEqual([{ credits: '85.00' }]);
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count, MIN("amountCredits") AS amount
           FROM credit_transactions
           WHERE reference_id = $1`,
          [`BATCH-REFUND:${fixture.batchRef}`],
        ),
      ).resolves.toEqual([{ count: 1, amount: '85.00' }]);
      await expect(
        dataSource.query(
          `SELECT order_status, payment_status
           FROM orders WHERE batch_order_id = $1 ORDER BY id`,
          [fixture.batchId],
        ),
      ).resolves.toEqual([
        { order_status: 'cancelled', payment_status: 'refunded' },
        { order_status: 'cancelled', payment_status: 'refunded' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('rolls back refund balance, ledger, and cancellation status together', async () => {
    const database = await createDatabase('refund_rollback');
    const dataSource = await initializeDatabase(database);
    try {
      const fixture = await createBatchFixture(dataSource, database);
      await dataSource.query(`
        CREATE FUNCTION reject_cancelled_order() RETURNS trigger AS $$
        BEGIN
          IF NEW.order_status = 'cancelled' THEN
            RAISE EXCEPTION 'forced cancellation status failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await dataSource.query(`
        CREATE TRIGGER reject_cancelled_order_update
        BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE FUNCTION reject_cancelled_order()
      `);
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );

      await expect(
        service.cancelBatch(fixture.batchId, fixture.userId),
      ).rejects.toThrow('forced cancellation status failure');

      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [
          fixture.userId,
        ]),
      ).resolves.toEqual([{ credits: '0.00' }]);
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM credit_transactions
           WHERE reference_id = $1`,
          [`BATCH-REFUND:${fixture.batchRef}`],
        ),
      ).resolves.toEqual([{ count: 0 }]);
      await expect(
        dataSource.query(
          `SELECT order_status FROM orders
           WHERE batch_order_id = $1 ORDER BY id`,
          [fixture.batchId],
        ),
      ).resolves.toEqual([
        { order_status: 'order_placed' },
        { order_status: 'order_placed' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('rolls back the balance and keeps orders active when refund ledger insertion fails', async () => {
    const database = await createDatabase('refund_ledger_rollback');
    const dataSource = await initializeDatabase(database);
    try {
      const fixture = await createBatchFixture(dataSource, database);
      await dataSource.query(`
        CREATE FUNCTION reject_refund_ledger() RETURNS trigger AS $$
        BEGIN
          IF NEW.reference_id LIKE 'BATCH-REFUND:%' THEN
            RAISE EXCEPTION 'forced refund ledger failure';
          END IF;
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
      `);
      await dataSource.query(`
        CREATE TRIGGER reject_refund_ledger_insert
        BEFORE INSERT ON credit_transactions
        FOR EACH ROW EXECUTE FUNCTION reject_refund_ledger()
      `);
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );

      await expect(
        service.cancelBatch(fixture.batchId, fixture.userId),
      ).rejects.toThrow('forced refund ledger failure');

      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [
          fixture.userId,
        ]),
      ).resolves.toEqual([{ credits: '0.00' }]);
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count FROM credit_transactions`,
        ),
      ).resolves.toEqual([{ count: 0 }]);
      await expect(
        dataSource.query(
          `SELECT order_status FROM orders
           WHERE batch_order_id = $1 ORDER BY id`,
          [fixture.batchId],
        ),
      ).resolves.toEqual([
        { order_status: 'order_placed' },
        { order_status: 'order_placed' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  function makeCreditsService(dataSource: DataSource): CreditsService {
    return new CreditsService(
      dataSource.getRepository(CreditTransaction),
      dataSource.getRepository(CreditSettings),
      {} as UsersService,
      {
        triggerCreditsUpdate: jest.fn(),
      } as unknown as NotificationsService,
      {} as FirebaseService,
      {} as NotificationsGateway,
      dataSource,
    );
  }

  function makeBetaService(
    dataSource: DataSource,
    creditsService: CreditsService,
  ): BetaModeService {
    return new BetaModeService(
      dataSource.getRepository(BetaModeSettings),
      dataSource.getRepository(User),
      dataSource.getRepository(FileMetadata),
      creditsService,
      dataSource,
    );
  }

  function makeOrdersService(
    dataSource: DataSource,
    creditsService: CreditsService,
    subtotal: number,
    itemOverrides: { pricingModel?: string } = {},
  ): OrdersService {
    const usersService = {
      findById: (id: number) =>
        dataSource.getRepository(User).findOne({ where: { id } }),
      getFcmToken: jest.fn().mockResolvedValue(null),
    } as unknown as UsersService;
    const catalogPricingService = {
      quote: jest.fn().mockResolvedValue({
        subtotal,
        items: [
          {
            categoryId: null,
            categorySlug: 'paper',
            categoryName: 'Paper Printing',
            pricingModel: itemOverrides.pricingModel ?? 'per_page_modifiers',
            printSubtotal: subtotal,
            specSnapshots: [],
          },
        ],
      }),
    } as unknown as CatalogPricingService;

    return new OrdersService(
      dataSource.getRepository(Order),
      dataSource.getRepository(OrderItem),
      dataSource.getRepository(OrderItemSpecValue),
      dataSource.getRepository(DeliveryAssignment),
      dataSource.getRepository(Address),
      dataSource.getRepository(DeliveryDestination),
      dataSource.getRepository(BatchOrder),
      {
        notifyOrderUpdate: jest.fn(),
        notifySurveyRequired: jest.fn(),
      } as unknown as OrdersGateway,
      {} as FirebaseService,
      usersService,
      creditsService,
      {
        create: jest.fn().mockResolvedValue(undefined),
        createForAllAdmins: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationsService,
      {} as FilesService,
      {} as TamSurveysService,
      dataSource,
      {
        releaseSlot: jest.fn().mockResolvedValue(undefined),
      } as unknown as DeliverySlotsService,
      {} as DeliverySettingsService,
      {
        notifyDateChanged: jest.fn(),
      } as unknown as DeliverySlotsGateway,
      {} as PrinterProfileService,
      catalogPricingService,
      dataSource.getRepository(FileMetadata),
    );
  }

  function creditOrderInput(userId: number): Partial<Order> {
    return {
      userId,
      category: 'paper',
      quantity: 1,
      totalPrice: 80,
      deliveryFee: 0,
      paymentMethod: 'gridCredits',
      deliveryOption: 'pickup',
    };
  }

  async function accountingCounts(dataSource: DataSource, userId: number) {
    const [row] = await dataSource.query<
      Array<{
        credits: string;
        orders: number;
        items: number;
        deductions: number;
      }>
    >(
      `SELECT user_record.credits,
              (SELECT COUNT(*)::int FROM orders WHERE user_id = $1) AS orders,
              (SELECT COUNT(*)::int FROM order_items) AS items,
              (SELECT COUNT(*)::int FROM credit_transactions
               WHERE user_id = $1 AND type::text = 'deduction') AS deductions
       FROM users AS user_record WHERE user_record.id = $1`,
      [userId],
    );
    return row;
  }

  async function createBatchFixture(dataSource: DataSource, database: string) {
    const [user] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO users (email, password_hash, credits)
       VALUES ($1, 'not-used', 0) RETURNING id`,
      [`atomic-refund-${database}@example.test`],
    );
    const [batch] = await dataSource.query<
      Array<{ id: number; batch_ref: string }>
    >(
      `INSERT INTO batch_orders (
         batch_ref, user_id, subtotal, delivery_fee, total_price,
         payment_method, payment_status, delivery_option,
         priority_fee, extra_destination_fee
       ) VALUES (
         'BATCH-10001', $1, 40, 20, 85,
         'gridCredits', 'paid', 'pickup', 15, 10
       ) RETURNING id, batch_ref`,
      [user.id],
    );
    await dataSource.query(
      `INSERT INTO orders (
         order_id, user_id, batch_order_id, category, total_price,
         delivery_fee, payment_method, payment_status, order_status,
         delivery_option
       ) VALUES
         ('ORD-10001', $1, $2, 'paper', 20, 0, 'gridCredits', 'paid',
          'order_placed', 'pickup'),
         ('ORD-10002', $1, $2, 'paper', 20, 0, 'gridCredits', 'paid',
          'order_placed', 'pickup')`,
      [user.id, batch.id],
    );
    return { userId: user.id, batchId: batch.id, batchRef: batch.batch_ref };
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

  async function initializeDatabase(database: string): Promise<DataSource> {
    const dataSource = new DataSource(optionsForDatabase(database));
    await dataSource.initialize();
    await dataSource.runMigrations();
    return dataSource;
  }

  async function createDatabase(label: string): Promise<string> {
    const database = `gridgo_atomic_${label}_${process.pid}_${createdDatabases.size}`;
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
});
