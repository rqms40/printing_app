import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import {
  DataSource,
  type DataSourceOptions,
  type EntityManager,
} from 'typeorm';

import { Address } from '../src/addresses/entities/address.entity';
import { AuditService } from '../src/audit/audit.service';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { FileMetadata } from '../src/files/entities/file-metadata.entity';
import { MatchingService } from '../src/matching/matching.service';
import {
  SupplierAssignment,
  SupplierAssignmentDecision,
} from '../src/matching/entities/supplier-assignment.entity';
import {
  Order,
  OrderStatus,
  PricingStatus,
} from '../src/orders/entities/order.entity';
import { ProductCategory } from '../src/products/entities/product-category.entity';
import { SupplierCapability } from '../src/suppliers/entities/supplier-capability.entity';
import { SupplierProfile } from '../src/suppliers/entities/supplier-profile.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../src/suppliers/entities/supplier-verification.entity';
import { SuppliersService } from '../src/suppliers/suppliers.service';
import { User, UserRole } from '../src/users/entities/user.entity';

describe('supplier matching PostgreSQL concurrency (e2e)', () => {
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

  it('uses the authoritative address when the relation changes before the locked transaction', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('address'),
    );
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [['Davao City']],
        capacities: [10],
        ratings: [5],
        orderCount: 1,
      });
      const gate = transactionGate(dataSource);
      const matching = makeMatching(dataSource, gate.dataSource);

      const assignment = matching.autoMatch(fixture.orderIds[0], fixture.actor);
      await gate.entered;
      await dataSource
        .getRepository(Address)
        .update(
          { id: fixture.addressId },
          { city: 'Cebu City', barangay: 'Lahug', province: 'Cebu' },
        );
      gate.release();

      await expect(assignment).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'no_eligible_supplier' }),
      });
      await expect(
        dataSource.getRepository(SupplierAssignment).count(),
      ).resolves.toBe(0);
    } finally {
      await dataSource.destroy();
    }
  });

  it('auto-match reranks the full locked pool and falls back from a newly full supplier', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('fallback'),
    );
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [[], []],
        capacities: [1, 1],
        ratings: [5, 4],
        orderCount: 2,
      });
      const gate = transactionGate(dataSource);
      const matching = makeMatching(dataSource, gate.dataSource);
      const assignment = matching.autoMatch(fixture.orderIds[0], fixture.actor);
      await gate.entered;
      await insertHoldingAssignment(
        dataSource,
        fixture.orderIds[1],
        fixture.supplierIds[0],
      );
      gate.release();

      const result = await assignment;
      expect(result.candidate.supplierId).toBe(fixture.supplierIds[1]);
      expect(result.candidate.rankPosition).toBe(1);
      expect(result.assignment.rankPosition).toBe(1);
      expect(result.assignment.rankingInputs).toEqual(
        expect.objectContaining({ openLoad: 0 }),
      );
    } finally {
      await dataSource.destroy();
    }
  });

  it('manual assignment accepts coverage that becomes eligible before the locked transaction', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('newcoverage'),
    );
    const gate = transactionGate(dataSource);
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [[]],
        capacities: [2],
        ratings: [5],
        orderCount: 1,
        capabilitySlugs: [],
      });
      const matching = makeMatching(dataSource, gate.dataSource);
      const attempt = matching.assign(
        fixture.orderIds[0],
        fixture.supplierIds[0],
        fixture.actor,
      );
      const outcome = attempt.then(
        (result) => ({ state: 'resolved' as const, result }),
        (error: unknown) => ({ state: 'rejected' as const, error }),
      );

      const phase = await Promise.race([
        gate.entered.then(() => 'transaction' as const),
        outcome.then(() => 'settled' as const),
      ]);
      expect(phase).toBe('transaction');

      await dataSource.getRepository(SupplierCapability).save({
        supplierId: fixture.supplierIds[0],
        productFamily: 'flyers',
        materials: [],
        maxCapacity: 2,
        leadTimeDays: 1,
        isActive: true,
      });
      gate.release();

      const settled = await outcome;
      expect(settled.state).toBe('resolved');
      if (settled.state === 'resolved') {
        expect(settled.result.assignment.supplierId).toBe(
          fixture.supplierIds[0],
        );
      }
    } finally {
      gate.release();
      await dataSource.destroy();
    }
  });

  it('auto-match rejects coverage that disappears before the locked transaction', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('lostcoverage'),
    );
    const gate = transactionGate(dataSource);
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [[]],
        capacities: [2],
        ratings: [5],
        orderCount: 1,
      });
      const matching = makeMatching(dataSource, gate.dataSource);
      const attempt = matching.autoMatch(fixture.orderIds[0], fixture.actor);
      await gate.entered;
      await dataSource
        .getRepository(SupplierCapability)
        .update(
          { supplierId: fixture.supplierIds[0], productFamily: 'flyers' },
          { isActive: false },
        );
      gate.release();

      await expect(attempt).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'no_eligible_supplier' }),
      });
    } finally {
      gate.release();
      await dataSource.destroy();
    }
  });

  it('saves a coherent pre- or post-decline aggregate basis during reranking', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('declinebasis'),
    );
    const gate = aggregateReadGate(dataSource);
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [[]],
        capacities: [2],
        ratings: [5],
        orderCount: 2,
      });
      const holding = await insertHoldingAssignment(
        dataSource,
        fixture.orderIds[1],
        fixture.supplierIds[0],
      );
      const matching = makeMatching(dataSource, gate.dataSource);
      const attempt = matching.autoMatch(fixture.orderIds[0], fixture.actor);
      await gate.entered;

      await dataSource.getRepository(SupplierAssignment).update(
        { id: holding.id },
        {
          decision: SupplierAssignmentDecision.DECLINED,
          decisionReason: 'concurrent decline',
          decidedAt: new Date(),
        },
      );
      gate.release();

      const result = await attempt;
      const inputs = result.assignment.rankingInputs as {
        openLoad: number;
        acceptanceStats: { declined: number };
      };
      expect([
        { openLoad: 1, declined: 0 },
        { openLoad: 0, declined: 1 },
      ]).toContainEqual({
        openLoad: inputs.openLoad,
        declined: inputs.acceptanceStats.declined,
      });
    } finally {
      gate.release();
      await dataSource.destroy();
    }
  });

  it('serializes two capacity claims without overassignment or deadlock', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('capacity'),
    );
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [[]],
        capacities: [1],
        ratings: [5],
        orderCount: 2,
      });
      const matching = makeMatching(dataSource);

      const attempts = await Promise.allSettled(
        fixture.orderIds.map((orderId) =>
          matching.autoMatch(orderId, fixture.actor),
        ),
      );

      expect(
        attempts.filter((attempt) => attempt.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        attempts.filter((attempt) => attempt.status === 'rejected'),
      ).toHaveLength(1);
      await expect(
        dataSource.getRepository(SupplierAssignment).countBy({
          supplierId: fixture.supplierIds[0],
          decision: SupplierAssignmentDecision.PENDING,
        }),
      ).resolves.toBe(1);
    } finally {
      await dataSource.destroy();
    }
  });

  it('does not create a capability when concurrent catalog deactivation wins', async () => {
    const dataSource = await initializeDatabase(
      await createDatabase('capability'),
    );
    const blocker = dataSource.createQueryRunner();
    try {
      const fixture = await seedMatching(dataSource, {
        supplierZones: [[]],
        capacities: [1],
        ratings: [5],
        orderCount: 0,
        capabilitySlugs: [],
      });
      const product = await dataSource
        .getRepository(ProductCategory)
        .findOneByOrFail({
          slug: 'flyers',
        });
      await blocker.connect();
      await blocker.startTransaction();
      await blocker.manager
        .getRepository(ProductCategory)
        .update({ id: product.id }, { isActive: false });

      const add = makeSuppliers(dataSource).addCapability(
        fixture.supplierIds[0],
        { productFamily: ' FLYERS ' },
      );
      await waitForLockWaiters(dataSource, 1);
      await blocker.commitTransaction();

      await expect(add).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        dataSource.getRepository(SupplierCapability).countBy({
          supplierId: fixture.supplierIds[0],
        }),
      ).resolves.toBe(0);
    } finally {
      if (blocker.isTransactionActive) await blocker.rollbackTransaction();
      await blocker.release();
      await dataSource.destroy();
    }
  });

  function makeMatching(dataSource: DataSource, transactions = dataSource) {
    const audit = {
      recordOrderStatusTransition: jest.fn().mockResolvedValue({}),
      append: jest.fn().mockResolvedValue({}),
    } as unknown as AuditService;
    const config = { get: () => undefined } as unknown as ConfigService;
    return new MatchingService(
      dataSource.getRepository(SupplierAssignment),
      dataSource.getRepository(Order),
      dataSource.getRepository(SupplierProfile),
      dataSource.getRepository(ProductCategory),
      transactions,
      audit,
      config,
    );
  }

  function makeSuppliers(dataSource: DataSource) {
    return new SuppliersService(
      dataSource.getRepository(SupplierProfile),
      dataSource.getRepository(SupplierCapability),
      dataSource.getRepository(ProductCategory),
      dataSource.getRepository(SupplierVerification),
      dataSource.getRepository(FileMetadata),
      dataSource.getRepository(SupplierAssignment),
      dataSource,
      undefined,
    );
  }

  function transactionGate(dataSource: DataSource) {
    let enter!: () => void;
    let release!: () => void;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    return {
      entered,
      release,
      dataSource: {
        transaction: async <T>(
          work: (manager: EntityManager) => Promise<T>,
        ) => {
          enter();
          await released;
          return dataSource.transaction(work);
        },
      } as DataSource,
    };
  }

  function aggregateReadGate(dataSource: DataSource) {
    let enter!: () => void;
    let release!: () => void;
    let paused = false;
    const entered = new Promise<void>((resolve) => (enter = resolve));
    const released = new Promise<void>((resolve) => (release = resolve));
    return {
      entered,
      release,
      dataSource: {
        transaction: <T>(work: (manager: EntityManager) => Promise<T>) =>
          dataSource.transaction(async (manager) => {
            const originalGetRepository = manager.getRepository.bind(manager);
            const wrappedManager = Object.create(manager) as EntityManager;
            wrappedManager.getRepository = ((entity: unknown) => {
              const repository = originalGetRepository(entity as never);
              if (entity !== SupplierAssignment) return repository;
              const wrappedRepository = Object.create(
                repository,
              ) as typeof repository;
              wrappedRepository.createQueryBuilder = (...args: never[]) => {
                const builder = repository.createQueryBuilder(...args);
                const getRawMany = builder.getRawMany.bind(builder);
                builder.getRawMany = async <Row>() => {
                  const rows = await getRawMany<Row>();
                  if (!paused) {
                    paused = true;
                    enter();
                    await released;
                  }
                  return rows;
                };
                return builder;
              };
              return wrappedRepository;
            }) as EntityManager['getRepository'];
            return work(wrappedManager);
          }),
      } as DataSource,
    };
  }

  async function seedMatching(
    dataSource: DataSource,
    input: {
      supplierZones: string[][];
      capacities: number[];
      ratings: number[];
      orderCount: number;
      capabilitySlugs?: string[];
    },
  ) {
    const userRepo = dataSource.getRepository(User);
    const customer = await userRepo.save(
      userRepo.create({
        email: `customer-${Date.now()}@example.test`,
        passwordHash: 'unused',
        role: UserRole.CLIENT,
      }),
    );
    const actorUser = await userRepo.save(
      userRepo.create({
        email: `ops-${Date.now()}@example.test`,
        passwordHash: 'unused',
        role: UserRole.OPS_ADMIN,
      }),
    );
    const address = await dataSource.getRepository(Address).save({
      userId: customer.id,
      label: 'Delivery',
      fullAddress: 'Poblacion, Davao City',
      barangay: 'Poblacion',
      city: 'Davao City',
      province: 'Davao del Sur',
      latitude: 7.07,
      longitude: 125.6,
      isDefault: true,
    });
    const supplierIds: number[] = [];
    for (let index = 0; index < input.supplierZones.length; index += 1) {
      const supplierUser = await userRepo.save(
        userRepo.create({
          email: `supplier-${index}-${Date.now()}@example.test`,
          passwordHash: 'unused',
          role: UserRole.SUPPLIER,
        }),
      );
      const profile = await dataSource.getRepository(SupplierProfile).save({
        userId: supplierUser.id,
        businessName: `Supplier ${index + 1}`,
        serviceZones: input.supplierZones[index],
        isActive: true,
        ratingAverage: input.ratings[index],
        ratingCount: 1,
      });
      supplierIds.push(profile.id);
      await dataSource.getRepository(SupplierVerification).save({
        supplierId: profile.id,
        status: SupplierVerificationStatus.VERIFIED,
        payoutDetailsRef: `vault:${profile.id}`,
      });
      if ((input.capabilitySlugs ?? ['flyers']).includes('flyers')) {
        await dataSource.getRepository(SupplierCapability).save({
          supplierId: profile.id,
          productFamily: 'flyers',
          materials: [],
          maxCapacity: input.capacities[index],
          leadTimeDays: 1,
          isActive: true,
        });
      }
    }
    const orderIds: number[] = [];
    for (let index = 0; index < input.orderCount; index += 1) {
      const order = await dataSource.getRepository(Order).save({
        orderId: `MATCH-${Date.now()}-${index}`,
        userId: customer.id,
        category: 'flyers',
        quantity: 1,
        totalPrice: 0,
        deliveryFee: 0,
        pricingStatus: PricingStatus.PENDING_QUOTE,
        paymentMethod: 'pilot_credit',
        paymentStatus: 'pending',
        orderStatus: OrderStatus.APPROVED_FOR_MATCHING,
        deliveryOption: 'delivery',
        deliveryAddressId: address.id,
      });
      orderIds.push(order.id);
    }
    return {
      actor: { userId: actorUser.id, role: 'ops_admin' as const },
      addressId: address.id,
      supplierIds,
      orderIds,
    };
  }

  async function insertHoldingAssignment(
    dataSource: DataSource,
    orderId: number,
    supplierId: number,
  ) {
    return dataSource.getRepository(SupplierAssignment).save({
      orderId,
      supplierId,
      rankingInputs: {},
      rankPosition: 1,
      acceptanceDeadline: new Date(Date.now() + 60_000),
      decision: SupplierAssignmentDecision.PENDING,
    });
  }

  async function waitForLockWaiters(dataSource: DataSource, expected: number) {
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
    throw new Error(`Timed out waiting for ${expected} lock waiter`);
  }

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
    const database = `gridgo_match_${label}_${process.pid}_${created.size}`;
    if (!/^[a-z0-9_]+$/.test(database)) throw new Error('Unsafe database name');
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
