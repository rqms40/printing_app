import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In, Repository } from 'typeorm';
import { Client } from 'pg';
import { io, Socket } from 'socket.io-client';

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
import {
  Conversation,
  ConversationStatus,
} from '../src/chat/entities/conversation.entity';
import {
  ChatMessage,
  SenderRole,
} from '../src/chat/entities/chat-message.entity';
import { BetaModeSettings } from '../src/beta-mode/entities/beta-mode-settings.entity';
import {
  FileMetadata,
  FilePurpose,
} from '../src/files/entities/file-metadata.entity';
import { TamSurveyRequirement } from '../src/tam-surveys/entities/tam-survey-requirement.entity';
import { OrdersGateway } from '../src/orders/orders.gateway';
import { BatchOrder } from '../src/orders/entities/batch-order.entity';
import { DeliveryDestination } from '../src/orders/entities/delivery-destination.entity';
import { ROUTING_PROVIDER } from '../src/riders/routing/routing-provider';
import { FakeRoutingProvider } from './support/fake-routing-provider';
import {
  DispatchPlanStop,
  DispatchStopStatus,
} from '../src/riders/entities/dispatch-plan-stop.entity';
import {
  DispatchPlan,
  DispatchPlanStatus,
} from '../src/riders/entities/dispatch-plan.entity';

describe('Rider dispatch workflow (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let usersRepo: Repository<User>;
  let ordersRepo: Repository<Order>;
  let riderProfilesRepo: Repository<RiderProfile>;
  let assignmentsRepo: Repository<DeliveryAssignment>;
  let notificationsRepo: Repository<Notification>;
  let statusHistoryRepo: Repository<OrderStatusHistory>;
  let conversationsRepo: Repository<Conversation>;
  let chatMessagesRepo: Repository<ChatMessage>;
  const sockets: Socket[] = [];

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
  const signatureProof = JSON.stringify({
    format: 'gridgo-signature-v1',
    points: [
      [1, 1],
      [2, 2],
    ],
  });
  const emails = {
    customer: `e2e-customer-${runId}@example.com`,
    admin: `e2e-admin-${runId}@example.com`,
    rider: `e2e-rider-${runId}@example.com`,
  };

  async function readAssignmentOtps(assignmentId: number): Promise<{
    pickupOtpCode: string | null;
    deliveryOtpCode: string | null;
  }> {
    const row = await assignmentsRepo.findOneOrFail({
      where: { id: assignmentId },
      select: {
        id: true,
        pickupOtpCode: true,
        deliveryOtpCode: true,
      },
    });
    return {
      pickupOtpCode: row.pickupOtpCode ?? null,
      deliveryOtpCode: row.deliveryOtpCode ?? null,
    };
  }

  async function uploadProofPhoto(
    riderToken: string,
    filename: string,
  ): Promise<number> {
    // Minimal 1x1 PNG
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );
    const res = await request(app.getHttpServer())
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${riderToken}`)
      .field('purpose', 'proof_of_delivery')
      .attach('file', png, { filename, contentType: 'image/png' })
      .expect(201);
    return Number(res.body.id);
  }

  async function advanceStatus(
    assignmentId: number,
    riderToken: string,
    status: DeliveryStatus,
    extra: Record<string, unknown> = {},
  ) {
    if (status === DeliveryStatus.PICKED_UP) {
      const { pickupOtpCode } = await readAssignmentOtps(assignmentId);
      const fileId = await uploadProofPhoto(
        riderToken,
        `pickup-${assignmentId}.png`,
      );
      return request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignmentId}/status`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          status,
          otp: pickupOtpCode,
          proof: { type: ProofOfDeliveryType.PHOTO, fileId },
          ...extra,
        });
    }
    if (status === DeliveryStatus.DELIVERED) {
      const { deliveryOtpCode } = await readAssignmentOtps(assignmentId);
      return request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignmentId}/status`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          status,
          otp: deliveryOtpCode,
          ...extra,
        });
    }
    return request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignmentId}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status, ...extra });
  }

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
    })
      .overrideProvider(ROUTING_PROVIDER)
      .useValue(new FakeRoutingProvider())
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    await app.listen(0);
    baseUrl = await app.getUrl();

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
    usersRepo = dataSource.getRepository(User);
    ordersRepo = dataSource.getRepository(Order);
    riderProfilesRepo = dataSource.getRepository(RiderProfile);
    assignmentsRepo = dataSource.getRepository(DeliveryAssignment);
    notificationsRepo = dataSource.getRepository(Notification);
    statusHistoryRepo = dataSource.getRepository(OrderStatusHistory);
    conversationsRepo = dataSource.getRepository(Conversation);
    chatMessagesRepo = dataSource.getRepository(ChatMessage);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) socket.disconnect();
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

  async function makeOrderRouteable(
    order: Order,
    customerId: number,
    suffix: string,
    latitude = 7.0641,
    longitude = 125.6079,
  ): Promise<void> {
    const batchRepo = dataSource.getRepository(BatchOrder);
    const destinationRepo = dataSource.getRepository(DeliveryDestination);
    const batch = await batchRepo.save(
      batchRepo.create({
        batchRef: `ROUTE-${suffix}`,
        userId: customerId,
        subtotal: 20,
        deliveryFee: 0,
        totalPrice: 20,
        paymentMethod: 'cod',
        paymentStatus: 'paid',
        deliveryOption: 'delivery',
        deliveryType: 'local',
      }),
    );
    const destination = await destinationRepo.save(
      destinationRepo.create({
        batchOrderId: batch.id,
        addressId: null,
        label: 'E2E route stop',
        sortOrder: 0,
        fullAddress: 'GRIDGO deterministic route stop',
        city: 'Davao City',
        latitude,
        longitude,
      }),
    );
    order.batchOrderId = batch.id;
    order.destinationId = destination.id;
    await ordersRepo.save(order);
  }

  it('assigns, notifies, requeues on decline, then completes rider delivery', async () => {
    const customer = await usersRepo.save(
      usersRepo.create({
        email: emails.customer,
        passwordHash: 'not-used',
        fullName: 'E2E Customer',
        role: UserRole.CLIENT,
        isActive: true,
      }),
    );
    const admin = await usersRepo.save(
      usersRepo.create({
        email: emails.admin,
        passwordHash: 'not-used',
        fullName: 'E2E Admin',
        role: UserRole.OPS_ADMIN,
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
    await makeOrderRouteable(order, customer.id, `${runId}-main`);

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

    await request(app.getHttpServer())
      .post(`/api/admin/riders/${riderProfile.id}/dispatch-plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignmentIds: [assignment.id] })
      .expect(201);

    const transitions: Array<[DeliveryStatus, OrderStatus]> = [
      [DeliveryStatus.ACCEPTED, OrderStatus.RIDER_ASSIGNED],
      [DeliveryStatus.PICKED_UP, OrderStatus.PICKED_UP],
      [DeliveryStatus.ON_THE_WAY, OrderStatus.OUT_FOR_DELIVERY],
      [DeliveryStatus.ARRIVED, OrderStatus.OUT_FOR_DELIVERY],
    ];

    for (const [deliveryStatus, orderStatus] of transitions) {
      const response = await advanceStatus(
        assignment.id,
        riderToken,
        deliveryStatus,
      );
      expect(response.status).toBe(200);
      expect(response.body.status).toBe(deliveryStatus);
      expect(response.body.pickupOtpCode).toBeUndefined();
      expect(response.body.deliveryOtpCode).toBeUndefined();

      await expect(
        ordersRepo.findOneOrFail({ where: { id: order.id } }),
      ).resolves.toMatchObject({ orderStatus });
    }

    const { deliveryOtpCode } = await readAssignmentOtps(assignment.id);
    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.DELIVERED, otp: deliveryOtpCode })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('Proof of delivery is required');
      });

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        status: DeliveryStatus.DELIVERED,
        otp: '000000',
        proof: {
          type: ProofOfDeliveryType.SIGNATURE,
          signatureData: signatureProof,
        },
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe('Invalid OTP');
      });

    const deliveredResponse = await advanceStatus(
      assignment.id,
      riderToken,
      DeliveryStatus.DELIVERED,
      {
        proof: {
          type: ProofOfDeliveryType.SIGNATURE,
          signatureData: signatureProof,
        },
      },
    );
    expect(deliveredResponse.status).toBe(200);
    expect(deliveredResponse.body.status).toBe(DeliveryStatus.DELIVERED);
    expect(deliveredResponse.body.proofType).toBe(
      ProofOfDeliveryType.SIGNATURE,
    );
    expect(deliveredResponse.body.proofSignatureData).toBe(signatureProof);

    // Double-complete is rejected.
    expect(
      (
        await advanceStatus(
          assignment.id,
          riderToken,
          DeliveryStatus.DELIVERED,
          {
            proof: {
              type: ProofOfDeliveryType.SIGNATURE,
              signatureData: signatureProof,
            },
          },
        )
      ).status,
    ).toBe(400);

    await expect(
      ordersRepo.findOneOrFail({ where: { id: order.id } }),
    ).resolves.toMatchObject({ orderStatus: OrderStatus.ISSUE_WINDOW_OPEN });

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
        to: OrderStatus.OUT_FOR_DELIVERY,
        actor: rider.id,
      },
      {
        from: OrderStatus.OUT_FOR_DELIVERY,
        to: OrderStatus.DELIVERED,
        actor: rider.id,
      },
      {
        from: OrderStatus.DELIVERED,
        to: OrderStatus.ISSUE_WINDOW_OPEN,
        actor: rider.id,
      },
    ]);
  });

  it('rolls back a later planned decline and marks current-stop promotion stale until re-optimized', async () => {
    const suffix = `${runId}-planned-decline`;
    const [customer, admin, rider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CLIENT,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
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
    const [nearOrder, farOrder] = await ordersRepo.save([
      ordersRepo.create({
        orderId: `NEAR-${suffix}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
      ordersRepo.create({
        orderId: `FAR-${suffix}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
    ]);
    await makeOrderRouteable(
      nearOrder,
      customer.id,
      `${suffix}-near`,
      7.0641,
      125.6079,
    );
    await makeOrderRouteable(
      farOrder,
      customer.id,
      `${suffix}-far`,
      7.0731,
      125.6128,
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
    const customerToken = jwtService.sign({
      sub: customer.id,
      email: customer.email,
      role: customer.role,
    });
    for (const order of [nearOrder, farOrder]) {
      await request(app.getHttpServer())
        .post(`/api/admin/orders/${order.id}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ riderId: riderProfile.id })
        .expect(201);
    }
    const plannedAssignments = await assignmentsRepo.find({
      where: { riderId: riderProfile.id, isCurrent: true },
      order: { id: 'ASC' },
    });
    const nearAssignment = plannedAssignments.find(
      (assignment) => assignment.orderId === nearOrder.id,
    )!;
    const farAssignment = plannedAssignments.find(
      (assignment) => assignment.orderId === farOrder.id,
    )!;
    await request(app.getHttpServer())
      .post(`/api/admin/riders/${riderProfile.id}/dispatch-plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignmentIds: [nearAssignment.id, farAssignment.id] })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${farAssignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.DECLINED, declineReason: 'Later stop' })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toBe(
          'Complete the current route stop before advancing this delivery',
        );
      });
    await expect(
      assignmentsRepo.findOneByOrFail({ id: farAssignment.id }),
    ).resolves.toMatchObject({
      status: DeliveryStatus.ASSIGNED,
      isCurrent: true,
      declineReason: null,
    });
    await expect(
      ordersRepo.findOneByOrFail({ id: farOrder.id }),
    ).resolves.toMatchObject({ orderStatus: OrderStatus.RIDER_ASSIGNED });
    await expect(
      dataSource.getRepository(DispatchPlanStop).findOneByOrFail({
        assignmentId: farAssignment.id,
      }),
    ).resolves.toMatchObject({ status: DispatchStopStatus.PENDING });
    await expect(
      dataSource.getRepository(DispatchPlan).findOneByOrFail({
        riderId: riderProfile.id,
        status: DispatchPlanStatus.ACTIVE,
      }),
    ).resolves.toMatchObject({ routingDataStale: false, version: 1 });

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${nearAssignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.DECLINED, declineReason: 'Current stop' })
      .expect(200);
    await expect(
      dataSource.getRepository(DispatchPlanStop).findOneByOrFail({
        assignmentId: nearAssignment.id,
      }),
    ).resolves.toMatchObject({
      status: DispatchStopStatus.SKIPPED,
      skippedAt: expect.any(Date),
    });
    await expect(
      dataSource.getRepository(DispatchPlan).findOneByOrFail({
        riderId: riderProfile.id,
        status: DispatchPlanStatus.ACTIVE,
      }),
    ).resolves.toMatchObject({ routingDataStale: true, version: 1 });

    for (const status of [
      DeliveryStatus.ACCEPTED,
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.ON_THE_WAY,
    ]) {
      expect(
        (await advanceStatus(farAssignment.id, riderToken, status)).status,
      ).toBe(200);
    }
    await request(app.getHttpServer())
      .get(`/api/orders/${farOrder.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.deliveryQueuePosition).toBe(1);
        expect(res.body.deliveryAssignmentId).toBe(farAssignment.id);
        expect(res.body.deliveryRouteGeometry).toMatchObject({
          type: 'LineString',
        });
        expect(res.body.deliveryRoutingDataStale).toBe(true);
      });

    await request(app.getHttpServer())
      .post(`/api/admin/riders/${riderProfile.id}/dispatch-plan/re-optimize`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignmentIds: [farAssignment.id] })
      .expect(201)
      .expect((res) => {
        expect(res.body.version).toBe(2);
        expect(res.body.routingDataStale).toBe(false);
      });
    await request(app.getHttpServer())
      .get(`/api/orders/${farOrder.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body.deliveryPlanVersion).toBe(2);
        expect(res.body.deliveryRoutingDataStale).toBe(false);
      });
  });

  it('enforces rider eligibility and one current assignment under concurrency', async () => {
    const suffix = `${runId}-concurrency`;
    const [customer, admin, rider, inactiveRider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CLIENT,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
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
        role: UserRole.CLIENT,
        fcmToken: 'failing-customer-token',
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
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

  it('enforces pickup and delivery modes at the dispatch boundary', async () => {
    const suffix = `${runId}-delivery-mode`;
    const [customer, admin, rider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CLIENT,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
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
    const [deliveryOrder, pickupOrder] = await ordersRepo.save([
      ordersRepo.create({
        orderId: `D${runId.slice(-8)}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 25,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
      ordersRepo.create({
        orderId: `P${runId.slice(-8)}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'pickup',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
    ]);
    const adminToken = jwtService.sign({
      sub: admin.id,
      email: admin.email,
      role: admin.role,
    });

    await request(app.getHttpServer())
      .patch('/api/orders/not-an-order-id/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.APPROVED_FOR_MATCHING })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${deliveryOrder.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: 'not-a-rider-id' })
      .expect(400);
    await request(app.getHttpServer())
      .patch('/api/riders/assignments/not-an-assignment-id/status')
      .set(
        'Authorization',
        `Bearer ${jwtService.sign({
          sub: rider.id,
          email: rider.email,
          role: rider.role,
        })}`,
      )
      .send({ status: DeliveryStatus.ACCEPTED })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/api/admin/orders/${deliveryOrder.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: OrderStatus.COLLECTED_BY_CUSTOMER })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/admin/orders/${pickupOrder.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: riderProfile.id })
      .expect(400);

    await expect(
      ordersRepo.findBy({ id: In([deliveryOrder.id, pickupOrder.id]) }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: deliveryOrder.id,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        }),
        expect.objectContaining({
          id: pickupOrder.id,
          orderStatus: OrderStatus.READY_FOR_DISPATCH,
        }),
      ]),
    );
    await expect(
      assignmentsRepo.countBy({
        orderId: In([deliveryOrder.id, pickupOrder.id]),
      }),
    ).resolves.toBe(0);
    await expect(
      statusHistoryRepo.countBy({
        orderId: In([deliveryOrder.id, pickupOrder.id]),
      }),
    ).resolves.toBe(0);
  });

  it('revokes declined rider chat atomically and authorizes the replacement rider', async () => {
    const suffix = `${runId}-chat-revocation`;
    const [customer, admin, oldRider, replacementRider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CLIENT,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
        isActive: true,
      }),
      usersRepo.create({
        email: `old-rider-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.RIDER,
        isActive: true,
      }),
      usersRepo.create({
        email: `replacement-rider-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.RIDER,
        isActive: true,
      }),
    ]);
    const [oldProfile, replacementProfile] = await riderProfilesRepo.save([
      riderProfilesRepo.create({
        userId: oldRider.id,
        vehicleType: 'bike',
        isAvailable: true,
      }),
      riderProfilesRepo.create({
        userId: replacementRider.id,
        vehicleType: 'bike',
        isAvailable: true,
      }),
    ]);
    const order = await ordersRepo.save(
      ordersRepo.create({
        orderId: `CHAT-${runId}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 20,
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
    const oldRiderToken = jwtService.sign({
      sub: oldRider.id,
      email: oldRider.email,
      role: oldRider.role,
    });
    const replacementToken = jwtService.sign({
      sub: replacementRider.id,
      email: replacementRider.email,
      role: replacementRider.role,
    });

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: oldProfile.id })
      .expect(201);
    const assignment = await assignmentsRepo.findOneOrFail({
      where: { orderId: order.id, isCurrent: true },
    });
    const opened = await request(app.getHttpServer())
      .post(`/api/chat/orders/${order.id}/conversation`)
      .set('Authorization', `Bearer ${oldRiderToken}`)
      .expect(201);
    const oldConversationId = Number(opened.body.id);
    await chatMessagesRepo.save(
      chatMessagesRepo.create({
        conversationId: oldConversationId,
        senderId: oldRider.id,
        senderRole: SenderRole.RIDER,
        content: 'Audit message',
      }),
    );
    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${oldConversationId}/messages`)
      .set('Authorization', `Bearer ${oldRiderToken}`)
      .expect(200);

    const oldSocket = await connectChatSocket(baseUrl, oldRiderToken, sockets);
    const oldSocketJoined = onceSocketEvent<{ conversationId: number }>(
      oldSocket,
      'joined',
    );
    oldSocket.emit('join-conversation', {
      conversationId: oldConversationId,
    });
    await expect(oldSocketJoined).resolves.toEqual({
      conversationId: oldConversationId,
    });

    await dataSource.query(`
      CREATE FUNCTION fail_task3_chat_close() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = ${oldConversationId} AND NEW.status::text = 'closed' THEN
          RAISE EXCEPTION 'task3 chat close failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER fail_task3_chat_close_trigger
      BEFORE UPDATE ON chat_conversations
      FOR EACH ROW EXECUTE FUNCTION fail_task3_chat_close()
    `);
    try {
      await request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignment.id}/status`)
        .set('Authorization', `Bearer ${oldRiderToken}`)
        .send({ status: DeliveryStatus.DECLINED, declineReason: 'Too far' })
        .expect(500);
      await expectDeclineState({
        orderId: order.id,
        assignmentId: assignment.id,
        conversationId: oldConversationId,
        historyCount: 1,
      });
    } finally {
      await dataSource.query(
        `DROP TRIGGER fail_task3_chat_close_trigger ON chat_conversations`,
      );
      await dataSource.query(`DROP FUNCTION fail_task3_chat_close()`);
    }

    await dataSource.query(`
      CREATE FUNCTION fail_task3_decline_history() RETURNS trigger AS $$
      BEGIN
        IF NEW.order_id = ${order.id}
           AND NEW.to_status::text = 'ready_for_dispatch' THEN
          RAISE EXCEPTION 'task3 decline history failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER fail_task3_decline_history_trigger
      BEFORE INSERT ON order_status_history
      FOR EACH ROW EXECUTE FUNCTION fail_task3_decline_history()
    `);
    try {
      await request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignment.id}/status`)
        .set('Authorization', `Bearer ${oldRiderToken}`)
        .send({ status: DeliveryStatus.DECLINED, declineReason: 'Too far' })
        .expect(500);
      await expectDeclineState({
        orderId: order.id,
        assignmentId: assignment.id,
        conversationId: oldConversationId,
        historyCount: 1,
      });
    } finally {
      await dataSource.query(
        `DROP TRIGGER fail_task3_decline_history_trigger ON order_status_history`,
      );
      await dataSource.query(`DROP FUNCTION fail_task3_decline_history()`);
    }

    const closedEvent = onceSocketEvent<{ conversationId: number }>(
      oldSocket,
      'conversation-closed',
    );
    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignment.id}/status`)
      .set('Authorization', `Bearer ${oldRiderToken}`)
      .send({ status: DeliveryStatus.DECLINED, declineReason: 'Too far' })
      .expect(200);
    await expect(closedEvent).resolves.toEqual({
      conversationId: oldConversationId,
    });

    await expect(
      conversationsRepo.findOneOrFail({ where: { id: oldConversationId } }),
    ).resolves.toMatchObject({
      assignedRiderId: oldRider.id,
      status: ConversationStatus.CLOSED,
      closedAt: expect.any(Date),
    });
    await expect(
      chatMessagesRepo.countBy({ conversationId: oldConversationId }),
    ).resolves.toBe(1);
    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${oldConversationId}/messages`)
      .set('Authorization', `Bearer ${oldRiderToken}`)
      .expect(403);
    const oldSocketDenied = onceSocketEvent<{ message: string }>(
      oldSocket,
      'exception',
    );
    oldSocket.emit('join-conversation', {
      conversationId: oldConversationId,
    });
    await expect(oldSocketDenied).resolves.toMatchObject({
      message: 'Forbidden',
    });

    await request(app.getHttpServer())
      .post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: replacementProfile.id })
      .expect(201);
    const replacementOpened = await request(app.getHttpServer())
      .post(`/api/chat/orders/${order.id}/conversation`)
      .set('Authorization', `Bearer ${replacementToken}`)
      .expect(201);
    const replacementConversationId = Number(replacementOpened.body.id);
    expect(replacementConversationId).not.toBe(oldConversationId);
    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${replacementConversationId}/messages`)
      .set('Authorization', `Bearer ${replacementToken}`)
      .expect(200);
    const replacementSocket = await connectChatSocket(
      baseUrl,
      replacementToken,
      sockets,
    );
    const replacementJoined = onceSocketEvent<{ conversationId: number }>(
      replacementSocket,
      'joined',
    );
    replacementSocket.emit('join-conversation', {
      conversationId: replacementConversationId,
    });
    await expect(replacementJoined).resolves.toEqual({
      conversationId: replacementConversationId,
    });

    await request(app.getHttpServer())
      .patch(`/api/chat/conversations/${replacementConversationId}/close`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const replacementAssignment = await assignmentsRepo.findOneOrFail({
      where: { orderId: order.id, isCurrent: true },
    });

    await dataSource.query(`
      CREATE FUNCTION delay_task3_chat_open() RETURNS trigger AS $$
      BEGIN
        IF NEW.order_id = ${order.id}
           AND NEW.assigned_rider_id = ${replacementRider.id} THEN
          PERFORM pg_sleep(1);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER delay_task3_chat_open_trigger
      BEFORE INSERT ON chat_conversations
      FOR EACH ROW EXECUTE FUNCTION delay_task3_chat_open()
    `);
    let concurrentOpen: request.Response;
    try {
      const openPromise = request(app.getHttpServer())
        .post(`/api/chat/orders/${order.id}/conversation`)
        .set('Authorization', `Bearer ${replacementToken}`)
        .then((response) => response);
      await waitForActiveDatabaseQuery(
        dataSource,
        '%INSERT INTO "chat_conversations"%',
      );
      const declinePromise = request(app.getHttpServer())
        .patch(`/api/riders/assignments/${replacementAssignment.id}/status`)
        .set('Authorization', `Bearer ${replacementToken}`)
        .send({
          status: DeliveryStatus.DECLINED,
          declineReason: 'Concurrent chat test',
        })
        .then((response) => response);

      const [openResponse, declineResponse] = await Promise.all([
        openPromise,
        declinePromise,
      ]);
      expect(openResponse.status).toBe(201);
      expect(declineResponse.status).toBe(200);
      concurrentOpen = openResponse;
    } finally {
      await dataSource.query(
        `DROP TRIGGER delay_task3_chat_open_trigger ON chat_conversations`,
      );
      await dataSource.query(`DROP FUNCTION delay_task3_chat_open()`);
    }

    const concurrentConversationId = Number(concurrentOpen.body.id);
    await expect(
      conversationsRepo.findOneOrFail({
        where: { id: concurrentConversationId },
      }),
    ).resolves.toMatchObject({
      assignedRiderId: replacementRider.id,
      status: ConversationStatus.CLOSED,
      closedAt: expect.any(Date),
    });
    await request(app.getHttpServer())
      .get(`/api/chat/conversations/${concurrentConversationId}/messages`)
      .set('Authorization', `Bearer ${replacementToken}`)
      .expect(403);
  }, 30_000);

  it('rolls back the order update when status history insertion fails', async () => {
    const suffix = `${runId}-rollback`;
    const [customer, admin] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CLIENT,
        isActive: true,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
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
        orderStatus: OrderStatus.NEEDS_QA,
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
        .send({ status: OrderStatus.APPROVED_FOR_MATCHING })
        .expect(500);

      await expect(
        ordersRepo.findOneOrFail({ where: { id: order.id } }),
      ).resolves.toMatchObject({ orderStatus: OrderStatus.NEEDS_QA });
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

  it('rolls back assignment proof, delivery, expiry, history, and events when survey creation fails', async () => {
    const suffix = `${runId}-survey-rollback`;
    const [customer, admin, rider] = await usersRepo.save([
      usersRepo.create({
        email: `customer-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.CLIENT,
        isActive: true,
        isBetaUser: true,
        fileRetentionDays: 7,
      }),
      usersRepo.create({
        email: `admin-${suffix}@example.com`,
        passwordHash: 'not-used',
        role: UserRole.OPS_ADMIN,
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
    const fileRepo = dataSource.getRepository(FileMetadata);
    const orderFile = await fileRepo.save(
      fileRepo.create({
        originalName: `${suffix}.pdf`,
        mimeType: 'application/pdf',
        size: 10,
        url: `https://files.test/${suffix}.pdf`,
        objectKey: `uploads/general/${suffix}.pdf`,
        uploadedBy: customer.id,
        purpose: FilePurpose.GENERAL,
      }),
    );
    const order = await ordersRepo.save(
      ordersRepo.create({
        orderId: `E2E-${suffix}`,
        userId: customer.id,
        category: 'paper',
        fileMetadataId: orderFile.id,
        quantity: 1,
        totalPrice: 20,
        deliveryFee: 0,
        paymentMethod: 'cod',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
      }),
    );
    await makeOrderRouteable(order, customer.id, suffix);
    const betaSettingsRepo = dataSource.getRepository(BetaModeSettings);
    const betaSettings =
      (await betaSettingsRepo.find())[0] ??
      betaSettingsRepo.create({ isEnabled: true });
    betaSettings.isEnabled = true;
    await betaSettingsRepo.save(betaSettings);

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
      .post(`/api/admin/orders/${order.id}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ riderId: riderProfile.id })
      .expect(201);
    const assignment = await assignmentsRepo.findOneOrFail({
      where: { orderId: order.id, isCurrent: true },
    });
    await request(app.getHttpServer())
      .post(`/api/admin/riders/${riderProfile.id}/dispatch-plan`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ assignmentIds: [assignment.id] })
      .expect(201);
    for (const status of [
      DeliveryStatus.ACCEPTED,
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.ON_THE_WAY,
      DeliveryStatus.ARRIVED,
    ]) {
      expect(
        (await advanceStatus(assignment.id, riderToken, status)).status,
      ).toBe(200);
    }

    const notificationCount = await notificationsRepo.countBy({
      orderRef: order.orderId,
    });
    const historyCount = await statusHistoryRepo.countBy({ orderId: order.id });
    const ordersGateway = app.get(OrdersGateway);
    const orderEvent = jest.spyOn(ordersGateway, 'notifyOrderUpdate');
    const surveyEvent = jest.spyOn(ordersGateway, 'notifySurveyRequired');
    await dataSource.query(`
      CREATE FUNCTION fail_task4_survey_insert() RETURNS trigger AS $$
      BEGIN
        IF NEW.order_id = ${order.id} THEN
          RAISE EXCEPTION 'task4 survey failure';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER fail_task4_survey_insert_trigger
      BEFORE INSERT ON tam_survey_requirements
      FOR EACH ROW EXECUTE FUNCTION fail_task4_survey_insert()
    `);

    try {
      await request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignment.id}/status`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({
          status: DeliveryStatus.DELIVERED,
          otp: (await readAssignmentOtps(assignment.id)).deliveryOtpCode,
          proof: {
            type: ProofOfDeliveryType.SIGNATURE,
            signatureData: signatureProof,
          },
        })
        .expect(500);

      await expect(
        assignmentsRepo.findOneOrFail({ where: { id: assignment.id } }),
      ).resolves.toMatchObject({
        status: DeliveryStatus.ARRIVED,
        deliveredAt: null,
        proofType: null,
        proofSignatureData: null,
      });
      await expect(
        ordersRepo.findOneOrFail({ where: { id: order.id } }),
      ).resolves.toMatchObject({
        orderStatus: OrderStatus.OUT_FOR_DELIVERY,
      });
      await expect(
        fileRepo.findOneOrFail({ where: { id: orderFile.id } }),
      ).resolves.toMatchObject({ expiresAt: null });
      await expect(
        statusHistoryRepo.countBy({ orderId: order.id }),
      ).resolves.toBe(historyCount);
      await expect(
        dataSource.getRepository(TamSurveyRequirement).countBy({
          orderId: order.id,
        }),
      ).resolves.toBe(0);
      await expect(
        dataSource.getRepository(DispatchPlanStop).findOneOrFail({
          where: { assignmentId: assignment.id },
        }),
      ).resolves.toMatchObject({
        status: DispatchStopStatus.PENDING,
        completedAt: null,
      });
      await expect(
        notificationsRepo.countBy({ orderRef: order.orderId }),
      ).resolves.toBe(notificationCount);
      expect(orderEvent).not.toHaveBeenCalled();
      expect(surveyEvent).not.toHaveBeenCalled();
    } finally {
      orderEvent.mockRestore();
      surveyEvent.mockRestore();
      await dataSource.query(
        `DROP TRIGGER fail_task4_survey_insert_trigger ON tam_survey_requirements`,
      );
      await dataSource.query(`DROP FUNCTION fail_task4_survey_insert()`);
    }
  });

  async function expectDeclineState({
    orderId,
    assignmentId,
    conversationId,
    historyCount,
  }: {
    orderId: number;
    assignmentId: number;
    conversationId: number;
    historyCount: number;
  }): Promise<void> {
    await expect(
      ordersRepo.findOneOrFail({ where: { id: orderId } }),
    ).resolves.toMatchObject({
      orderStatus: OrderStatus.RIDER_ASSIGNED,
    });
    await expect(
      assignmentsRepo.findOneOrFail({ where: { id: assignmentId } }),
    ).resolves.toMatchObject({
      status: DeliveryStatus.ASSIGNED,
      isCurrent: true,
    });
    await expect(
      conversationsRepo.findOneOrFail({ where: { id: conversationId } }),
    ).resolves.toMatchObject({
      status: ConversationStatus.OPEN,
      closedAt: null,
    });
    await expect(statusHistoryRepo.countBy({ orderId })).resolves.toBe(
      historyCount,
    );
  }
});

async function connectChatSocket(
  baseUrl: string,
  token: string,
  sockets: Socket[],
): Promise<Socket> {
  const socket = io(`${baseUrl}/ws/chat`, {
    transports: ['websocket'],
    auth: { token },
    forceNew: true,
    reconnection: false,
  });
  sockets.push(socket);
  const connected = onceSocketEvent<void>(socket, 'connect');
  const sessionReady = onceSocketEvent<{ userId: number }>(
    socket,
    'session-ready',
  );
  await connected;
  await sessionReady;
  return socket;
}

function onceSocketEvent<T = unknown>(
  socket: Socket,
  event: string,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      10_000,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timeout);
      resolve(payload);
    });
  });
}

async function waitForActiveDatabaseQuery(
  dataSource: DataSource,
  queryPattern: string,
): Promise<void> {
  const deadline = Date.now() + 2_000;
  while (Date.now() < deadline) {
    const [row] = await dataSource.query<Array<{ active: boolean }>>(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND pid <> pg_backend_pid()
           AND state = 'active'
           AND query LIKE $1
       ) AS active`,
      [queryPattern],
    );
    if (row?.active) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for active query: ${queryPattern}`);
}
