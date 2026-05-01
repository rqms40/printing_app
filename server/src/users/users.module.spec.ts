import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { Global, Module } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { UsersModule } from './users.module';
import { User } from './entities/user.entity';
import { TamSurvey } from '../tam-surveys/entities/tam-survey.entity';
import { TamSurveyRequirement } from '../tam-surveys/entities/tam-survey-requirement.entity';
import { TamSurveySettings } from '../tam-surveys/entities/tam-survey-settings.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { MarketingNotification } from '../notifications/entities/marketing-notification.entity';
import { FirebaseService } from '../firebase/firebase.service';
import { BetaModeSettings } from '../beta-mode/entities/beta-mode-settings.entity';

const mockDataSource = { transaction: jest.fn() };

const mockFirebaseService = {
  sendToMultiple: jest.fn(),
  sendToToken: jest.fn(),
  isInitialized: () => false,
};

@Global()
@Module({
  providers: [
    { provide: DataSource, useValue: mockDataSource },
    { provide: FirebaseService, useValue: mockFirebaseService },
  ],
  exports: [DataSource, FirebaseService],
})
class TestTypeOrmSupportModule {}

describe('UsersModule wiring', () => {
  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  };

  it('compiles with account-state survey dependencies', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [() => ({ JWT_SECRET: 'test-secret' })],
        }),
        TestTypeOrmSupportModule,
        UsersModule,
      ],
    })
      .overrideProvider(getRepositoryToken(User))
      .useValue(mockRepository)
      .overrideProvider(getRepositoryToken(TamSurvey))
      .useValue(mockRepository)
      .overrideProvider(getRepositoryToken(TamSurveyRequirement))
      .useValue(mockRepository)
      .overrideProvider(getRepositoryToken(TamSurveySettings))
      .useValue(mockRepository)
      .overrideProvider(getRepositoryToken(Notification))
      .useValue(mockRepository)
      .overrideProvider(getRepositoryToken(MarketingNotification))
      .useValue(mockRepository)
      .overrideProvider(getRepositoryToken(BetaModeSettings))
      .useValue(mockRepository)
      .compile();

    expect(moduleRef).toBeDefined();
    await moduleRef.close();
  });
});
