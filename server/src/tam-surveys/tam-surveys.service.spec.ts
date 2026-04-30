import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { getMetadataArgsStorage, Repository } from 'typeorm';
import { Order, OrderStatus } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { TamSurveysService } from './tam-surveys.service';
import { TamSurvey } from './entities/tam-survey.entity';
import {
  TamSurveyRequirement,
  TamSurveyRequirementReason,
  TamSurveyRequirementStatus,
} from './entities/tam-survey-requirement.entity';
import { TamSurveysModule } from './tam-surveys.module';

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
  let userRepo: any;

  const betaUser = {
    id: 10,
    email: 'beta@test.com',
    isBetaUser: true,
    isActive: true,
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
      create: jest.fn((data) => data as TamSurveyRequirement),
      save: jest.fn(async (req) => ({ id: 123, ...req }) as TamSurveyRequirement),
    };
    userRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        TamSurveysService,
        { provide: getRepositoryToken(TamSurvey), useValue: surveyRepo },
        {
          provide: getRepositoryToken(TamSurveyRequirement),
          useValue: requirementRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
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

  it('does not create a requirement for a non-beta user', async () => {
    userRepo.findOne.mockResolvedValue({ ...betaUser, isBetaUser: false });

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBeNull();
    expect(requirementRepo.save).not.toHaveBeenCalled();
  });

  it('returns the existing requirement instead of duplicating', async () => {
    const existing = { id: 77, userId: 10, orderId: 55 } as TamSurveyRequirement;
    userRepo.findOne.mockResolvedValue(betaUser);
    requirementRepo.findOne.mockResolvedValue(existing);

    const result = await service.createPostDeliveryRequirementIfNeeded(order);

    expect(result).toBe(existing);
    expect(requirementRepo.save).not.toHaveBeenCalled();
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

  it('submits a requirement and holds the beta account', async () => {
    requirementRepo.findOne.mockResolvedValue({
      id: 123,
      userId: 10,
      orderId: 55,
      status: TamSurveyRequirementStatus.PENDING,
    } as TamSurveyRequirement);

    const result = await service.submitRequirement(10, 123, {
      surveyData: fullSurveyData,
      openForumFeedback: { feature: 'More slots', delivery: 'Good' },
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
