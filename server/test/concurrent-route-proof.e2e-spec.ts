import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, Socket } from 'socket.io-client';
import { DataSource, Repository } from 'typeorm';
import { Client } from 'pg';

import { AppModule } from '../src/app.module';
import { User, UserRole } from '../src/users/entities/user.entity';
import { Address } from '../src/addresses/entities/address.entity';
import { BatchOrder } from '../src/orders/entities/batch-order.entity';
import { DeliveryDestination } from '../src/orders/entities/delivery-destination.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { RiderProfile } from '../src/riders/entities/rider-profile.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
  ProofOfDeliveryType,
} from '../src/riders/entities/delivery-assignment.entity';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { StorageService } from '../src/storage/storage.service';

type StopSeed = {
  label: string;
  orderRef: string;
  latitude: number;
  longitude: number;
};

describe('Concurrent order route and proof workflow (e2e)', () => {
  let app: INestApplication<App>;
  let baseUrl: string;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let usersRepo: Repository<User>;
  let addressesRepo: Repository<Address>;
  let batchOrdersRepo: Repository<BatchOrder>;
  let destinationsRepo: Repository<DeliveryDestination>;
  let ordersRepo: Repository<Order>;
  let riderProfilesRepo: Repository<RiderProfile>;
  let assignmentsRepo: Repository<DeliveryAssignment>;
  let storageService: StorageService;

  const sockets: Socket[] = [];
  const storageObjectKeys = new Set<string>();
  const runId = Date.now().toString().slice(-8);
  const originalDatabaseName = process.env.DATABASE_NAME;
  const originalJwtSecret = process.env.JWT_SECRET;
  const isolatedDatabase = `gridgo_route_proof_${process.pid}_${runId}`;
  const adminConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: originalDatabaseName ?? 'grid_print',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
  };
  const emails = {
    admin: `route-admin-${runId}@example.com`,
    rider: `route-rider-${runId}@example.com`,
  };
  const stops: StopSeed[] = [
    {
      label: 'Far',
      orderRef: `RFAR-${runId}`,
      latitude: 7.12,
      longitude: 125.65,
    },
    {
      label: 'Near',
      orderRef: `RNEAR-${runId}`,
      latitude: 7.065,
      longitude: 125.609,
    },
    {
      label: 'Mid',
      orderRef: `RMID-${runId}`,
      latitude: 7.08,
      longitude: 125.62,
    },
  ];

  beforeAll(async () => {
    if (!/^[a-z0-9_]+$/.test(isolatedDatabase)) {
      throw new Error('Unsafe isolated database identifier');
    }
    const admin = new Client(adminConfig);
    await admin.connect();
    await admin.query(`CREATE DATABASE "${isolatedDatabase}"`);
    await admin.end();

    process.env.DATABASE_NAME = isolatedDatabase;
    process.env.JWT_SECRET = originalJwtSecret ?? `route-proof-${runId}`;
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
    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
    usersRepo = dataSource.getRepository(User);
    addressesRepo = dataSource.getRepository(Address);
    batchOrdersRepo = dataSource.getRepository(BatchOrder);
    destinationsRepo = dataSource.getRepository(DeliveryDestination);
    ordersRepo = dataSource.getRepository(Order);
    riderProfilesRepo = dataSource.getRepository(RiderProfile);
    assignmentsRepo = dataSource.getRepository(DeliveryAssignment);
    storageService = app.get(StorageService);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    for (const objectKey of storageObjectKeys) {
      await storageService.delete(objectKey).catch(() => undefined);
    }
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

  it('routes simultaneous orders from the shop and completes signature and photo proof', async () => {
    const admin = await usersRepo.save(
      usersRepo.create({
        email: emails.admin,
        passwordHash: 'not-used',
        fullName: 'Route E2E Admin',
        role: UserRole.ADMIN,
        isActive: true,
      }),
    );
    const rider = await usersRepo.save(
      usersRepo.create({
        email: emails.rider,
        passwordHash: 'not-used',
        fullName: 'Route E2E Rider',
        role: UserRole.RIDER,
        isActive: true,
      }),
    );
    const riderProfile = await riderProfilesRepo.save(
      riderProfilesRepo.create({
        userId: rider.id,
        vehicleType: 'motorcycle',
        plateNumber: 'ROUTE-1',
        licenseNumber: 'ROUTE-LIC',
        isAvailable: true,
        lastLatitude: null,
        lastLongitude: null,
      }),
    );
    const createdOrders = await Promise.all(
      stops.map((stop) => createReadyOrder(stop)),
    );

    const adminToken = sign(admin);
    const riderToken = sign(rider);
    const photoUpload = await request(app.getHttpServer())
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${riderToken}`)
      .field('purpose', 'proof_of_delivery')
      .attach('file', Buffer.from('real-route-photo-bytes'), {
        filename: `route-photo-${runId}.jpg`,
        contentType: 'image/jpeg',
      })
      .expect(201);
    const photoProof = photoUpload.body as {
      id: number;
      objectKey: string;
    };
    storageObjectKeys.add(photoProof.objectKey);

    await Promise.all(
      createdOrders.map((order) =>
        request(app.getHttpServer())
          .post(`/api/admin/orders/${order.id}/assign`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ riderId: riderProfile.id })
          .expect(201),
      ),
    );

    const routeResponse = await request(app.getHttpServer())
      .get('/api/riders/assignments')
      .set('Authorization', `Bearer ${riderToken}`)
      .expect(200);

    const routeRefs = routeResponse.body.map(
      (assignment: { order?: { orderId?: string } }) =>
        assignment.order?.orderId,
    );
    expect(routeRefs.slice(0, 3)).toEqual([
      `RNEAR-${runId}`,
      `RMID-${runId}`,
      `RFAR-${runId}`,
    ]);

    const assignments = await assignmentsRepo.find({
      relations: ['order'],
      where: { riderId: riderProfile.id },
    });
    const assignmentByRef = new Map(
      assignments.map((assignment) => [assignment.order.orderId, assignment]),
    );
    const nearAssignment = assignmentByRef.get(`RNEAR-${runId}`)!;
    const midAssignment = assignmentByRef.get(`RMID-${runId}`)!;
    const farAssignment = assignmentByRef.get(`RFAR-${runId}`)!;

    const nearCustomer = await usersRepo.findOneOrFail({
      where: { id: nearAssignment.order.userId },
    });
    await advanceToOnTheWay(nearAssignment.id, riderToken);
    const locationSocket = await subscribeToLocation(
      nearAssignment.id,
      sign(nearCustomer),
    );
    const locationUpdate = onceSocketEvent(locationSocket, 'locationUpdate');
    await request(app.getHttpServer())
      .patch('/api/riders/location')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ latitude: 7.0648, longitude: 125.6087 })
      .expect(200);
    await expect(locationUpdate).resolves.toMatchObject({
      latitude: 7.0648,
      longitude: 125.6087,
    });

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${nearAssignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.ARRIVED })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${nearAssignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        status: DeliveryStatus.DELIVERED,
        proof: {
          type: ProofOfDeliveryType.SIGNATURE,
          signatureData: `svg:route-signature-${runId}`,
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(DeliveryStatus.DELIVERED);
        expect(res.body.proofType).toBe(ProofOfDeliveryType.SIGNATURE);
        expect(res.body.proofSignatureData).toBe(
          `svg:route-signature-${runId}`,
        );
      });

    await advanceToArrived(midAssignment.id, riderToken);
    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${midAssignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({
        status: DeliveryStatus.DELIVERED,
        proof: {
          type: ProofOfDeliveryType.PHOTO,
          fileId: photoProof.id,
          objectKey: `spoofed/client-route-photo-${runId}.jpg`,
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(DeliveryStatus.DELIVERED);
        expect(res.body.proofType).toBe(ProofOfDeliveryType.PHOTO);
        expect(res.body.proofFileId).toBe(photoProof.id);
        expect(res.body.proofObjectKey).toBe(photoProof.objectKey);
        expect(res.body.proofSignatureData).toBeNull();
      });

    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${farAssignment.id}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.DELIVERED })
      .expect(400)
      .expect((res) => {
        expect(res.body.message).toContain('Cannot transition from');
      });

    await expect(
      ordersRepo.findOneOrFail({ where: { id: nearAssignment.orderId } }),
    ).resolves.toMatchObject({ orderStatus: OrderStatus.DELIVERED });
    await expect(
      ordersRepo.findOneOrFail({ where: { id: midAssignment.orderId } }),
    ).resolves.toMatchObject({ orderStatus: OrderStatus.DELIVERED });
    await expect(
      assignmentsRepo.findOneOrFail({ where: { id: farAssignment.id } }),
    ).resolves.toMatchObject({ status: DeliveryStatus.ASSIGNED });
  });

  async function createReadyOrder(stop: StopSeed): Promise<Order> {
    const customer = await usersRepo.save(
      usersRepo.create({
        email: customerEmail(stop),
        passwordHash: 'not-used',
        fullName: `Route ${stop.label} Customer`,
        role: UserRole.CUSTOMER,
        isActive: true,
      }),
    );
    const address = await addressesRepo.save(
      addressesRepo.create({
        userId: customer.id,
        label: `Route ${runId} ${stop.label}`,
        fullAddress: `${stop.label} route stop, Davao City`,
        barangay: 'Poblacion',
        city: 'Davao City',
        province: 'Davao del Sur',
        zipCode: '8000',
        landmark: 'GRIDGO E2E',
        latitude: stop.latitude,
        longitude: stop.longitude,
        isDefault: true,
      }),
    );
    const batch = await batchOrdersRepo.save(
      batchOrdersRepo.create({
        batchRef: `ROUTE-BATCH-${runId}-${stop.label}`,
        userId: customer.id,
        subtotal: 120,
        deliveryFee: 50,
        totalPrice: 170,
        paymentMethod: 'cod',
        paymentStatus: 'paid',
        deliveryOption: 'delivery',
        deliveryAddressId: address.id,
        deliveryType: 'local',
        priorityFee: 0,
        extraDestinationFee: 0,
      }),
    );
    const destination = await destinationsRepo.save(
      destinationsRepo.create({
        batchOrderId: batch.id,
        addressId: address.id,
        label: `Route ${runId} ${stop.label}`,
        sortOrder: 0,
        fullAddress: address.fullAddress,
        barangay: address.barangay,
        city: address.city,
        province: address.province,
        zipCode: address.zipCode,
        landmark: address.landmark,
        latitude: stop.latitude,
        longitude: stop.longitude,
      }),
    );

    return ordersRepo.save(
      ordersRepo.create({
        orderId: stop.orderRef,
        userId: customer.id,
        batchOrderId: batch.id,
        destinationId: destination.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 120,
        deliveryFee: 50,
        paymentMethod: 'cod',
        paymentStatus: 'paid',
        deliveryOption: 'delivery',
        deliveryAddressId: address.id,
        orderStatus: OrderStatus.READY_FOR_DISPATCH,
        fileName: `${stop.orderRef}.pdf`,
      }),
    );
  }

  async function advanceToArrived(assignmentId: number, riderToken: string) {
    await advanceToOnTheWay(assignmentId, riderToken);
    await request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignmentId}/status`)
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ status: DeliveryStatus.ARRIVED })
      .expect(200);
  }

  async function advanceToOnTheWay(assignmentId: number, riderToken: string) {
    for (const status of [
      DeliveryStatus.ACCEPTED,
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.ON_THE_WAY,
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignmentId}/status`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ status })
        .expect(200);
    }
  }

  async function subscribeToLocation(
    assignmentId: number,
    customerToken: string,
  ): Promise<Socket> {
    const socket = io(`${baseUrl}/ws/location`, {
      transports: ['websocket'],
      auth: { token: customerToken },
      forceNew: true,
      reconnection: false,
    });
    sockets.push(socket);
    await onceSocketEvent(socket, 'connect');
    const subscribed = onceSocketEvent<{
      assignmentId: string;
    }>(socket, 'subscribed');
    socket.emit('subscribe', String(assignmentId));
    await expect(subscribed).resolves.toEqual({
      assignmentId: String(assignmentId),
    });
    return socket;
  }

  function onceSocketEvent<T = unknown>(
    socket: Socket,
    event: string,
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for ${event}`)),
        3_000,
      );
      socket.once(event, (payload: T) => {
        clearTimeout(timeout);
        resolve(payload);
      });
      socket.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  function sign(user: User) {
    return jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
});

function customerEmail(stop: StopSeed) {
  return `route-${stop.label.toLowerCase()}-${stop.orderRef.split('-').pop()}@example.com`;
}
