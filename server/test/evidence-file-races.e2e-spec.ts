import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Client } from 'pg';
import request, { Response } from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';

import { AppModule } from '../src/app.module';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { FileMetadata } from '../src/files/entities/file-metadata.entity';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import {
  DeliveryAssignment,
  DeliveryStatus,
  ProofOfDeliveryType,
} from '../src/riders/entities/delivery-assignment.entity';
import { RiderProfile } from '../src/riders/entities/rider-profile.entity';
import { StorageService } from '../src/storage/storage.service';
import { User, UserRole } from '../src/users/entities/user.entity';

describe('Evidence file deletion races (e2e)', () => {
  jest.setTimeout(120_000);

  let app: INestApplication<App>;
  let dataSource: DataSource;
  let jwtService: JwtService;
  let storageService: StorageService;
  let usersRepo: Repository<User>;
  let ordersRepo: Repository<Order>;
  let profilesRepo: Repository<RiderProfile>;
  let assignmentsRepo: Repository<DeliveryAssignment>;
  let filesRepo: Repository<FileMetadata>;
  let customer: User;
  let rider: User;
  let riderProfile: RiderProfile;

  const runId = `${process.pid}_${Date.now().toString().slice(-8)}`;
  const isolatedDatabase = `gridgo_evidence_race_${runId}`;
  const originalDatabaseName = process.env.DATABASE_NAME;
  const originalJwtSecret = process.env.JWT_SECRET;
  const adminConfig = {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: Number(process.env.DATABASE_PORT ?? 5432),
    database: originalDatabaseName ?? 'grid_print',
    user: process.env.DATABASE_USER ?? 'postgres',
    password: process.env.DATABASE_PASSWORD ?? 'postgres',
  };
  const storageObjectKeys = new Set<string>();

  beforeAll(async () => {
    if (!/^[a-z0-9_]+$/.test(isolatedDatabase)) {
      throw new Error('Unsafe isolated database identifier');
    }
    const admin = new Client(adminConfig);
    await admin.connect();
    await admin.query(`CREATE DATABASE "${isolatedDatabase}"`);
    await admin.end();

    process.env.DATABASE_NAME = isolatedDatabase;
    process.env.JWT_SECRET = originalJwtSecret ?? `evidence-race-${runId}`;
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
    storageService = app.get(StorageService);
    usersRepo = dataSource.getRepository(User);
    ordersRepo = dataSource.getRepository(Order);
    profilesRepo = dataSource.getRepository(RiderProfile);
    assignmentsRepo = dataSource.getRepository(DeliveryAssignment);
    filesRepo = dataSource.getRepository(FileMetadata);

    customer = await usersRepo.save(
      usersRepo.create({
        email: `evidence-customer-${runId}@example.test`,
        passwordHash: 'not-used',
        fullName: 'Evidence Customer',
        role: UserRole.CUSTOMER,
        isActive: true,
      }),
    );
    rider = await usersRepo.save(
      usersRepo.create({
        email: `evidence-rider-${runId}@example.test`,
        passwordHash: 'not-used',
        fullName: 'Evidence Rider',
        role: UserRole.RIDER,
        isActive: true,
      }),
    );
    riderProfile = await profilesRepo.save(
      profilesRepo.create({
        userId: rider.id,
        vehicleType: 'motorcycle',
        plateNumber: 'RACE-1',
        isAvailable: true,
      }),
    );
  });

  afterAll(async () => {
    for (const key of storageObjectKeys) {
      await storageService.delete(key).catch(() => undefined);
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

  it('delete-first removes photo proof before delivery completion can reference it', async () => {
    const assignment = await createArrivedAssignment('proof_delete_first');
    const proof = await uploadEvidence(rider, 'proof_of_delivery');
    await installDelayTrigger(
      'file_metadata',
      'DELETE',
      proof.id,
      'proof_delete_first',
    );

    const deletion = deleteFile(proof.id, rider);
    await waitForActiveQuery('DELETE%file_metadata');
    const completion = completeWithPhoto(assignment.id, proof.id);
    const [deleteResponse, completionResponse] = await Promise.all([
      deletion,
      completion,
    ]);

    expect(deleteResponse.status).toBe(204);
    expect(completionResponse.status).toBe(400);
    await expect(filesRepo.findOneBy({ id: proof.id })).resolves.toBeNull();
    await expect(storageService.objectExists(proof.objectKey)).resolves.toBe(
      false,
    );
    await expect(
      assignmentsRepo.findOneByOrFail({ id: assignment.id }),
    ).resolves.toMatchObject({
      status: DeliveryStatus.ARRIVED,
      proofFileId: null,
    });
  });

  it('completion-first commits proof evidence and makes concurrent deletion conflict', async () => {
    const assignment = await createArrivedAssignment('proof_commit_first');
    const proof = await uploadEvidence(rider, 'proof_of_delivery');
    await installDelayTrigger(
      'delivery_assignments',
      'UPDATE',
      assignment.id,
      'proof_commit_first',
    );

    const completion = completeWithPhoto(assignment.id, proof.id);
    await waitForActiveQuery('UPDATE%delivery_assignments');
    const deletion = deleteFile(proof.id, rider);
    const [completionResponse, deleteResponse] = await Promise.all([
      completion,
      deletion,
    ]);

    expect(completionResponse.status).toBe(200);
    expect(deleteResponse.status).toBe(409);
    await expect(filesRepo.findOneBy({ id: proof.id })).resolves.not.toBeNull();
    await expect(storageService.objectExists(proof.objectKey)).resolves.toBe(
      true,
    );
    await expect(
      assignmentsRepo.findOneByOrFail({ id: assignment.id }),
    ).resolves.toMatchObject({
      status: DeliveryStatus.DELIVERED,
      proofFileId: proof.id,
      proofObjectKey: proof.objectKey,
    });
  });

  it('delete-first removes testimonial evidence before submission can reference it', async () => {
    const testimonial = await uploadEvidence(customer, 'beta_testimonial');
    await installDelayTrigger(
      'file_metadata',
      'DELETE',
      testimonial.id,
      'testimonial_delete_first',
    );

    const deletion = deleteFile(testimonial.id, customer);
    await waitForActiveQuery('DELETE%file_metadata');
    const submission = submitTestimonial(testimonial.id);
    const [deleteResponse, submitResponse] = await Promise.all([
      deletion,
      submission,
    ]);

    expect(deleteResponse.status).toBe(204);
    expect(submitResponse.status).toBe(404);
    await expect(
      filesRepo.findOneBy({ id: testimonial.id }),
    ).resolves.toBeNull();
    await expect(
      storageService.objectExists(testimonial.objectKey),
    ).resolves.toBe(false);
    await expect(
      usersRepo.findOneByOrFail({ id: customer.id }),
    ).resolves.toMatchObject({ betaPhotoFileId: null });
  });

  it('submission-first commits testimonial evidence and makes concurrent deletion conflict', async () => {
    const testimonial = await uploadEvidence(customer, 'beta_testimonial');
    await installDelayTrigger(
      'users',
      'UPDATE',
      customer.id,
      'testimonial_commit_first',
    );

    const submission = submitTestimonial(testimonial.id);
    await waitForActiveQuery('UPDATE%users');
    const deletion = deleteFile(testimonial.id, customer);
    const [submitResponse, deleteResponse] = await Promise.all([
      submission,
      deletion,
    ]);

    expect(submitResponse.status).toBe(201);
    expect(deleteResponse.status).toBe(409);
    await expect(
      filesRepo.findOneBy({ id: testimonial.id }),
    ).resolves.not.toBeNull();
    await expect(
      storageService.objectExists(testimonial.objectKey),
    ).resolves.toBe(true);
    await expect(
      usersRepo.findOneByOrFail({ id: customer.id }),
    ).resolves.toMatchObject({ betaPhotoFileId: testimonial.id });
  });

  it('keeps metadata audit and storage evidence when deletion rolls back', async () => {
    const proof = await uploadEvidence(rider, 'proof_of_delivery');
    const functionName = `reject_delete_${runId}`;
    const triggerName = `trigger_reject_delete_${runId}`;
    await dataSource.query(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'forced metadata delete rollback';
      END
      $$;
      CREATE TRIGGER "${triggerName}"
      BEFORE DELETE ON "file_metadata"
      FOR EACH ROW WHEN (OLD.id = ${proof.id})
      EXECUTE FUNCTION "${functionName}"()
    `);

    const response = await deleteFile(proof.id, rider);

    expect(response.status).toBe(500);
    await expect(
      filesRepo.findOneByOrFail({ id: proof.id }),
    ).resolves.toMatchObject({
      uploadedBy: rider.id,
      objectKey: proof.objectKey,
      purpose: 'proof_of_delivery',
    });
    await expect(storageService.objectExists(proof.objectKey)).resolves.toBe(
      true,
    );
  });

  async function createArrivedAssignment(label: string) {
    const order = await ordersRepo.save(
      ordersRepo.create({
        orderId: `RACE-${label}-${runId}`,
        userId: customer.id,
        category: 'paper',
        quantity: 1,
        totalPrice: 10,
        deliveryFee: 0,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        deliveryOption: 'delivery',
        orderStatus: OrderStatus.ARRIVED_AT_DESTINATION,
        assignedRiderId: rider.id,
      }),
    );
    return assignmentsRepo.save(
      assignmentsRepo.create({
        orderId: order.id,
        riderId: riderProfile.id,
        isCurrent: true,
        status: DeliveryStatus.ARRIVED,
        acceptedAt: new Date(),
        pickedUpAt: new Date(),
        onTheWayAt: new Date(),
        arrivedAt: new Date(),
      }),
    );
  }

  async function uploadEvidence(
    owner: User,
    purpose: 'proof_of_delivery' | 'beta_testimonial',
  ): Promise<{ id: number; objectKey: string }> {
    const response = await request(app.getHttpServer())
      .post('/api/files/upload')
      .set('Authorization', `Bearer ${sign(owner)}`)
      .field('purpose', purpose)
      .attach('file', Buffer.from(`real-${purpose}-${runId}`), {
        filename: `${purpose}-${Date.now()}.png`,
        contentType: 'image/png',
      })
      .expect(201);
    const file = response.body as { id: number; objectKey: string };
    storageObjectKeys.add(file.objectKey);
    return file;
  }

  function deleteFile(fileId: number, owner: User): Promise<Response> {
    return request(app.getHttpServer())
      .delete(`/api/files/${fileId}`)
      .set('Authorization', `Bearer ${sign(owner)}`)
      .then((response) => response);
  }

  function completeWithPhoto(
    assignmentId: number,
    fileId: number,
  ): Promise<Response> {
    return request(app.getHttpServer())
      .patch(`/api/riders/assignments/${assignmentId}/status`)
      .set('Authorization', `Bearer ${sign(rider)}`)
      .send({
        status: DeliveryStatus.DELIVERED,
        proof: { type: ProofOfDeliveryType.PHOTO, fileId },
      })
      .then((response) => response);
  }

  function submitTestimonial(fileId: number): Promise<Response> {
    return request(app.getHttpServer())
      .post('/api/beta-mode/testimonial')
      .set('Authorization', `Bearer ${sign(customer)}`)
      .send({ fileId, sharedOnSocial: true })
      .then((response) => response);
  }

  async function installDelayTrigger(
    table: 'file_metadata' | 'delivery_assignments' | 'users',
    event: 'DELETE' | 'UPDATE',
    rowId: number,
    label: string,
  ): Promise<void> {
    if (!Number.isInteger(rowId) || !/^[a-z_]+$/.test(label)) {
      throw new Error('Unsafe race trigger input');
    }
    const functionName = `delay_${label}_${runId}`;
    const triggerName = `trigger_${label}_${runId}`;
    await dataSource.query(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM pg_sleep(1);
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END
      $$;
      CREATE TRIGGER "${triggerName}"
      BEFORE ${event} ON "${table}"
      FOR EACH ROW WHEN (OLD.id = ${rowId})
      EXECUTE FUNCTION "${functionName}"()
    `);
  }

  async function waitForActiveQuery(pattern: string): Promise<void> {
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) {
      const rows = await dataSource.query<Array<{ found: boolean }>>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_stat_activity
           WHERE datname = current_database()
             AND pid <> pg_backend_pid()
             AND state = 'active'
             AND query ILIKE $1
         ) AS found`,
        [`%${pattern}%`],
      );
      if (rows[0]?.found) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for active query: ${pattern}`);
  }

  function sign(user: User): string {
    return jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }
});
