import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import { App } from 'supertest/types';
import { Client } from 'pg';
import { DataSource, Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { OrdersGateway } from '../src/orders/orders.gateway';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { User, UserRole } from '../src/users/entities/user.entity';
import { TamSurveysService } from '../src/tam-surveys/tam-surveys.service';
import { BetaModeSettings } from '../src/beta-mode/entities/beta-mode-settings.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';

describe('Orders websocket realtime rooms (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let jwtService: JwtService;
  let ordersGateway: OrdersGateway;
  let usersRepo: Repository<User>;
  let customer: User;
  let otherCustomer: User;
  let adminUser: User;
  let rider: User;
  let inactiveCustomer: User;
  let dataSource: DataSource;
  const sockets: Socket[] = [];
  const runId = Date.now().toString().slice(-8);
  const originalDatabaseName = process.env.DATABASE_NAME;
  const originalJwtSecret = process.env.JWT_SECRET;
  const isolatedDatabase = `gridgo_orders_ws_${process.pid}_${runId}`;
  const adminConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: originalDatabaseName ?? 'grid_print',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
  };

  beforeAll(async () => {
    if (!/^[a-z0-9_]+$/.test(isolatedDatabase)) {
      throw new Error('Unsafe isolated database identifier');
    }
    const admin = new Client(adminConfig);
    await admin.connect();
    await admin.query(`CREATE DATABASE "${isolatedDatabase}"`);
    await admin.end();

    process.env.DATABASE_NAME = isolatedDatabase;
    process.env.JWT_SECRET = originalJwtSecret ?? `orders-ws-${runId}`;
    const migrationDataSource = new DataSource(
      databaseOptionsFromEnv(process.env),
    );
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations();
    await migrationDataSource.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.listen(0);

    baseUrl = await app.getUrl();
    jwtService = app.get(JwtService);
    ordersGateway = app.get(OrdersGateway);
    dataSource = app.get(DataSource);
    usersRepo = dataSource.getRepository(User);
    [customer, otherCustomer, adminUser, rider, inactiveCustomer] =
      await usersRepo.save([
        makeUser('customer', UserRole.CUSTOMER),
        makeUser('other', UserRole.CUSTOMER),
        makeUser('admin', UserRole.ADMIN),
        makeUser('rider', UserRole.RIDER),
        makeUser('inactive', UserRole.CUSTOMER, false),
      ]);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    if (app) await app.close();
    if (originalDatabaseName === undefined) delete process.env.DATABASE_NAME;
    else process.env.DATABASE_NAME = originalDatabaseName;
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalJwtSecret;

    const admin = new Client(adminConfig);
    await admin.connect();
    await admin.query(
      `SELECT pg_terminate_backend(pid)
       FROM pg_stat_activity
       WHERE datname = $1 AND pid <> pg_backend_pid()`,
      [isolatedDatabase],
    );
    await admin.query(`DROP DATABASE IF EXISTS "${isolatedDatabase}"`);
    await admin.end();
  });

  it('pushes order updates to the real active customer and admin only', async () => {
    const customerSocket = await connectOrdersSocket(
      tokenFor(customer),
      `user_${customer.id}`,
    );
    const otherSocket = await connectOrdersSocket(
      tokenFor(otherCustomer),
      `user_${otherCustomer.id}`,
    );
    const adminSocket = await connectOrdersSocket(
      tokenFor(adminUser),
      'admin_orders',
    );
    const customerUpdates: unknown[] = [];
    const otherUpdates: unknown[] = [];
    customerSocket.on('orderUpdate', (value) => customerUpdates.push(value));
    otherSocket.on('orderUpdate', (value) => otherUpdates.push(value));
    const adminUpdate = onceEvent(adminSocket, 'orderUpdate');
    const payload = {
      id: 42,
      orderId: 'ORD-WS-10042',
      userId: customer.id,
      orderStatus: 'ready_for_dispatch',
    };

    ordersGateway.notifyOrderUpdate(payload.orderId, payload);

    await expect(adminUpdate).resolves.toMatchObject(payload);
    await waitFor(() => customerUpdates.length === 1);
    expect(customerUpdates).toEqual([expect.objectContaining(payload)]);
    await expectNoEvent(otherUpdates);
  });

  it('pushes riderAssignment to the real assigned rider user room', async () => {
    const riderSocket = await connectOrdersSocket(
      tokenFor(rider),
      `user_${rider.id}`,
    );
    const assignmentEvent = onceEvent(riderSocket, 'riderAssignment');
    const payload = {
      assignmentId: 99,
      orderId: 42,
      orderRef: 'ORD-WS-10042',
    };

    ordersGateway.notifyRiderAssignment(rider.id, payload);

    await expect(assignmentEvent).resolves.toMatchObject(payload);
  });

  it.each([
    ['inactive identity', () => tokenFor(inactiveCustomer)],
    [
      'missing identity',
      () =>
        tokenFor({
          id: 2_000_000_000,
          email: 'missing@example.com',
          role: UserRole.CUSTOMER,
        } as User),
    ],
    ['role-mismatched identity', () => tokenFor(customer, UserRole.ADMIN)],
  ])('disconnects a signed socket with a %s', async (_label, makeToken) => {
    const reason = await connectUntilServerDisconnect(makeToken());
    expect(reason).toBe('io server disconnect');
  });

  it('revokes every namespace only after a beta survey commit', async () => {
    await usersRepo.update(customer.id, {
      isActive: true,
      isBetaUser: true,
      isBetaSurveyExempt: false,
      betaEnrolledAt: new Date(),
      accountHoldReason: null,
      accountHeldAt: null,
    });
    customer = await usersRepo.findOneByOrFail({ id: customer.id });
    const settingsRepo = dataSource.getRepository(BetaModeSettings);
    const settings = await settingsRepo.findOne({ where: {} });
    if (settings) {
      await settingsRepo.update(settings.id, { isEnabled: true });
    } else {
      await settingsRepo.save(settingsRepo.create({ isEnabled: true }));
    }
    const order = await dataSource.getRepository(Order).save(
      dataSource.getRepository(Order).create({
        orderId: `ORD-WS-SURVEY-${runId}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 10,
        deliveryFee: 0,
        paymentMethod: 'gridCredits',
        paymentStatus: 'paid',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.DELIVERED,
      }),
    );
    const surveys = app.get(TamSurveysService);
    const requirement =
      await surveys.createPostDeliveryRequirementIfNeeded(order);
    expect(requirement).not.toBeNull();

    const namespaces = [
      '/ws/orders',
      '/ws/location',
      '/ws/notifications',
      '/ws/chat',
      '/ws/delivery-slots',
    ];
    const customerSockets = await Promise.all(
      namespaces.map((namespace) =>
        connectSocket(namespace, tokenFor(customer)),
      ),
    );
    const unaffected = await connectSocket(
      '/ws/orders',
      tokenFor(otherCustomer),
    );
    await new Promise((resolve) => setTimeout(resolve, 50));

    await expect(
      surveys.submitRequirement(customer.id, requirement!.id, {
        surveyData: {},
        openForumFeedback: {},
      }),
    ).rejects.toThrow('Missing answer');
    expect(
      namespaces.filter(
        (_namespace, index) => !customerSockets[index].connected,
      ),
    ).toEqual([]);
    expect(unaffected.connected).toBe(true);

    const disconnected = customerSockets.map((socket) =>
      onceEvent<string>(socket, 'disconnect'),
    );
    const surveyData = Object.fromEntries(
      Array.from({ length: 14 }, (_, index) => [String(index), index % 5]),
    );
    await expect(
      surveys.submitRequirement(customer.id, requirement!.id, {
        surveyData,
        openForumFeedback: {},
      }),
    ).resolves.toMatchObject({ logoutRequired: true });
    await Promise.all(disconnected);
    expect(customerSockets.every((socket) => !socket.connected)).toBe(true);
    expect(unaffected.connected).toBe(true);

    for (const namespace of namespaces) {
      await expect(
        connectUntilServerDisconnect(tokenFor(customer), namespace),
      ).resolves.toBe('io server disconnect');
    }
  });

  function makeUser(label: string, role: UserRole, isActive = true): User {
    return usersRepo.create({
      email: `orders-ws-${label}-${runId}@example.com`,
      passwordHash: 'not-used',
      fullName: `Orders WS ${label}`,
      role,
      isActive,
    });
  }

  function tokenFor(user: User, role: UserRole = user.role) {
    return jwtService.sign({
      sub: user.id,
      role,
      email: user.email,
    });
  }

  async function connectOrdersSocket(
    token: string,
    expectedRoom: string,
  ): Promise<Socket> {
    const socket = createOrdersSocket(token);
    await onceConnect(socket);
    await waitFor(
      () =>
        (
          (ordersGateway.server as any).adapter.rooms.get(expectedRoom) as
            | Set<string>
            | undefined
        )?.has(socket.id) === true,
    );
    return socket;
  }

  function connectUntilServerDisconnect(
    token: string,
    namespace = '/ws/orders',
  ): Promise<string> {
    const socket = createSocket(namespace, token);
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for server disconnect')),
        3_000,
      );
      socket.once('disconnect', (reason) => {
        clearTimeout(timeout);
        resolve(reason);
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  function createOrdersSocket(token: string): Socket {
    return createSocket('/ws/orders', token);
  }

  async function connectSocket(
    namespace: string,
    token: string,
  ): Promise<Socket> {
    const socket = createSocket(namespace, token);
    await onceConnect(socket);
    return socket;
  }

  function createSocket(namespace: string, token: string): Socket {
    const socket = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    return socket;
  }
});

function onceConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
}

function onceEvent<T = unknown>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${event}`));
    }, 3_000);
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function waitFor(predicate: () => boolean): Promise<void> {
  const deadline = Date.now() + 3_000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error('Timed out waiting for event');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

async function expectNoEvent(events: unknown[]): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(events).toEqual([]);
}
