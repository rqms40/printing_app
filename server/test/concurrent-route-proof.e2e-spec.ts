import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, Socket } from 'socket.io-client';
import { DataSource, In, Repository } from 'typeorm';

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
import { Notification } from '../src/notifications/entities/notification.entity';

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
  let notificationsRepo: Repository<Notification>;

  const sockets: Socket[] = [];
  const runId = Date.now().toString().slice(-8);
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
    notificationsRepo = dataSource.getRepository(Notification);
  });

  afterEach(() => {
    for (const socket of sockets.splice(0)) {
      socket.disconnect();
    }
  });

  afterAll(async () => {
    const orderRefs = stops.map((stop) => stop.orderRef);
    const orders = await ordersRepo.find({ where: { orderId: In(orderRefs) } });
    const orderIds = orders.map((order) => order.id);
    await notificationsRepo.delete({ orderRef: In(orderRefs) });
    if (orderIds.length > 0) {
      await assignmentsRepo.delete({ orderId: In(orderIds) });
      await ordersRepo.delete({ id: In(orderIds) });
    }
    await destinationsRepo
      .createQueryBuilder()
      .delete()
      .where('label LIKE :prefix', { prefix: `Route ${runId}%` })
      .execute();
    await batchOrdersRepo
      .createQueryBuilder()
      .delete()
      .where('batch_ref LIKE :prefix', { prefix: `ROUTE-BATCH-${runId}%` })
      .execute();
    await addressesRepo
      .createQueryBuilder()
      .delete()
      .where('label LIKE :prefix', { prefix: `Route ${runId}%` })
      .execute();
    await riderProfilesRepo
      .createQueryBuilder()
      .delete()
      .where('user_id IN (SELECT id FROM users WHERE email IN (:...emails))', {
        emails: Object.values(emails),
      })
      .execute();
    await usersRepo
      .createQueryBuilder()
      .delete()
      .where('email IN (:...emails)', {
        emails: [...Object.values(emails), ...stops.map(customerEmail)],
      })
      .execute();

    await app.close();
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

    const locationUpdate = onceLocationUpdate(nearAssignment.id);
    await request(app.getHttpServer())
      .patch('/api/riders/location')
      .set('Authorization', `Bearer ${riderToken}`)
      .send({ latitude: 7.0648, longitude: 125.6087 })
      .expect(200);
    await expect(locationUpdate).resolves.toMatchObject({
      latitude: 7.0648,
      longitude: 125.6087,
    });

    await advanceToArrived(nearAssignment.id, riderToken);
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
          fileId: 901,
          objectKey: `proof/route-photo-${runId}.jpg`,
        },
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe(DeliveryStatus.DELIVERED);
        expect(res.body.proofType).toBe(ProofOfDeliveryType.PHOTO);
        expect(res.body.proofFileId).toBe(901);
        expect(res.body.proofObjectKey).toBe(`proof/route-photo-${runId}.jpg`);
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
    for (const status of [
      DeliveryStatus.ACCEPTED,
      DeliveryStatus.PICKED_UP,
      DeliveryStatus.ON_THE_WAY,
      DeliveryStatus.ARRIVED,
    ]) {
      await request(app.getHttpServer())
        .patch(`/api/riders/assignments/${assignmentId}/status`)
        .set('Authorization', `Bearer ${riderToken}`)
        .send({ status })
        .expect(200);
    }
  }

  function onceLocationUpdate(assignmentId: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const socket = io(`${baseUrl}/ws/location`, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      });
      sockets.push(socket);
      const timeout = setTimeout(() => {
        reject(new Error('Timed out waiting for locationUpdate'));
      }, 3000);
      socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      socket.on('connect', () => {
        socket.emit('subscribe', String(assignmentId));
      });
      socket.on('locationUpdate', (payload) => {
        clearTimeout(timeout);
        resolve(payload);
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
