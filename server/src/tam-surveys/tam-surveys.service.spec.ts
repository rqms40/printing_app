import { MODULE_METADATA } from '@nestjs/common/constants';
import { getRepositoryToken, TypeOrmModule } from '@nestjs/typeorm';
import { getMetadataArgsStorage } from 'typeorm';
import { TamSurvey } from './entities/tam-survey.entity';
import {
  TamSurveyRequirement,
  TamSurveyRequirementReason,
  TamSurveyRequirementStatus,
} from './entities/tam-survey-requirement.entity';
import { TamSurveysModule } from './tam-surveys.module';
import { User } from '../users/entities/user.entity';

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
