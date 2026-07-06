import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

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

describe('Rider dispatch workflow (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let usersRepo: Repository<User>;
  let ordersRepo: Repository<Order>;
  let riderProfilesRepo: Repository<RiderProfile>;
  let assignmentsRepo: Repository<DeliveryAssignment>;
  let notificationsRepo: Repository<Notification>;

  const runId = Date.now().toString().slice(-10);
  const orderRef = `E2E-${runId}`;
  const emails = {
    customer: `e2e-customer-${runId}@example.com`,
    admin: `e2e-admin-${runId}@example.com`,
    rider: `e2e-rider-${runId}@example.com`,
  };

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

    dataSource = app.get(DataSource);
    jwtService = app.get(JwtService);
    usersRepo = dataSource.getRepository(User);
    ordersRepo = dataSource.getRepository(Order);
    riderProfilesRepo = dataSource.getRepository(RiderProfile);
    assignmentsRepo = dataSource.getRepository(DeliveryAssignment);
    notificationsRepo = dataSource.getRepository(Notification);
  });

  afterAll(async () => {
    await notificationsRepo.delete({ orderRef });
    const order = await ordersRepo.findOne({ where: { orderId: orderRef } });
    if (order) {
      await assignmentsRepo.delete({ orderId: order.id });
      await ordersRepo.delete({ id: order.id });
    }
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
      .where('email IN (:...emails)', { emails: Object.values(emails) })
      .execute();

    await app.close();
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
      where: { orderId: order.id },
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
  });
});
