import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Repository } from 'typeorm';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { FilesService } from '../files/files.service';
import { CreditsService } from '../credits/credits.service';

export interface BetaMemberRow {
  rank: number;
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

export type BetaCompletionState =
  | { accountStatus: 'active' }
  | {
      accountStatus: 'beta_held';
      user: { fullName: string | null; email: string };
      betaPhotoUploaded: boolean;
      betaSharedOnSocial: boolean;
      betaCompletedAt: string;
    };

const BETA_SURVEY_COMPLETE_HOLD_REASON = 'beta_survey_complete';

@Injectable()
export class BetaModeService {
  constructor(
    @InjectRepository(BetaModeSettings)
    private settingsRepo: Repository<BetaModeSettings>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private creditsService: CreditsService,
    private dataSource: DataSource,
    private filesService: FilesService,
  ) {}

  async getGlobalStatus(): Promise<{ isEnabled: boolean }> {
    const settings = await this.getSettings();
    return { isEnabled: settings.isEnabled };
  }

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
    return this.dataSource.transaction(async (manager) => {
      const settingsRepo = manager.getRepository(BetaModeSettings);
      const usersRepo = manager.getRepository(User);
      let settings = await settingsRepo.findOne({
        where: {},
        order: { id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!settings) {
        settings = await settingsRepo.save(
          settingsRepo.create({ isEnabled: false }),
        );
      }
      settings.isEnabled = isEnabled;
      const saved = await settingsRepo.save(settings);

      if (!isEnabled) {
        await usersRepo.update(
          {
            isActive: false,
            accountHoldReason: BETA_SURVEY_COMPLETE_HOLD_REASON,
          },
          { isActive: true, accountHoldReason: null, accountHeldAt: null },
        );
      }

      return saved;
    });
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
      order: { betaEnrolledAt: 'ASC', id: 'ASC' },
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
    await this.dataSource.transaction(async (manager) => {
      const userRepo = manager.getRepository(User);
      const user = await userRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      this.assertCustomer(user, 'Only customers may join beta testing');

      let enrollmentChanged = false;
      if (!user.isBetaUser) {
        user.isBetaUser = true;
        enrollmentChanged = true;
      }
      if (!user.betaEnrolledAt) {
        user.betaEnrolledAt = new Date();
        enrollmentChanged = true;
      }
      if (enrollmentChanged) {
        await userRepo.save(user);
      }

      await this.creditsService.grantBetaEnrollmentCredits(
        userId,
        100,
        manager,
      );
    });
  }

  async unenrollUser(userId: number): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    this.assertCustomer(user, 'Only customers may join beta testing');
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

    const rankedUsers = this.userRepo
      .createQueryBuilder('ranked')
      .select('ranked.id', 'id')
      .addSelect(
        'ROW_NUMBER() OVER (ORDER BY ranked.beta_enrolled_at ASC, ranked.id ASC)',
        'rank',
      )
      .where('ranked.is_beta_user = true');

    const qb = this.userRepo
      .createQueryBuilder('u')
      .innerJoin(
        `(${rankedUsers.getQuery()})`,
        'beta_rank',
        'beta_rank.id = u.id',
      )
      .setParameters(rankedUsers.getParameters())
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
    const { entities: users, raw } = await qb
      .addSelect('beta_rank.rank', 'rank')
      .orderBy('u.beta_enrolled_at', 'ASC')
      .addOrderBy('u.id', 'ASC')
      .offset(offset)
      .limit(limit)
      .getRawAndEntities<{ rank: string }>();

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
      rows: users.map((u, index) => ({
        rank: Number(raw[index].rank),
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
    this.assertCustomer(user, 'Only customers may have a beta survey policy');
    if (!user.isBetaUser) {
      throw new NotFoundException(`User ${userId} is not a beta member`);
    }
    await this.userRepo.update(userId, { isBetaSurveyExempt: exempt });
    return { id: userId, isBetaSurveyExempt: exempt };
  }

  async resetOrderLimit(
    userId: number,
  ): Promise<{ id: number; betaEnrolledAt: Date }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    this.assertCustomer(user, 'Only customers may have a beta order limit');
    if (!user.isBetaUser) {
      throw new NotFoundException(`User ${userId} is not a beta member`);
    }
    const newEnrolledAt = new Date();
    await this.userRepo.update(userId, { betaEnrolledAt: newEnrolledAt });
    return { id: userId, betaEnrolledAt: newEnrolledAt };
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

    const rank = await this.userRepo
      .createQueryBuilder('u')
      .where('u.is_beta_user = true')
      .andWhere(
        '(u.beta_enrolled_at < :at OR (u.beta_enrolled_at = :at AND u.id <= :id))',
        { at: user.betaEnrolledAt, id: user.id },
      )
      .getCount();

    return { globallyEnabled: settings.isEnabled, isBetaUser: true, rank };
  }

  async submitTestimonial(
    userId: number,
    input: { fileId: number; sharedOnSocial?: boolean },
  ): Promise<{ ok: true }> {
    await this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const user = await usersRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user) throw new NotFoundException(`User ${userId} not found`);
      if (
        user.role !== UserRole.CUSTOMER ||
        !user.isBetaUser ||
        !user.betaCompletedAt
      ) {
        throw new ForbiddenException(
          'A completed beta customer survey is required',
        );
      }

      if (user.betaPhotoFileId != null) {
        if (user.betaPhotoFileId !== input.fileId) {
          throw new ConflictException(
            'A different beta testimonial is already retained',
          );
        }
        if (input.sharedOnSocial && !user.betaSharedOnSocial) {
          await usersRepo.update(userId, { betaSharedOnSocial: true });
        }
        return;
      }

      await this.filesService.resolveBetaTestimonialFile(
        input.fileId,
        userId,
        manager,
      );
      await usersRepo.update(userId, {
        betaPhotoFileId: input.fileId,
        betaPhotoUploadedAt: new Date(),
        betaSharedOnSocial:
          user.betaSharedOnSocial || input.sharedOnSocial === true,
      });
    });
    return { ok: true };
  }

  async markShared(
    userId: number,
  ): Promise<{ ok: true; betaSharedOnSocial: true }> {
    await this.dataSource.transaction(async (manager) => {
      const usersRepo = manager.getRepository(User);
      const user = await usersRepo.findOne({
        where: { id: userId },
        lock: { mode: 'pessimistic_write' },
      });
      this.assertCompletedBetaCustomer(user, userId);
      if (user.betaPhotoFileId == null || user.betaPhotoUploadedAt == null) {
        throw new ForbiddenException(
          'A beta testimonial photo is required before sharing',
        );
      }
      if (!user.betaSharedOnSocial) {
        await usersRepo.update(userId, { betaSharedOnSocial: true });
      }
    });
    return { ok: true, betaSharedOnSocial: true };
  }

  async getCompletionState(userId: number): Promise<BetaCompletionState> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    this.assertCompletedBetaCustomer(user, userId);

    if (
      user.isActive === false &&
      user.accountHoldReason === BETA_SURVEY_COMPLETE_HOLD_REASON
    ) {
      const settings = await this.getSettings();
      if (!settings.isEnabled) {
        await this.reopenCompletedBetaSurveyHolds(userId);
        return { accountStatus: 'active' };
      }
      return {
        accountStatus: 'beta_held',
        user: { fullName: user.fullName, email: user.email },
        betaPhotoUploaded: user.betaPhotoUploadedAt != null,
        betaSharedOnSocial: user.betaSharedOnSocial,
        betaCompletedAt: user.betaCompletedAt.toISOString(),
      };
    }

    if (user.isActive) return { accountStatus: 'active' };
    throw new ForbiddenException('Beta completion state is unavailable');
  }

  private assertCompletedBetaCustomer(
    user: User | null,
    userId: number,
  ): asserts user is User & { betaCompletedAt: Date } {
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (
      user.role !== UserRole.CUSTOMER ||
      !user.isBetaUser ||
      user.betaCompletedAt == null
    ) {
      throw new ForbiddenException(
        'A completed beta customer survey is required',
      );
    }
  }

  private assertCustomer(user: User, message: string): void {
    if (user.role !== UserRole.CUSTOMER) {
      throw new ForbiddenException(message);
    }
  }
}
