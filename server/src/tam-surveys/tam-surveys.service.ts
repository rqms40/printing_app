import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import {
  SubmitSurveyRequirementDto,
  SubmitTamSurveyDto,
} from './dto/submit-survey.dto';
import {
  TamSurveyRequirement,
  TamSurveyRequirementReason,
  TamSurveyRequirementStatus,
} from './entities/tam-survey-requirement.entity';
import { TamSurvey } from './entities/tam-survey.entity';

const REQUIRED_SURVEY_QUESTION_COUNT = 14;
export const BETA_SURVEY_COMPLETE_HOLD_REASON = 'beta_survey_complete';

export type AccountStateResponse = {
  accountStatus: 'active' | 'survey_required';
  holds: Array<{
    type: 'post_delivery_survey';
    requirementId: number;
    orderId: number;
    orderRef: string;
    requiredAt: Date;
  }>;
};

@Injectable()
export class TamSurveysService {
  constructor(
    @InjectRepository(TamSurvey)
    private readonly tamSurveysRepo: Repository<TamSurvey>,
    @InjectRepository(TamSurveyRequirement)
    private readonly requirementsRepo: Repository<TamSurveyRequirement>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  async createVoluntarySurvey(
    userId: number,
    dto: SubmitTamSurveyDto,
  ): Promise<{ success: true; surveyId: number }> {
    const surveyData = this.validateSurveyData(dto.survey_data, false);
    const survey = this.tamSurveysRepo.create({
      userId,
      surveyData,
      openForumFeedback:
        typeof dto.open_forum_feedback === 'string'
          ? dto.open_forum_feedback
          : JSON.stringify(dto.open_forum_feedback),
      orderId: null,
      requirementId: null,
    });
    const saved = await this.tamSurveysRepo.save(survey);
    return { success: true, surveyId: saved.id };
  }

  async createPostDeliveryRequirementIfNeeded(
    order: Pick<Order, 'id' | 'orderId' | 'userId'>,
  ): Promise<TamSurveyRequirement | null> {
    const user = await this.usersRepo.findOne({ where: { id: order.userId } });
    if (!user?.isBetaUser) return null;

    const existing = await this.requirementsRepo.findOne({
      where: {
        orderId: order.id,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
      },
    });
    if (existing) return existing;

    const requirement = this.requirementsRepo.create({
      userId: order.userId,
      orderId: order.id,
      reason: TamSurveyRequirementReason.POST_DELIVERY,
      status: TamSurveyRequirementStatus.PENDING,
      surveyId: null,
      requiredAt: new Date(),
      submittedAt: null,
    });
    return this.requirementsRepo.save(requirement);
  }

  async getAccountState(userId: number): Promise<AccountStateResponse> {
    const requirement = await this.requirementsRepo.findOne({
      where: {
        userId,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
        status: TamSurveyRequirementStatus.PENDING,
      },
      relations: ['order'],
      order: { requiredAt: 'ASC' },
    });

    if (!requirement) {
      return { accountStatus: 'active', holds: [] };
    }

    return {
      accountStatus: 'survey_required',
      holds: [
        {
          type: 'post_delivery_survey',
          requirementId: requirement.id,
          orderId: requirement.orderId,
          orderRef: requirement.order?.orderId ?? `ORD-${requirement.orderId}`,
          requiredAt: requirement.requiredAt,
        },
      ],
    };
  }

  async submitRequirement(
    userId: number,
    requirementId: number,
    dto: SubmitSurveyRequirementDto,
  ): Promise<{ success: true; surveyId: number; logoutRequired: true }> {
    const requirement = await this.requirementsRepo.findOne({
      where: { id: requirementId },
    });
    if (!requirement) throw new NotFoundException('Survey requirement not found');
    if (requirement.userId !== userId) {
      throw new ForbiddenException('You can only submit your own survey');
    }
    if (requirement.status !== TamSurveyRequirementStatus.PENDING) {
      throw new BadRequestException('Survey requirement already submitted');
    }

    const surveyData = this.validateSurveyData(dto.surveyData, true);
    const survey = this.tamSurveysRepo.create({
      userId,
      orderId: requirement.orderId,
      requirementId: requirement.id,
      surveyData,
      openForumFeedback: JSON.stringify(dto.openForumFeedback ?? {}),
    });
    const savedSurvey = await this.tamSurveysRepo.save(survey);

    requirement.status = TamSurveyRequirementStatus.SUBMITTED;
    requirement.surveyId = savedSurvey.id;
    requirement.submittedAt = new Date();
    await this.requirementsRepo.save(requirement);

    const holdAt = new Date();
    await this.usersRepo.update(userId, {
      isActive: false,
      accountHoldReason: BETA_SURVEY_COMPLETE_HOLD_REASON,
      accountHeldAt: holdAt,
      betaCompletedAt: holdAt,
    });

    return { success: true, surveyId: savedSurvey.id, logoutRequired: true };
  }

  private validateSurveyData(
    data: Record<string, number>,
    requireComplete: boolean,
  ): Record<string, number> {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      throw new BadRequestException('surveyData must be an object');
    }

    const result: Record<string, number> = {};
    for (const [key, rawValue] of Object.entries(data)) {
      if (!/^\d+$/.test(key)) {
        throw new BadRequestException(`Invalid survey question key: ${key}`);
      }
      const index = Number(key);
      if (index < 0 || index >= REQUIRED_SURVEY_QUESTION_COUNT) {
        throw new BadRequestException(`Unknown survey question key: ${key}`);
      }
      if (!Number.isInteger(rawValue) || rawValue < 0 || rawValue > 4) {
        throw new BadRequestException(`Invalid answer for question ${key}`);
      }
      result[key] = rawValue;
    }

    if (requireComplete) {
      for (let i = 0; i < REQUIRED_SURVEY_QUESTION_COUNT; i++) {
        if (result[String(i)] == null) {
          throw new BadRequestException(`Missing answer for question ${i}`);
        }
      }
    }

    return result;
  }
}
