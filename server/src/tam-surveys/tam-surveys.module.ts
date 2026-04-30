import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TamSurvey } from './entities/tam-survey.entity';
import { TamSurveyRequirement } from './entities/tam-survey-requirement.entity';
import { TamSurveySettings } from './entities/tam-survey-settings.entity';
import { TamSurveysController } from './tam-surveys.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TamSurvey,
      TamSurveyRequirement,
      TamSurveySettings,
    ]),
    NotificationsModule,
  ],
  controllers: [TamSurveysController],
  exports: [TypeOrmModule],
})
export class TamSurveysModule {}
