import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TamSurveysService } from './tam-surveys.service';
import {
  SubmitSurveyRequirementDto,
  SubmitTamSurveyDto,
} from './dto/submit-survey.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TamSurveySettings } from './entities/tam-survey-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('tam-surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tam-surveys')
export class TamSurveysController {
  constructor(
    @InjectRepository(TamSurveySettings)
    private tamSurveySettingsRepo: Repository<TamSurveySettings>,
    private tamSurveysService: TamSurveysService,
    private notificationsService: NotificationsService,
  ) {}

  @Get('settings')
  async getSettings() {
    let settings = await this.tamSurveySettingsRepo.findOne({
      where: { id: 1 },
    });
    if (!settings) {
      settings = this.tamSurveySettingsRepo.create({ id: 1, isEnabled: true });
      await this.tamSurveySettingsRepo.save(settings);
    }
    return settings;
  }

  @Post()
  async createSurvey(
    @Req() req: { user: { sub: number } },
    @Body() body: SubmitTamSurveyDto,
  ) {
    const result = await this.tamSurveysService.createVoluntarySurvey(
      req.user.sub,
      body,
    );
    this.notificationsService
      .createForAllAdmins({
        title: 'New Feedback Survey',
        message: 'A new feedback survey was submitted by a customer.',
        type: 'user',
        metadata: { surveyId: result.surveyId },
      })
      .catch((e) => console.error('Failed to notify admins for survey:', e));
    return { success: true };
  }

  @Post('requirements/:requirementId/submit')
  submitRequirement(
    @Req() req: { user: { sub: number } },
    @Param('requirementId', ParseIntPipe) requirementId: number,
    @Body() body: SubmitSurveyRequirementDto,
  ) {
    return this.tamSurveysService.submitRequirement(
      req.user.sub,
      requirementId,
      body,
    );
  }

  @Get('feed')
  async getApprovedFeed() {
    return this.tamSurveysService.getApprovedFeed();
  }
}
