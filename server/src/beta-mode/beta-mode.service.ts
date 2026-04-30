import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, LessThanOrEqual } from 'typeorm';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User } from '../users/entities/user.entity';

export interface BetaMemberRow {
  id: number;
  email: string;
  fullName: string | null;
  betaEnrolledAt: Date | null;
  betaCreditsGranted: boolean;
  isBetaSurveyExempt: boolean;
  pendingSurveyCount: number;
}

export interface BetaMembersPage {
  rows: BetaMemberRow[];
  total: number;
  page: number;
  limit: number;
}

const BETA_SURVEY_COMPLETE_HOLD_REASON = 'beta_survey_complete';

@Injectable()
export class BetaModeService {
  constructor(
    @InjectRepository(BetaModeSettings)
    private settingsRepo: Repository<BetaModeSettings>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  async getSettings(): Promise<BetaModeSettings> {
    let settings = await this.settingsRepo.find();
    if (settings.length === 0) {
      settings = [
        await this.settingsRepo.save(
          this.settingsRepo.create({ isEnabled: false }),
        ),
      ];
    }
    return settings[0];
  }

  async updateSettings(isEnabled: boolean): Promise<BetaModeSettings> {
    const settings = await this.getSettings();
    settings.isEnabled = isEnabled;
    const saved = await this.settingsRepo.save(settings);

    if (!isEnabled) {
      await this.reopenCompletedBetaSurveyHolds();
    }

    return saved;
  }

  async reopenCompletedBetaSurveyHolds(userId?: number): Promise<void> {
    await this.userRepo.update(
      {
        ...(userId == null ? {} : { id: userId }),
        isActive: false,
        accountHoldReason: BETA_SURVEY_COMPLETE_HOLD_REASON,
      },
      { isActive: true, accountHoldReason: null, accountHeldAt: null },
    );
  }

  async getBetaUsers(): Promise<
    Array<{
      rank: number;
      id: number;
      email: string;
      fullName: string | null;
      betaEnrolledAt: Date;
      betaCreditsGranted: boolean;
    }>
  > {
    const users = await this.userRepo.find({
      where: { isBetaUser: true },
      order: { betaEnrolledAt: 'ASC' },
    });
    return users.map((u, index) => ({
      rank: index + 1,
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      betaEnrolledAt: u.betaEnrolledAt!,
      betaCreditsGranted: u.betaCreditsGranted,
    }));
  }

  async enrollUser(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (user.isBetaUser) return;

    const update: Partial<User> = { isBetaUser: true };
    if (!user.betaEnrolledAt) {
      update.betaEnrolledAt = new Date();
    }
    await this.userRepo.update(userId, update);

    if (!user.betaCreditsGranted) {
      // Atomic increment with DB-level guard prevents double-grant under concurrent requests
      await this.userRepo
        .createQueryBuilder()
        .update(User)
        .set({ credits: () => 'credits + 100', betaCreditsGranted: true })
        .where('id = :id AND beta_credits_granted = false', { id: userId })
        .execute();
    }
  }

  async unenrollUser(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    await this.userRepo.update(userId, { isBetaUser: false });
  }

  async searchBetaMembers(opts: {
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<BetaMembersPage> {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
    const offset = (page - 1) * limit;
    const search = opts.search?.trim();

    const qb = this.userRepo
      .createQueryBuilder('u')
      .where('u.is_beta_user = true');

    if (search) {
      qb.andWhere(
        new Brackets((b) => {
          b.where('LOWER(u.email) LIKE :term', {
            term: `%${search.toLowerCase()}%`,
          }).orWhere('LOWER(u.full_name) LIKE :term', {
            term: `%${search.toLowerCase()}%`,
          });
        }),
      );
    }

    const total = await qb.clone().getCount();
    const users = await qb
      .orderBy('u.beta_enrolled_at', 'ASC')
      .offset(offset)
      .limit(limit)
      .getMany();

    let pendingCounts: Record<number, number> = {};
    if (users.length > 0) {
      const ids = users.map((u) => u.id);
      const rows = await this.userRepo.manager.query<
        Array<{ user_id: string; pending: string }>
      >(
        `SELECT user_id::text, COUNT(*)::text AS pending
         FROM tam_survey_requirements
         WHERE user_id = ANY($1::int[]) AND status = 'pending'
         GROUP BY user_id`,
        [ids],
      );
      pendingCounts = rows.reduce<Record<number, number>>((acc, r) => {
        acc[Number(r.user_id)] = Number(r.pending);
        return acc;
      }, {});
    }

    return {
      rows: users.map((u) => ({
        id: u.id,
        email: u.email,
        fullName: u.fullName,
        betaEnrolledAt: u.betaEnrolledAt,
        betaCreditsGranted: u.betaCreditsGranted,
        isBetaSurveyExempt: u.isBetaSurveyExempt,
        pendingSurveyCount: pendingCounts[u.id] ?? 0,
      })),
      total,
      page,
      limit,
    };
  }

  async setBetaSurveyExempt(
    userId: number,
    exempt: boolean,
  ): Promise<{ id: number; isBetaSurveyExempt: boolean }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!user.isBetaUser) {
      throw new NotFoundException(`User ${userId} is not a beta member`);
    }
    await this.userRepo.update(userId, { isBetaSurveyExempt: exempt });
    return { id: userId, isBetaSurveyExempt: exempt };
  }

  async getBetaStatus(userId: number): Promise<{
    globallyEnabled: boolean;
    isBetaUser: boolean;
    rank: number | null;
  }> {
    const settings = await this.getSettings();
    const user = await this.userRepo.findOne({ where: { id: userId } });

    if (!user || !user.isBetaUser || !user.betaEnrolledAt) {
      return {
        globallyEnabled: settings.isEnabled,
        isBetaUser: false,
        rank: null,
      };
    }

    const rank = await this.userRepo.count({
      where: {
        isBetaUser: true,
        betaEnrolledAt: LessThanOrEqual(user.betaEnrolledAt),
      },
    });

    return { globallyEnabled: settings.isEnabled, isBetaUser: true, rank };
  }
}
