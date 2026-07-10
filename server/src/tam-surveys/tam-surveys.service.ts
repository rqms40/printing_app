import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Order } from '../orders/entities/order.entity';
import { User, UserRole } from '../users/entities/user.entity';
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
import { BetaModeSettings } from '../beta-mode/entities/beta-mode-settings.entity';
import { RealtimeSessionRegistry } from '../common/realtime/realtime-session-registry';

const REQUIRED_SURVEY_QUESTION_COUNT = 14;
const POSTGRES_UNIQUE_VIOLATION = '23505';
const REQUIREMENT_UNIQUE_CONSTRAINTS = new Set([
  'uq_tam_survey_requirements_order_reason',
  'uq_tam_survey_requirements_user_pending',
]);
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
  private readonly logger = new Logger(TamSurveysService.name);

  constructor(
    @InjectRepository(TamSurvey)
    private readonly tamSurveysRepo: Repository<TamSurvey>,
    @InjectRepository(TamSurveyRequirement)
    private readonly requirementsRepo: Repository<TamSurveyRequirement>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(BetaModeSettings)
    private readonly betaModeSettingsRepo: Repository<BetaModeSettings>,
    private readonly dataSource: DataSource,
    private readonly realtimeSessions: RealtimeSessionRegistry,
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

  async getApprovedFeed() {
    const surveys = await this.tamSurveysRepo.find({
      where: { isApprovedForFeed: true },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return surveys.map((s) => {
      let rating = 5.0;
      if (s.surveyData) {
        const values = Object.values(s.surveyData);
        if (values.length > 0) {
          const sum = values.reduce((acc, val) => acc + Number(val), 0);
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

  async createPostDeliveryRequirementIfNeeded(
    order: Pick<Order, 'id' | 'orderId' | 'userId'>,
    manager?: EntityManager,
  ): Promise<TamSurveyRequirement | null> {
    const betaModeSettingsRepo =
      manager?.getRepository(BetaModeSettings) ?? this.betaModeSettingsRepo;
    const usersRepo = manager?.getRepository(User) ?? this.usersRepo;
    const requirementsRepo =
      manager?.getRepository(TamSurveyRequirement) ?? this.requirementsRepo;

    if (!(await this.isBetaModeEnabled(betaModeSettingsRepo))) return null;

    const user = await usersRepo.findOne({ where: { id: order.userId } });
    if (
      user?.role !== UserRole.CUSTOMER ||
      !user.isBetaUser ||
      user.isBetaSurveyExempt
    ) {
      return null;
    }

    const existing = await requirementsRepo.findOne({
      where: {
        userId: order.userId,
        reason: TamSurveyRequirementReason.POST_DELIVERY,
        status: TamSurveyRequirementStatus.PENDING,
      },
    });
    if (existing) return existing;

    const requirement = requirementsRepo.create({
      userId: order.userId,
      orderId: order.id,
      reason: TamSurveyRequirementReason.POST_DELIVERY,
      status: TamSurveyRequirementStatus.PENDING,
      surveyId: null,
      requiredAt: new Date(),
      submittedAt: null,
    });

    try {
      return await requirementsRepo.save(requirement);
    } catch (error) {
      // A failed statement aborts an existing Postgres transaction, so let the
      // outer completion transaction roll back rather than attempting a query
      // in the failed transaction. The locked order serializes this path.
      if (manager) throw error;
      if (!this.isRequirementUniqueViolation(error)) throw error;

      const racedRequirement = await requirementsRepo.findOne({
        where: {
          userId: order.userId,
          reason: TamSurveyRequirementReason.POST_DELIVERY,
          status: TamSurveyRequirementStatus.PENDING,
        },
      });
      if (!racedRequirement) throw error;

      return racedRequirement;
    }
  }

  async getAccountState(userId: number): Promise<AccountStateResponse> {
    if (!(await this.isBetaModeEnabled())) {
      return { accountStatus: 'active', holds: [] };
    }

    // Admin-granted bypass: this user can log in repeatedly even when beta
    // mode is on and they have pending requirements.
    const user = await this.usersRepo.findOne({
      where: { id: userId },
      select: ['id', 'role', 'isBetaUser', 'isBetaSurveyExempt'],
    });
    if (
      user?.role !== UserRole.CUSTOMER ||
      !user.isBetaUser ||
      user.isBetaSurveyExempt
    ) {
      return { accountStatus: 'active', holds: [] };
    }

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
  ): Promise<{ success: true; surveyId: number; logoutRequired: boolean }> {
    const result = await this.dataSource.transaction(async (manager) => {
      const requirementsRepo = manager.getRepository(TamSurveyRequirement);
      const tamSurveysRepo = manager.getRepository(TamSurvey);
      const usersRepo = manager.getRepository(User);
      const betaModeSettingsRepo = manager.getRepository(BetaModeSettings);

      const user = await usersRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException('User not found');

      const holdPolicyApplies =
        user.role === UserRole.CUSTOMER &&
        user.isBetaUser &&
        !user.isBetaSurveyExempt &&
        (await this.isBetaModeEnabled(betaModeSettingsRepo));

      const requirement = await requirementsRepo.findOne({
        where: { id: requirementId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!requirement) {
        throw new NotFoundException('Survey requirement not found');
      }
      if (requirement.userId !== userId) {
        throw new ForbiddenException('You can only submit your own survey');
      }
      if (
        requirement.status === TamSurveyRequirementStatus.SUBMITTED &&
        requirement.surveyId != null
      ) {
        return {
          success: true as const,
          surveyId: requirement.surveyId,
          logoutRequired:
            holdPolicyApplies &&
            user.isActive === false &&
            user.accountHoldReason === BETA_SURVEY_COMPLETE_HOLD_REASON,
        };
      }
      if (requirement.status !== TamSurveyRequirementStatus.PENDING) {
        throw new BadRequestException('Survey requirement already submitted');
      }

      const surveyData = this.validateSurveyData(dto.surveyData, true);
      const survey = tamSurveysRepo.create({
        userId,
        orderId: requirement.orderId,
        requirementId: requirement.id,
        surveyData,
        openForumFeedback: JSON.stringify(dto.openForumFeedback ?? {}),
      });
      const savedSurvey = await tamSurveysRepo.save(survey);

      requirement.status = TamSurveyRequirementStatus.SUBMITTED;
      requirement.surveyId = savedSurvey.id;
      requirement.submittedAt = new Date();
      await requirementsRepo.save(requirement);

      if (holdPolicyApplies) {
        const holdAt = new Date();
        await usersRepo.update(userId, {
          isActive: false,
          accountHoldReason: BETA_SURVEY_COMPLETE_HOLD_REASON,
          accountHeldAt: holdAt,
          betaCompletedAt: holdAt,
        });
      }

      return {
        success: true as const,
        surveyId: savedSurvey.id,
        logoutRequired: holdPolicyApplies,
      };
    });
    if (result.logoutRequired) {
      try {
        this.realtimeSessions.disconnectUser(userId);
      } catch (error) {
        this.logger.warn(
          `Post-commit socket revocation failed for user ${userId}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }
    return result;
  }

  private isRequirementUniqueViolation(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === POSTGRES_UNIQUE_VIOLATION &&
      'constraint' in error &&
      typeof error.constraint === 'string' &&
      REQUIREMENT_UNIQUE_CONSTRAINTS.has(error.constraint)
    );
  }

  private async isBetaModeEnabled(
    repo: Repository<BetaModeSettings> = this.betaModeSettingsRepo,
  ): Promise<boolean> {
    const settings = await repo.find();
    return settings[0]?.isEnabled ?? false;
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
