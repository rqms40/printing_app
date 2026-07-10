import { Client } from 'pg';
import { DataSource, type DataSourceOptions, EntityManager } from 'typeorm';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { BetaModeService } from '../src/beta-mode/beta-mode.service';
import { BetaModeSettings } from '../src/beta-mode/entities/beta-mode-settings.entity';
import { CreditsService } from '../src/credits/credits.service';
import { CreditSettings } from '../src/credits/entities/credit-settings.entity';
import { CreditTransaction } from '../src/credits/entities/credit-transaction.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
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
import { DeliverySlotTemplate } from '../src/delivery-slots/entities/delivery-slot-template.entity';
import { DeliverySlotBooking } from '../src/delivery-slots/entities/delivery-slot-booking.entity';
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
      const creditEvent = jest.fn();
      const slot = await attachFutureSlot(
        dataSource,
        fixture.batchId,
        'successful-slot',
      );
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource, creditEvent),
        40,
        {},
        { slotsService: slot.service, slotsGateway: slot.gateway },
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
      expect(creditEvent).toHaveBeenCalledTimes(1);
      expect(creditEvent).toHaveBeenCalledWith(fixture.userId, 85);
      expect(slot.gateway.notifyDateChanged).toHaveBeenCalledTimes(1);
      expect(slot.gateway.notifyDateChanged).toHaveBeenCalledWith(slot.date);
    } finally {
      await dataSource.destroy();
    }
  });

  it('adopts a successful raw individual refund without crediting it again', async () => {
    const database = await createDatabase('legacy_individual_refund');
    const dataSource = await initializeDatabase(database);
    try {
      const [user] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO users (email, password_hash, credits)
         VALUES ($1, 'not-used', 60) RETURNING id`,
        [`legacy-individual-refund-${database}@example.test`],
      );
      const [order] = await dataSource.query<Array<{ id: number }>>(
        `INSERT INTO orders (
           order_id, user_id, category, total_price, delivery_fee,
           payment_method, payment_status, order_status, delivery_option
         ) VALUES (
           'ORD-LEGACY-INDIVIDUAL', $1, 'paper', 40, 20,
           'gridCredits', 'paid', 'order_placed', 'pickup'
         ) RETURNING id`,
        [user.id],
      );
      await dataSource.query(
        `INSERT INTO credit_transactions (
           user_id, type, "amountCredits", status, reference_id
         ) VALUES ($1, 'top_up', 60, 'approved', 'ORD-LEGACY-INDIVIDUAL')`,
        [user.id],
      );
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );

      await service.cancelOrder(order.id, user.id);
      await service.cancelOrder(order.id, user.id);

      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [user.id]),
      ).resolves.toEqual([{ credits: '60.00' }]);
      await expect(
        dataSource.query(
          `SELECT reference_id, "amountCredits" AS amount
           FROM credit_transactions
           WHERE reference_id IN (
             'ORD-LEGACY-INDIVIDUAL',
             'ORDER-REFUND:ORD-LEGACY-INDIVIDUAL'
           ) ORDER BY id`,
        ),
      ).resolves.toEqual([
        { reference_id: 'ORD-LEGACY-INDIVIDUAL', amount: '60.00' },
      ]);
      await expect(
        dataSource.query(
          `SELECT order_status, payment_status FROM orders WHERE id = $1`,
          [order.id],
        ),
      ).resolves.toEqual([
        { order_status: 'cancelled', payment_status: 'refunded' },
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('credits only the unrefunded remainder of a partially cancelled legacy batch', async () => {
    const database = await createDatabase('legacy_batch_refund');
    const dataSource = await initializeDatabase(database);
    try {
      const fixture = await createBatchFixture(dataSource, database);
      const [firstOrder] = await dataSource.query<Array<{ id: number }>>(
        `SELECT id FROM orders WHERE batch_order_id = $1 ORDER BY id LIMIT 1`,
        [fixture.batchId],
      );
      await dataSource.query(`UPDATE users SET credits = 30 WHERE id = $1`, [
        fixture.userId,
      ]);
      await dataSource.query(
        `UPDATE orders
         SET order_status = 'cancelled', payment_status = 'refunded'
         WHERE id = $1`,
        [firstOrder.id],
      );
      await dataSource.query(
        `INSERT INTO credit_transactions (
           user_id, type, "amountCredits", status, reference_id
         ) VALUES ($1, 'top_up', 30, 'approved', 'ORD-10001')`,
        [fixture.userId],
      );
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );

      await service.cancelBatch(fixture.batchId, fixture.userId);
      await service.cancelBatch(fixture.batchId, fixture.userId);

      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [
          fixture.userId,
        ]),
      ).resolves.toEqual([{ credits: '85.00' }]);
      await expect(
        dataSource.query(
          `SELECT reference_id, "amountCredits" AS amount
           FROM credit_transactions
           WHERE reference_id IN ('ORD-10001', $1)
           ORDER BY id`,
          [`BATCH-REFUND:${fixture.batchRef}`],
        ),
      ).resolves.toEqual([
        { reference_id: 'ORD-10001', amount: '30.00' },
        {
          reference_id: `BATCH-REFUND:${fixture.batchRef}`,
          amount: '55.00',
        },
      ]);
      await expect(
        dataSource.query(
          `SELECT payment_status FROM batch_orders WHERE id = $1`,
          [fixture.batchId],
        ),
      ).resolves.toEqual([{ payment_status: 'refunded' }]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('does not refund when a non-cancellable status transition wins the row lock', async () => {
    const database = await createDatabase('status_wins_cancel_race');
    const dataSource = await initializeDatabase(database);
    try {
      const fixture = await createBatchFixture(dataSource, database);
      const [order] = await dataSource.query<Array<{ id: number }>>(
        `SELECT id FROM orders WHERE batch_order_id = $1 ORDER BY id LIMIT 1`,
        [fixture.batchId],
      );
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );
      await service.updateStatus(
        order.id,
        OrderStatus.FILE_VERIFIED,
        {},
        {
          actorUserId: fixture.userId,
          reason: 'Prepare status race',
        },
      );
      const blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      await blocker.query(`SELECT id FROM orders WHERE id = $1 FOR UPDATE`, [
        order.id,
      ]);
      const statusAttempt = service.updateStatus(
        order.id,
        OrderStatus.PRINTING_IN_PROGRESS,
        {},
        {
          actorUserId: fixture.userId,
          reason: 'Status race',
        },
      );
      await waitForOrderLockWaiters(dataSource, 1);
      const cancelAttempt = service.cancelBatch(
        fixture.batchId,
        fixture.userId,
      );
      await waitForOrderLockWaiters(dataSource, 2);
      await blocker.commitTransaction();
      await blocker.release();
      const [statusResult, cancelResult] = await Promise.allSettled([
        statusAttempt,
        cancelAttempt,
      ]);

      expect(statusResult.status).toBe('fulfilled');
      expect(cancelResult).toMatchObject({ status: 'rejected' });
      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [
          fixture.userId,
        ]),
      ).resolves.toEqual([{ credits: '0.00' }]);
      await expect(
        dataSource.query(
          `SELECT order_status, payment_status
           FROM orders WHERE id = $1`,
          [order.id],
        ),
      ).resolves.toEqual([
        { order_status: 'printing_in_progress', payment_status: 'paid' },
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

  it('keeps cancellation terminal when cancellation wins the row lock', async () => {
    const database = await createDatabase('cancel_wins_status_race');
    const dataSource = await initializeDatabase(database);
    try {
      const fixture = await createBatchFixture(dataSource, database);
      const [order] = await dataSource.query<Array<{ id: number }>>(
        `SELECT id FROM orders WHERE batch_order_id = $1 ORDER BY id LIMIT 1`,
        [fixture.batchId],
      );
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource),
        40,
      );
      await service.updateStatus(
        order.id,
        OrderStatus.FILE_VERIFIED,
        {},
        {
          actorUserId: fixture.userId,
          reason: 'Prepare status race',
        },
      );
      const blocker = dataSource.createQueryRunner();
      await blocker.connect();
      await blocker.startTransaction();
      await blocker.query(`SELECT id FROM orders WHERE id = $1 FOR UPDATE`, [
        order.id,
      ]);
      const cancelAttempt = service.cancelBatch(
        fixture.batchId,
        fixture.userId,
      );
      await waitForOrderLockWaiters(dataSource, 1);
      const statusAttempt = service.updateStatus(
        order.id,
        OrderStatus.PRINTING_IN_PROGRESS,
        {},
        {
          actorUserId: fixture.userId,
          reason: 'Status race',
        },
      );
      await waitForOrderLockWaiters(dataSource, 2);
      await blocker.commitTransaction();
      await blocker.release();
      const [cancelResult, statusResult] = await Promise.allSettled([
        cancelAttempt,
        statusAttempt,
      ]);

      expect(cancelResult.status).toBe('fulfilled');
      expect(statusResult).toMatchObject({ status: 'rejected' });
      await expect(
        dataSource.query(`SELECT credits FROM users WHERE id = $1`, [
          fixture.userId,
        ]),
      ).resolves.toEqual([{ credits: '85.00' }]);
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
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM credit_transactions WHERE reference_id = $1`,
          [`BATCH-REFUND:${fixture.batchRef}`],
        ),
      ).resolves.toEqual([{ count: 1 }]);
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
      const creditEvent = jest.fn();
      const slot = await attachFutureSlot(
        dataSource,
        fixture.batchId,
        'rollback-slot',
      );
      const service = makeOrdersService(
        dataSource,
        makeCreditsService(dataSource, creditEvent),
        40,
        {},
        { slotsService: slot.service, slotsGateway: slot.gateway },
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
      expect(creditEvent).not.toHaveBeenCalled();
      expect(slot.gateway.notifyDateChanged).not.toHaveBeenCalled();
      await expect(
        dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM delivery_slot_bookings WHERE batch_order_id = $1`,
          [fixture.batchId],
        ),
      ).resolves.toEqual([{ count: 1 }]);
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

  function makeCreditsService(
    dataSource: DataSource,
    creditEvent: jest.Mock = jest.fn(),
  ): CreditsService {
    return new CreditsService(
      dataSource.getRepository(CreditTransaction),
      dataSource.getRepository(CreditSettings),
      {} as UsersService,
      {
        triggerCreditsUpdate: creditEvent,
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
      creditsService,
      dataSource,
      {} as FilesService,
    );
  }

  function makeOrdersService(
    dataSource: DataSource,
    creditsService: CreditsService,
    subtotal: number,
    itemOverrides: { pricingModel?: string } = {},
    serviceOverrides: {
      slotsService?: DeliverySlotsService;
      slotsGateway?: DeliverySlotsGateway;
    } = {},
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
      serviceOverrides.slotsService ??
        ({
          releaseSlot: jest.fn().mockResolvedValue(null),
          publishReleasedSlot: jest.fn(),
        } as unknown as DeliverySlotsService),
      {} as DeliverySettingsService,
      serviceOverrides.slotsGateway ??
        ({
          notifyDateChanged: jest.fn(),
        } as unknown as DeliverySlotsGateway),
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

  async function attachFutureSlot(
    dataSource: DataSource,
    batchId: number,
    label: string,
  ) {
    const date = new Date(Date.now() + 48 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const [template] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO delivery_slot_templates (
         day_of_week, start_time, end_time, capacity, is_active, allows_pickup
       ) VALUES (1, '09:00:00', '10:00:00', 10, true, true)
       RETURNING id`,
    );
    const [booking] = await dataSource.query<Array<{ id: number }>>(
      `INSERT INTO delivery_slot_bookings (
         slot_template_id, date, batch_order_id, priority
       ) VALUES ($1, $2, $3, false) RETURNING id`,
      [template.id, date, batchId],
    );
    await dataSource.query(
      `UPDATE batch_orders SET slot_booking_id = $1 WHERE id = $2`,
      [booking.id, batchId],
    );
    const gateway = {
      notifyDateChanged: jest.fn(),
      notifySlotUpdated: jest.fn(),
    } as unknown as DeliverySlotsGateway & {
      notifyDateChanged: jest.Mock;
    };
    return {
      date,
      gateway,
      service: new DeliverySlotsService(
        dataSource.getRepository(DeliverySlotTemplate),
        dataSource.getRepository(DeliverySlotBooking),
        dataSource,
        gateway,
      ),
      label,
    };
  }

  async function waitForOrderLockWaiters(
    dataSource: DataSource,
    expected: number,
  ): Promise<void> {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const [row] = await dataSource.query<Array<{ count: number }>>(
        `SELECT COUNT(*)::int AS count
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND wait_event_type = 'Lock'`,
      );
      if (row.count >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Timed out waiting for ${expected} order lock waiters`);
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
