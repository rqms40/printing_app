import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TamSurvey } from './entities/tam-survey.entity';
import { TamSurveyRequirement } from './entities/tam-survey-requirement.entity';
import { TamSurveySettings } from './entities/tam-survey-settings.entity';
import { TamSurveysController } from './tam-surveys.controller';
import { TamSurveysService } from './tam-surveys.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { BetaModeSettings } from '../beta-mode/entities/beta-mode-settings.entity';
import { RealtimeSessionsModule } from '../common/realtime/realtime-sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TamSurvey,
      TamSurveyRequirement,
      TamSurveySettings,
      BetaModeSettings,
      User,
    ]),
    forwardRef(() => NotificationsModule),
    RealtimeSessionsModule,
  ],
  controllers: [TamSurveysController],
  providers: [TamSurveysService],
  exports: [TamSurveysService, TypeOrmModule],
})
export class TamSurveysModule {}
