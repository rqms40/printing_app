/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, getMetadataArgsStorage, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { TamSurveysService } from './tam-surveys.service';
import { TamSurvey } from './entities/tam-survey.entity';
import { BetaModeSettings } from '../beta-mode/entities/beta-mode-settings.entity';
import {
  TamSurveyRequirement,
  TamSurveyRequirementReason,
  TamSurveyRequirementStatus,
} from './entities/tam-survey-requirement.entity';
import { TamSurveysModule } from './tam-surveys.module';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';

const fullSurveyData = Object.fromEntries(
  Array.from({ length: 14 }, (_, index) => [String(index), index % 5]),
);

describe('TAM survey post-delivery metadata', () => {
  it('TamSurveyRequirement declares required columns', () => {
    const cols = getMetadataArgsStorage()
      .filterColumns(TamSurveyRequirement)
      .map((c) => c.propertyName);

    expect(cols).toEqual(
      expect.arrayContaining([
        'id',
        'userId',
        'orderId',
        'reason',
        'status',
        'surveyId',
        'requiredAt',
        'submittedAt',
        'createdAt',
        'updatedAt',
      ]),
    );
  });

  it('TamSurvey links optionally to order and requirement', () => {
    const cols = getMetadataArgsStorage()
      .filterColumns(TamSurvey)
      .map((c) => c.propertyName);

    expect(cols).toEqual(expect.arrayContaining(['orderId', 'requirementId']));
  });

  it('User has beta completion hold metadata', () => {
    const cols = getMetadataArgsStorage()
      .filterColumns(User)
      .map((c) => c.propertyName);

    expect(cols).toEqual(
      expect.arrayContaining([
        'accountHoldReason',
        'accountHeldAt',
        'betaCompletedAt',
      ]),
    );
  });

  it('uses stable enum values for requirement status and reason', () => {
    expect(TamSurveyRequirementReason.POST_DELIVERY).toBe('post_delivery');
    expect(TamSurveyRequirementStatus.PENDING).toBe('pending');
    expect(TamSurveyRequirementStatus.SUBMITTED).toBe('submitted');
  });

  it('does not collapse pending requirements across a customer orders', () => {
    const index = getMetadataArgsStorage().indices.find(
      (candidate) =>
        candidate.target === TamSurveyRequirement &&
        candidate.name === 'uq_tam_survey_requirements_user_pending',
    );
    expect(index).toBeUndefined();
  });

  it('registers TamSurveyRequirement in the survey TypeOrm feature module', () => {
    const imports = Reflect.getMetadata(
      MODULE_METADATA.IMPORTS,
      TamSurveysModule,
    );
    const typeOrmFeature = imports.find(
      (entry: { module?: unknown }) => entry.module === TypeOrmModule,
    );
    const providers = typeOrmFeature.providers.map(
      (provider: { provide: unknown }) => provider.provide,
    );

    expect(providers).toContain(getRepositoryToken(TamSurveyRequirement));
  });
});

describe('TamSurveysService', () => {
  let service: TamSurveysService;
  let surveyRepo: jest.Mocked<Partial<Repository<TamSurvey>>>;
  let requirementRepo: jest.Mocked<Partial<Repository<TamSurveyRequirement>>>;
  let betaModeSettingsRepo: jest.Mocked<Partial<Repository<BetaModeSettings>>>;
  let userRepo: any;
  let transactionalManager: any;
  let dataSource: any;
  let realtimeSessions: { disconnectUser: jest.Mock };

  const betaUser = {
    id: 10,
    email: 'beta@test.com',
    isBetaUser: true,
    isActive: true,
    role: 'client',
    isBetaSurveyExempt: false,
  };

  const order = {
    id: 55,
    orderId: 'ORD-10055',
    userId: 10,
    orderStatus: OrderStatus.DELIVERED,
  } as Order;

  beforeEach(async () => {
    surveyRepo = {
      create: jest.fn((data) => data as TamSurvey),
      save: jest.fn(async (survey) => ({ id: 900, ...survey }) as TamSurvey),
    };
    requirementRepo = {
      findOne: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((data) => data as TamSurveyRequirement),
      save: jest.fn(
        async (req) => ({ id: 123, ...req }) as TamSurveyRequirement,
      ),
    };
    betaModeSettingsRepo = {
      find: jest.fn().mockResolvedValue([{ id: 1, isEnabled: true }]),
      findOne: jest.fn().mockResolvedValue({ id: 1, isEnabled: true }),
    };
    userRepo = {
      findOne: jest.fn().mockResolvedValue(betaUser),
      update: jest.fn().mockResolvedValue(undefined),
    };
    transactionalManager = {
      getRepository: jest.fn((entity) => {
        if (entity === TamSurvey) return surveyRepo;
        if (entity === TamSurveyRequirement) return requirementRepo;
        if (entity === User) return userRepo;
        if (entity === BetaModeSettings) return betaModeSettingsRepo;
        throw new Error(`Unexpected repository: ${entity.name}`);
      }),
    };
    dataSource = {
      transaction: jest.fn((callback) => callback(transactionalManager)),
    };
    realtimeSessions = { disconnectUser: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TamSurveysService,
        { provide: getRepositoryToken(TamSurvey), useValue: surveyRepo },
        {
          provide: getRepositoryToken(TamSurveyRequirement),
          useValue: requirementRepo,
        },
        {
          provide: getRepositoryToken(BetaModeSettings),
          useValue: betaModeSettingsRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: DataSource, useValue: dataSource },
        { provide: RealtimeSessionRegistry, useValue: realtimeSessions },
      ],
    }).compile();

    service = module.get(TamSurveysService);
  });

  it('creates a pending requirement for a beta user order', async () => {
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(null);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(requirementRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        orderId: 55,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
        status: TamSurveyRequirementStatus.PENDING,
        surveyId: null,
        submittedAt: null,
        requiredAt: expect.any(Date),
      }),
    );
    expect(result?.id).toBe(123);
  });

  it('creates the post-delivery requirement through a supplied manager', async () => {
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(null);

    const result = await (service.createPostDeliveryRequirementIfNeeded as any)(
      order,
      transactionalManager,
    );

    expect(transactionalManager.getRepository).toHaveBeenCalledWith(
      BetaModeSettings,
    );
    expect(transactionalManager.getRepository).toHaveBeenCalledWith(User);
    expect(transactionalManager.getRepository).toHaveBeenCalledWith(
      TamSurveyRequirement,
    );
    expect(result?.id).toBe(123);
  });

  it('locks beta settings before creating a post-delivery requirement', async () => {
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(null);

    await (service.createPostDeliveryRequirementIfNeeded as any)(
      order,
      transactionalManager,
    );

    expect(betaModeSettingsRepo.findOne).toHaveBeenCalledWith({
      where: {},
      order: { id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    expect(
      betaModeSettingsRepo.findOne!.mock.invocationCallOrder[0],
    ).toBeLessThan(userRepo.findOne.mock.invocationCallOrder[0]);
  });

  it('does not create a requirement for a non-beta user', async () => {
    userRepo.findOne.mockResolvedValue({ ...betaUser, isBetaUser: false });

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBeNull();
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('does not create a requirement for a beta-exempt customer', async () => {
    userRepo.findOne.mockResolvedValue({
      ...betaUser,
      isBetaSurveyExempt: true,
    });

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBeNull();
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('does not create a requirement for a non-customer beta identity', async () => {
    userRepo.findOne.mockResolvedValue({ ...betaUser, role: 'rider' });

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBeNull();
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('does not create a requirement when beta mode is disabled', async () => {
    betaModeSettingsRepo.findOne.mockResolvedValue({
      id: 1,
      isEnabled: false,
    } as BetaModeSettings);
    userRepo.findOne.mockResolvedValue(betaUser);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBeNull();
    expect(requirementRepo.findOne).not.toHaveBeenCalled();
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('returns the existing requirement instead of duplicating', async () => {
    const existing = {
      id: 77,
      userId: 10,
      orderId: 55,
    } as TamSurveyRequirement;
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(existing);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBe(existing);
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('creates a distinct pending requirement for a different delivered order', async () => {
    const existing = {
      id: 77,
      userId: 10,
      orderId: 44,
      reason: TamSurveyRequirementReason.POST_DELIVERY,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement;
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValueOnce(null);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(requirementRepo.findOne).toHaveBeenCalledWith({
      where: {
        orderId: 55,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
      },
    });
    expect(result).not.toBe(existing);
    expect(requirementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: 55 }),
    );
  });

  it('returns the existing requirement when a concurrent create hits the unique constraint', async () => {
    const existing = {
      id: 77,
      userId: 10,
      orderId: 55,
    } as TamSurveyRequirement;
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    requirementRepo.save.mockRejectedValueOnce({
      code: '23505',
      constraint: 'uq_tam_survey_requirements_order_reason',
    });

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBe(existing);
    expect(requirementRepo.findOne).toHaveBeenLastCalledWith({
      where: {
        orderId: 55,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
      },
    });
  });

  it('keeps the account active when another pending requirement remains', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);
    requirementRepo.count.mockResolvedValueOnce(1);
    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: {},
      }),
    ).resolves.toEqual({
      success: true,
      surveyId: 900,
      logoutRequired: false,
    });

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(realtimeSessions.disconnectUser).not.toHaveBeenCalled();
  });

  it('does not treat an unrelated unique violation as a requirement race', async () => {
    const unrelated = {
      code: '23505',
      constraint: 'users_email_key',
    };
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(null);
    requirementRepo.save.mockRejectedValueOnce(unrelated);

    await expect(
      service.createPostDeliveryRequirementIfNeeded(order),
    ).rejects.toBe(unrelated);

    expect(requirementRepo.findOne).toHaveBeenCalledTimes(1);
  });

  it('returns survey_required account state when a pending hold exists', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      requiredAt: new Date('2026-04-30T12:00:00Z'),
      order,
    } as TamSurveyRequirement);

    const result = await service.getAccountState(10);

    expect(result).toEqual({
      accountStatus: 'survey_required',
      holds: [
        {
          type: 'post_delivery_survey',
          requirementId: 123,
          orderId: 55,
          orderRef: 'ORD-10055',
          requiredAt: new Date('2026-04-30T12:00:00Z'),
        },
      ],
    });
  });

  it('returns active account state while beta mode is disabled', async () => {
    betaModeSettingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: false }]);

    const result = await service.getAccountState(10);

    expect(result).toEqual({ accountStatus: 'active', holds: [] });
    expect(requirementRepo.findOne).not.toHaveBeenCalled();
  });

  it.each([
    { role: 'rider', isBetaUser: true },
    { role: 'ops_admin', isBetaUser: true },
    { role: 'client', isBetaUser: false },
  ])(
    'ignores stale pending holds for $role beta=$isBetaUser',
    async (identity) => {
      userRepo.findOne.mockResolvedValue({
        ...betaUser,
        ...identity,
      });
      requirementRepo.findOne.mockResolvedValue({
        id: 123,
        userId: 10,
        orderId: 55,
        requiredAt: new Date('2026-04-30T12:00:00Z'),
        order,
      } as TamSurveyRequirement);

      await expect(service.getAccountState(10)).resolves.toEqual({
        accountStatus: 'active',
        holds: [],
      });

      expect(requirementRepo.findOne).not.toHaveBeenCalled();
    },
  );

  it('submits a requirement and holds the beta account', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    const result = await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: {
        feature: 'More slots',
        delivery: 'Good',
        price_value: 'Yes, I would pay the quoted price',
        upload_friction: 'The preview wait was the hardest part',
      },
    });

    expect(surveyRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 10,
        orderId: 55,
        requirementId: 123,
        surveyData: fullSurveyData,
        openForumFeedback: JSON.stringify({
          feature: 'More slots',
          delivery: 'Good',
          price_value: 'Yes, I would pay the quoted price',
          upload_friction: 'The preview wait was the hardest part',
        }),
      }),
    );
    expect(requirementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: TamSurveyRequirementStatus.SUBMITTED,
        surveyId: 900,
        submittedAt: expect.any(Date),
      }),
    );
    expect(userRepo.update).toHaveBeenCalledWith(10, {
      isActive: false,
      accountHoldReason: 'beta_survey_complete',
      accountHeldAt: expect.any(Date),
      betaCompletedAt: expect.any(Date),
    });
    expect(result).toEqual({
      success: true,
      surveyId: 900,
      logoutRequired: true,
    });
    expect(realtimeSessions.disconnectUser).toHaveBeenCalledWith(10);
  });

  it('revokes sockets only after the survey transaction commits', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);
    let committed = false;
    dataSource.transaction.mockImplementationOnce(async (callback) => {
      const result = await callback(transactionalManager);
      committed = true;
      return result;
    });
    realtimeSessions.disconnectUser.mockImplementation(() => {
      expect(committed).toBe(true);
    });

    await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: {},
    });

    expect(realtimeSessions.disconnectUser).toHaveBeenCalledWith(10);
  });

  it('does not revoke sockets when survey submission rolls back', async () => {
    dataSource.transaction.mockRejectedValueOnce(new Error('forced rollback'));

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: {},
      }),
    ).rejects.toThrow('forced rollback');

    expect(realtimeSessions.disconnectUser).not.toHaveBeenCalled();
  });

  it('returns committed survey success when socket revocation fails', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);
    realtimeSessions.disconnectUser.mockImplementation(() => {
      throw new Error('socket registry unavailable');
    });

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: {},
      }),
    ).resolves.toEqual({
      success: true,
      surveyId: 900,
      logoutRequired: true,
    });
  });

  it('returns the stored survey identity for a response-loss retry', async () => {
    userRepo.findOne.mockResolvedValue({
      ...betaUser,
      isActive: false,
      accountHoldReason: 'beta_survey_complete',
    });
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.SUBMITTED,
      surveyId: 900,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: {},
      }),
    ).resolves.toEqual({
      success: true,
      surveyId: 900,
      logoutRequired: true,
    });

    expect(surveyRepo.save).not.toHaveBeenCalled();
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('recomputes logoutRequired=false for a retry after beta is disabled', async () => {
    betaModeSettingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: false }]);
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.SUBMITTED,
      surveyId: 900,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: {},
      }),
    ).resolves.toEqual({
      success: true,
      surveyId: 900,
      logoutRequired: false,
    });
  });

  it('does not hold a customer when beta mode is disabled before submission', async () => {
    betaModeSettingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: false }]);
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    const result = await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: {},
    });

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(result.logoutRequired).toBe(false);
  });

  it('does not hold an exempt beta customer who submits a stored requirement', async () => {
    userRepo.findOne.mockResolvedValue({
      ...betaUser,
      isBetaSurveyExempt: true,
    });
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    const result = await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: {},
    });

    expect(userRepo.update).not.toHaveBeenCalled();
    expect(result.logoutRequired).toBe(false);
  });

  it('submits a requirement inside a transaction with a write lock', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: { feature: 'More slots', delivery: 'Good' },
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionalManager.getRepository).toHaveBeenCalledWith(TamSurvey);
    expect(transactionalManager.getRepository).toHaveBeenCalledWith(
      TamSurveyRequirement,
    );
    expect(transactionalManager.getRepository).toHaveBeenCalledWith(User);
    expect(requirementRepo.findOne).toHaveBeenCalledWith({
      where: { id: 123 },
      lock: { mode: 'pessimistic_write' },
    });
  });

  it('rejects partial survey data', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: { '0': 4 },
        openForumFeedback: { feature: '', delivery: '' },
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects non-canonical numeric survey keys', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: { ...fullSurveyData, '00': 4 },
        openForumFeedback: {},
      }),
    ).rejects.toThrow('Invalid survey question key: 00');
  });

  it('rejects submitting another user requirement', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 999,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: { feature: '', delivery: '' },
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws not found for missing requirement', async () => {
    requirementRepo.findOne.mockResolvedValue(null);

    await expect(
      service.submitRequirement(10, 123, {
        surveyData: fullSurveyData,
        openForumFeedback: { feature: '', delivery: '' },
      }),
    ).rejects.toThrow(NotFoundException);
  });
});
