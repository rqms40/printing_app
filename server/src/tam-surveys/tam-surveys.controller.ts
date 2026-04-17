import { Controller, Post, Body, UseGuards, Req, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TamSurvey } from './entities/tam-survey.entity';
import { TamSurveySettings } from './entities/tam-survey-settings.entity';
import { NotificationsService } from '../notifications/notifications.service';

@ApiTags('tam-surveys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tam-surveys')
export class TamSurveysController {
  constructor(
    @InjectRepository(TamSurvey)
    private tamSurveysRepo: Repository<TamSurvey>,
    @InjectRepository(TamSurveySettings)
    private tamSurveySettingsRepo: Repository<TamSurveySettings>,
    private notificationsService: NotificationsService,
  ) {}

  @Get('settings')
  async getSettings() {
    let settings = await this.tamSurveySettingsRepo.findOne({ where: { id: 1 } });
    if (!settings) {
      settings = this.tamSurveySettingsRepo.create({ id: 1, isEnabled: true });
      await this.tamSurveySettingsRepo.save(settings);
    }
    return settings;
  }

  @Post()
  async createSurvey(
    @Req() req: any,
    @Body() body: { survey_data: any; open_forum_feedback: string },
  ) {
    const survey = this.tamSurveysRepo.create({
      userId: req.user.sub,
      surveyData: body.survey_data,
      openForumFeedback: body.open_forum_feedback,
    });
    await this.tamSurveysRepo.save(survey);

    // Notify ALL admins asynchronously
    this.notificationsService.createForAllAdmins({
      title: 'New Feedback Survey',
      message: `A new feedback survey was submitted by a customer.`,
      type: 'user', // generic type for styling on admin panel
      metadata: { surveyId: survey.id },
    }).catch(e => console.error('Failed to notify admins for survey:', e));

    return { success: true };
  }

  @Get('feed')
  async getApprovedFeed() {
    const surveys = await this.tamSurveysRepo.find({
      where: { isApprovedForFeed: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });
    
    return surveys.map((s) => {
      let rating = 5.0;
      if (s.surveyData) {
        const values = Object.values(s.surveyData) as number[];
        if (values.length > 0) {
          const sum = values.reduce((acc, val) => acc + val, 0);
          rating = Number((sum / values.length).toFixed(1));
        }
      }
      
      return {
        id: s.id,
        user_name: s.user?.fullName ?? s.user?.email ?? 'Customer',
        rating,
        feedback: s.openForumFeedback ?? null,
        created_at: s.createdAt,
      };
    });
  }
}
