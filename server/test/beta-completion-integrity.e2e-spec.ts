import { ConflictException } from '@nestjs/common';
import { Client } from 'pg';
import {
  DataSource,
  type DataSourceOptions,
  EntityManager,
  Repository,
} from 'typeorm';
import { databaseOptionsFromEnv } from '../src/database/data-source';
import { BetaModeSettings } from '../src/beta-mode/entities/beta-mode-settings.entity';
import { BetaModeService } from '../src/beta-mode/beta-mode.service';
import { CreditsService } from '../src/credits/credits.service';
import {
  FileMetadata,
  FilePurpose,
} from '../src/files/entities/file-metadata.entity';
import { FilesService } from '../src/files/files.service';
import { Order, OrderStatus } from '../src/orders/entities/order.entity';
import { TamSurveyRequirement } from '../src/tam-surveys/entities/tam-survey-requirement.entity';
import { TamSurvey } from '../src/tam-surveys/entities/tam-survey.entity';
import { TamSurveysService } from '../src/tam-surveys/tam-surveys.service';
import { User, UserRole } from '../src/users/entities/user.entity';
import { RealtimeSessionRegistry } from '../src/common/realtime/realtime-session-registry';

describe('beta completion integrity (e2e)', () => {
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

  it('rolls back both beta disable and account reopening on failure', async () => {
    const database = await createDatabase('disable_rollback');
    const dataSource = await initializeDatabase(database);
    try {
      const settingsRepo = dataSource.getRepository(BetaModeSettings);
      const usersRepo = dataSource.getRepository(User);
      await settingsRepo.save(settingsRepo.create({ isEnabled: true }));
      const filesRepo = dataSource.getRepository(FileMetadata);
      const evidence = await filesRepo.save(
        makeTestimonialFile(filesRepo, null, `${database}-retained`),
      );
      const user = await usersRepo.save(
        usersRepo.create({
          email: `${database}@example.test`,
          passwordHash: 'not-used',
          role: UserRole.CLIENT,
          isActive: false,
          isBetaUser: true,
          accountHoldReason: 'beta_survey_complete',
          accountHeldAt: new Date(),
          betaCompletedAt: new Date(),
          betaPhotoFileId: evidence.id,
          betaSharedOnSocial: true,
        }),
      );
      await filesRepo.update(evidence.id, { uploadedBy: user.id });
      await dataSource.query(`
        CREATE FUNCTION reject_beta_reopen() RETURNS trigger AS $$
        BEGIN
          RAISE EXCEPTION 'forced beta reopen failure';
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_beta_reopen_update
        BEFORE UPDATE ON users
        FOR EACH ROW WHEN (
          OLD.id = ${user.id}
          AND OLD.account_hold_reason = 'beta_survey_complete'
        ) EXECUTE FUNCTION reject_beta_reopen()
      `);

      await expect(
        makeBetaService(dataSource).updateSettings(false),
      ).rejects.toThrow('forced beta reopen failure');

      await expect(settingsRepo.find()).resolves.toEqual([
        expect.objectContaining({ isEnabled: true }),
      ]);
      await expect(
        usersRepo.findOneByOrFail({ id: user.id }),
      ).resolves.toMatchObject({
        isActive: false,
        accountHoldReason: 'beta_survey_complete',
        betaCompletedAt: user.betaCompletedAt,
        betaPhotoFileId: evidence.id,
        betaSharedOnSocial: true,
      });
    } finally {
      await dataSource.destroy();
    }
  });

  it('serializes requirement creation behind a concurrent beta disable', async () => {
    const database = await createDatabase('disable_requirement_race');
    const dataSource = await initializeDatabase(database);
    try {
      const settingsRepo = dataSource.getRepository(BetaModeSettings);
      const usersRepo = dataSource.getRepository(User);
      const ordersRepo = dataSource.getRepository(Order);
      await settingsRepo.save(settingsRepo.create({ isEnabled: true }));
      const user = await usersRepo.save(
        usersRepo.create({
          email: `${database}@example.test`,
          passwordHash: 'not-used',
          role: UserRole.CLIENT,
          isActive: true,
          isBetaUser: true,
          betaEnrolledAt: new Date(),
        }),
      );
      const order = await ordersRepo.save(
        makeOrder(ordersRepo, user.id, `${database}-order`),
      );
      await dataSource.query(`
        CREATE FUNCTION delay_beta_disable() RETURNS trigger AS $$
        BEGIN
          PERFORM pg_sleep(1);
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER delay_beta_disable_update
        BEFORE UPDATE ON beta_mode_settings
        FOR EACH ROW WHEN (NEW.is_enabled = false)
        EXECUTE FUNCTION delay_beta_disable()
      `);

      const disable = makeBetaService(dataSource).updateSettings(false);
      await waitForActiveQuery(
        database,
        '%UPDATE "beta_mode_settings" SET "is_enabled"%',
      );
      const requirement =
        await makeSurveyService(
          dataSource,
        ).createPostDeliveryRequirementIfNeeded(order);
      await disable;

      expect(requirement).toBeNull();
      await expect(
        dataSource.getRepository(TamSurveyRequirement).countBy({
          userId: user.id,
        }),
      ).resolves.toBe(0);
      await expect(settingsRepo.find()).resolves.toEqual([
        expect.objectContaining({ isEnabled: false }),
      ]);
    } finally {
      await dataSource.destroy();
    }
  });

  it('keeps per-order requirements, sequences the final hold, and preserves one testimonial', async () => {
    const database = await createDatabase('races');
    const dataSource = await initializeDatabase(database);
    try {
      const usersRepo = dataSource.getRepository(User);
      const ordersRepo = dataSource.getRepository(Order);
      const filesRepo = dataSource.getRepository(FileMetadata);
      const user = await usersRepo.save(
        usersRepo.create({
          email: `${database}@example.test`,
          passwordHash: 'not-used',
          role: UserRole.CLIENT,
          isActive: true,
          isBetaUser: true,
          betaEnrolledAt: new Date(),
        }),
      );
      const settingsRepo = dataSource.getRepository(BetaModeSettings);
      await settingsRepo.save(settingsRepo.create({ isEnabled: true }));
      const orders = await ordersRepo.save([
        makeOrder(ordersRepo, user.id, `${database}-1`),
        makeOrder(ordersRepo, user.id, `${database}-2`),
      ]);
      const surveys = makeSurveyService(dataSource);

      const requirements = await Promise.all(
        orders.map((order) =>
          surveys.createPostDeliveryRequirementIfNeeded(order),
        ),
      );
      expect(requirements[0]?.id).not.toBe(requirements[1]?.id);
      await expect(
        dataSource.getRepository(TamSurveyRequirement).countBy({
          userId: user.id,
        }),
      ).resolves.toBe(2);

      const answers = Object.fromEntries(
        Array.from({ length: 14 }, (_, index) => [String(index), index % 5]),
      );
      const first = await surveys.submitRequirement(
        user.id,
        requirements[0]!.id,
        { surveyData: answers, openForumFeedback: {} },
      );
      expect(first.logoutRequired).toBe(false);
      await expect(surveys.getAccountState(user.id)).resolves.toMatchObject({
        accountStatus: 'survey_required',
        holds: [
          {
            requirementId: requirements[1]!.id,
            orderId: orders[1].id,
          },
        ],
      });
      const retry = await surveys.submitRequirement(
        user.id,
        requirements[0]!.id,
        { surveyData: answers, openForumFeedback: {} },
      );
      expect(retry).toEqual(first);
      const final = await surveys.submitRequirement(
        user.id,
        requirements[1]!.id,
        { surveyData: answers, openForumFeedback: {} },
      );
      expect(final.logoutRequired).toBe(true);
      await expect(
        dataSource.getRepository(TamSurvey).countBy({ userId: user.id }),
      ).resolves.toBe(2);

      const files = await filesRepo.save([
        makeTestimonialFile(filesRepo, user.id, `${database}-a`),
        makeTestimonialFile(filesRepo, user.id, `${database}-b`),
      ]);
      const beta = makeBetaService(dataSource);
      const attempts = await Promise.allSettled(
        files.map((file) =>
          beta.submitTestimonial(user.id, { fileId: file.id }),
        ),
      );
      expect(
        attempts.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      const rejected = attempts.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      expect(rejected?.reason).toBeInstanceOf(ConflictException);
      const winner = await usersRepo.findOneByOrFail({ id: user.id });
      expect(files.map((file) => file.id)).toContain(winner.betaPhotoFileId);

      await Promise.all([beta.markShared(user.id), beta.markShared(user.id)]);
      await expect(
        usersRepo.findOneByOrFail({ id: user.id }),
      ).resolves.toMatchObject({ betaSharedOnSocial: true });
    } finally {
      await dataSource.destroy();
    }
  });

  function makeBetaService(dataSource: DataSource): BetaModeService {
    const filesService = {
      resolveBetaTestimonialFile: async (
        fileId: number,
        userId: number,
        manager: EntityManager,
      ) => {
        const file = await manager.getRepository(FileMetadata).findOne({
          where: { id: fileId },
          lock: { mode: 'pessimistic_write' },
        });
        if (!file || file.uploadedBy !== userId) {
          throw new Error('invalid testimonial fixture');
        }
        return file;
      },
    } as unknown as FilesService;
    return new BetaModeService(
      dataSource.getRepository(BetaModeSettings),
      dataSource.getRepository(User),
      {} as CreditsService,
      dataSource,
      filesService,
    );
  }

  function makeSurveyService(dataSource: DataSource): TamSurveysService {
    return new TamSurveysService(
      dataSource.getRepository(TamSurvey),
      dataSource.getRepository(TamSurveyRequirement),
      dataSource.getRepository(User),
      dataSource.getRepository(BetaModeSettings),
      dataSource,
      new RealtimeSessionRegistry(),
    );
  }

  function makeOrder(
    repo: Repository<Order>,
    userId: number,
    ref: string,
  ): Order {
    return repo.create({
      orderId: ref,
      userId,
      category: 'paper',
      quantity: 1,
      totalPrice: 10,
      deliveryFee: 0,
      paymentMethod: 'gridCredits',
      paymentStatus: 'paid',
      deliveryOption: 'delivery',
      orderStatus: OrderStatus.DELIVERED,
    });
  }

  function makeTestimonialFile(
    repo: Repository<FileMetadata>,
    userId: number | null,
    suffix: string,
  ): FileMetadata {
    return repo.create({
      originalName: `${suffix}.png`,
      mimeType: 'image/png',
      size: 10,
      url: `https://files/${suffix}`,
      objectKey: `uploads/beta_testimonial/${suffix}.png`,
      uploadedBy: userId ?? undefined,
      purpose: FilePurpose.BETA_TESTIMONIAL,
    });
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
    const database = `gridgo_beta_completion_${label}_${process.pid}_${createdDatabases.size}`;
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

  async function waitForActiveQuery(
    database: string,
    pattern: string,
  ): Promise<void> {
    const deadline = Date.now() + 4_000;
    while (Date.now() < deadline) {
      const rows = await admin.query<{ found: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM pg_stat_activity
           WHERE datname = $1
             AND pid <> pg_backend_pid()
             AND state = 'active'
             AND query ILIKE $2
         ) AS found`,
        [database, pattern],
      );
      if (rows.rows[0]?.found) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for active query: ${pattern}`);
  }
});
