import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In, Repository } from 'typeorm';
import { Client } from 'pg';

import { AppModule } from '../src/app.module';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { User, UserRole } from '../src/users/entities/user.entity';
import { RiderProfile } from '../src/riders/entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
  ProofOfDeliveryType,
} from '../src/riders/entities/delivery-assignment.entity';
import { Notification } from '../src/notifications/entities/notification.entity';
import { OrderStatusHistory } from '../src/orders/entities/order-status-history.entity';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { FirebaseService } from '../src/firebase/firebase.service';

describe('Rider dispatch workflow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let usersRepo: Repository<User>;
  let ordersRepo: Repository<Order>;
  let riderProfilesRepo: Repository<RiderProfile>;
  let assignmentsRepo: Repository<DeliveryAssignment>;
  let notificationsRepo: Repository<Notification>;
  let statusHistoryRepo: Repository<OrderStatusHistory>;

  const runId = Date.now().toString().slice(-10);
  const originalDatabaseName = process.env.DATABASE_NAME;
  const originalJwtSecret = process.env.JWT_SECRET;
  const isolatedDatabase = `gridgo_rider_workflow_${process.pid}_${runId}`;
  const adminConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: originalDatabaseName ?? 'grid_print',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
  };
  const orderRef = `E2E-${runId}`;
  const emails = {
    customer: `e2e-customer-${runId}@example.com`,
    admin: `e2e-admin-${runId}@example.com`,
    rider: `e2e-rider-${runId}@example.com`,
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
    process.env.JWT_SECRET = originalJwtSecret ?? 'test-only-rider-workflow';
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

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
    usersRepo = dataSource.getRepository(User);
    ordersRepo = dataSource.getRepository(Order);
    riderProfilesRepo = dataSource.getRepository(RiderProfile);
    assignmentsRepo = dataSource.getRepository(DeliveryAssignment);
    notificationsRepo = dataSource.getRepository(Notification);
    statusHistoryRepo = dataSource.getRepository(OrderStatusHistory);
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

  it('assigns, notifies, requeues on decline, then completes rider delivery', async () => {
    const customer = await usersRepo.save(
      usersRepo.create({
        email: emails.customer,
        passwordHash: 'not-used',
        fullName: 'E2E Customer',
        role: UserRole.CUSTOMER,
        isActive: true,
      }),
    );
    const admin = await usersRepo.save(
      usersRepo.create({
        email: emails.admin,
        passwordHash: 'not-used',
        fullName: 'E2E Admin',
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );
    const rider = await usersRepo.save(
      usersRepo.create({
        email: emails.rider,
        passwordHash: 'not-used',
        fullName: 'E2E Rider',
        role: UserRole.RIDER,
        isActive: true,
      }),
    );
    const riderProfile = await riderProfilesRepo.save(
      riderProfilesRepo.create({
        userId: rider.id,
        vehicleType: 'bike',
        plateNumber: 'E2E-1',
        licenseNumber: 'E2E-LIC',
        isAvailable: true,
      }),
    );
    const order = await ordersRepo.save(
      ordersRepo.create({
        orderId: orderRef,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 120,
        deliveryFee: 25,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
    );

    const adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    const riderToken = jwtService.sign({
      sub: rider.id,
      email: rider.email,
      role: rider.role,
    });

    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${order.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.RIDER_ASSIGNED })
      .expect(400);

    const firstAssign = await request(app.getHttpServer())
      .post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: riderProfile.id })
      .expect(201);

    expect(firstAssign.body).toMatchObject({
      id: order.id,
      orderId: orderRef,
      userId: customer.id,
      assignedRiderId: rider.id,
      orderStatus: OrderStatus.RIDER_ASSIGNED,
    });

    let assignment = await assignmentsRepo.findOneOrFail({
      where: { orderId: order.id },
    });
    expect(assignment.status).toBe(DeliveryStatus.ASSIGNED);

    await expect(
      notificationsRepo.findOneOrFail({
        where: {
          userId: rider.id,
          orderRef,
          type: 'rider_assigned',
        },
      }),
    ).resolves.toMatchObject({
      title: 'New delivery assignment',
    });
    await expect(
      notificationsRepo.findOneOrFail({
        where: {
          userId: customer.id,
          orderRef,
          type: `order_${OrderStatus.RIDER_ASSIGNED}`,
        },
      }),
    ).resolves.toMatchObject({
      title: 'Rider Assigned',
    });

    const assignmentsResponse = await request(app.getHttpServer())
      .get('/api/riders/assignments')
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(200);

    expect(
      assignmentsResponse.body.some(
        (item: { id: number; orderId: number }) =>
          item.id === assignment.id && item.orderId === order.id,
      ),
    ).toBe(true);

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.DECLINED, declineReason: 'Too far' })
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          id: assignment.id,
          status: DeliveryStatus.DECLINED,
          declineReason: 'Too far',
        });
      });

    await expect(
      ordersRepo.findOneOrFail({ where: { id: order.id } }),
    ).resolves.toMatchObject({
      orderStatus: OrderStatus.READY_FOR_DISPATCH,
      assignedRiderId: null,
    });

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: riderProfile.id })
      .expect(201);

    assignment = await assignmentsRepo.findOneOrFail({
      where: { orderId: order.id, isCurrent: true },
    });
    expect(assignment.status).toBe(DeliveryStatus.ASSIGNED);

    const transitions: Array<[DeliveryStatus, OrderStatus]> = [
      [DeliveryStatus.ACCEPTED, OrderStatus.RIDER_ASSIGNED],
      [DeliveryStatus.PICKED_UP, OrderStatus.PICKED_UP],
      [DeliveryStatus.ON_THE_WAY, OrderStatus.ON_THE_WAY],
      [DeliveryStatus.ARRIVED, OrderStatus.ARRIVED_AT_DESTINATION],
    ];

    for (const [deliveryStatus, orderStatus] of transitions) {
      await request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignment.id}/status`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ status: deliveryStatus })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(deliveryStatus);
        });

      await expect(
        ordersRepo.findOneOrFail({ where: { id: order.id } }),
      ).resolves.toMatchObject({ orderStatus });
    }

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.DELIVERED })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('Proof of delivery is required');
      });

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        status: DeliveryStatus.DELIVERED,
        proof: {
          type: ProofOfDeliveryType.SIGNATURE,
          signatureData: 'svg:e2e-signature',
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(DeliveryStatus.DELIVERED);
        expect(res.body.proofType).toBe(ProofOfDeliveryType.SIGNATURE);
        expect(res.body.proofSignatureData).toBe('svg:e2e-signature');
      });

    await expect(
      ordersRepo.findOneOrFail({ where: { id: order.id } }),
    ).resolves.toMatchObject({ orderStatus: OrderStatus.DELIVERED });

    const history = await statusHistoryRepo.find({
      where: { orderId: order.id },
      order: { id: 'ASC' },
    });
    expect(
      history.map((entry) => ({
        from: entry.fromStatus,
        to: entry.toStatus,
        actor: entry.changedByUserId,
      })),
    ).toEqual([
      {
        from: OrderStatus.READY_FOR_DISPATCH,
        to: OrderStatus.RIDER_ASSIGNED,
        actor: admin.id,
      },
      {
        from: OrderStatus.RIDER_ASSIGNED,
        to: OrderStatus.READY_FOR_DISPATCH,
        actor: rider.id,
      },
      {
        from: OrderStatus.READY_FOR_DISPATCH,
        to: OrderStatus.RIDER_ASSIGNED,
        actor: admin.id,
      },
      {
        from: OrderStatus.RIDER_ASSIGNED,
        to: OrderStatus.PICKED_UP,
        actor: rider.id,
      },
      {
        from: OrderStatus.PICKED_UP,
        to: OrderStatus.ON_THE_WAY,
        actor: rider.id,
      },
      {
        from: OrderStatus.ON_THE_WAY,
        to: OrderStatus.ARRIVED_AT_DESTINATION,
        actor: rider.id,
      },
      {
        from: OrderStatus.ARRIVED_AT_DESTINATION,
        to: OrderStatus.DELIVERED,
        actor: rider.id,
      },
    ]);
  });

  it('enforces rider eligibility and one current assignment under concurrency', async () => {
    const suffix = `${runId}-concurrency`;
    const [customer, admin, rider, inactiveRider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CUSTOMER,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.ADMIN,
        isActive: true,
      }),
      usersRepo.create({
        email: `rider-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.RIDER,
        isActive: true,
      }),
      usersRepo.create({
        email: `inactive-rider-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.RIDER,
        isActive: false,
      }),
    ]);
    const [availableProfile, offlineProfile, inactiveProfile] =
      await riderProfilesRepo.save([
        riderProfilesRepo.create({
          userId: rider.id,
          vehicleType: 'bike',
          isAvailable: true,
        }),
        riderProfilesRepo.create({
          userId: admin.id,
          vehicleType: 'bike',
          isAvailable: false,
        }),
        riderProfilesRepo.create({
          userId: inactiveRider.id,
          vehicleType: 'bike',
          isAvailable: true,
        }),
      ]);
    const [concurrentOrder, offlineOrder, inactiveOrder] =
      await ordersRepo.save(
        ['concurrent', 'offline', 'inactive'].map((label) =>
          ordersRepo.create({
            orderId: `C${runId.slice(-6)}-${label.slice(0, 3)}`,
            userId: customer.id,
            category: 'paper',
            quantity: 1,
            totalPrice: 20,
            deliveryFee: 0,
            paymentMethod: 'cod',
            deliveryOption: 'delivery',
            orderStatus: OrderStatus.READY_FOR_DISPATCH,
          }),
        ),
      );
    const adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    const concurrentResults = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/admin/orders/${concurrentOrder.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId: availableProfile.id }),
      request(app.getHttpServer())
        .post(`/api/admin/orders/${concurrentOrder.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId: availableProfile.id }),
    ]);

    expect(concurrentResults.map((result) => result.status).sort()).toEqual([
      201, 409,
    ]);
    await expect(
      assignmentsRepo.countBy({ orderId: concurrentOrder.id }),
    ).resolves.toBe(1);
    await expect(
      assignmentsRepo.countBy({
        orderId: concurrentOrder.id,
        isCurrent: true,
      }),
    ).resolves.toBe(1);
    await expect(
      statusHistoryRepo.countBy({ orderId: concurrentOrder.id }),
    ).resolves.toBe(1);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${offlineOrder.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: offlineProfile.id })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/admin/orders/${inactiveOrder.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: inactiveProfile.id })
      .expect(400);
    await expect(
      assignmentsRepo.countBy({
        orderId: In([offlineOrder.id, inactiveOrder.id]),
      }),
    ).resolves.toBe(0);
  });

  it('commits assignment and notifies the rider when customer FCM fails', async () => {
    const suffix = `${runId}-fcm-failure`;
    const [customer, admin, rider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CUSTOMER,
        fcmToken: 'failing-customer-token',
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.ADMIN,
        isActive: true,
      }),
      usersRepo.create({
        email: `rider-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.RIDER,
        isActive: true,
      }),
    ]);
    const riderProfile = await riderProfilesRepo.save(
      riderProfilesRepo.create({
        userId: rider.id,
        vehicleType: 'bike',
        isAvailable: true,
      }),
    );
    const order = await ordersRepo.save(
      ordersRepo.create({
        orderId: `F${runId.slice(-8)}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
    );
    const adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });
    const sendToDevice = jest
      .spyOn(app.get(FirebaseService), 'sendToDevice')
      .mockRejectedValueOnce(new Error('FCM unavailable'));

    try {
      await request(app.getHttpServer())
        .post(`/api/admin/orders/${order.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId: riderProfile.id })
        .expect(201);

      await expect(
        assignmentsRepo.countBy({ orderId: order.id, isCurrent: true }),
      ).resolves.toBe(1);
      await expect(
        notificationsRepo.findOneOrFail({
          where: {
            userId: rider.id,
            orderRef: order.orderId,
            type: 'rider_assigned',
          },
        }),
      ).resolves.toMatchObject({ title: 'New delivery assignment' });
    } finally {
      sendToDevice.mockRestore();
    }
  });

  it('rolls back the order update when status history insertion fails', async () => {
    const suffix = `${runId}-rollback`;
    const [customer, admin] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CUSTOMER,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.ADMIN,
        isActive: true,
      }),
    ]);
    const order = await ordersRepo.save(
      ordersRepo.create({
        orderId: `E2E-${suffix}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'pickup',
        orderStatus: OrderStatus.ORDER_PLACED,
      }),
    );
    const adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    await dataSource.query(`
      CREATE FUNCTION fail_task3_status_history() RETURNS trigger AS $$
      BEGIN
        IF NEW.order_id = ${order.id} THEN
          RAISE EXCEPTION 'task3 history failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER fail_task3_status_history_trigger
      BEFORE INSERT ON order_status_history
      FOR EACH ROW EXECUTE FUNCTION fail_task3_status_history()
    `);

    try {
      await request(app.getHttpServer())
        .patch(`/api/admin/orders/${order.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: OrderStatus.FILE_VERIFIED })
        .expect(500);

      await expect(
        ordersRepo.findOneOrFail({ where: { id: order.id } }),
      ).resolves.toMatchObject({ orderStatus: OrderStatus.ORDER_PLACED });
      await expect(
        statusHistoryRepo.countBy({ orderId: order.id }),
      ).resolves.toBe(0);
      await expect(
        notificationsRepo.countBy({ orderRef: order.orderId }),
      ).resolves.toBe(0);
    } finally {
      await dataSource.query(
        `DROP TRIGGER fail_task3_status_history_trigger ON order_status_history`,
      );
      await dataSource.query(`DROP FUNCTION fail_task3_status_history()`);
    }
  });
});
