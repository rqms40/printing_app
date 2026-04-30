import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User } from '../users/entities/user.entity';

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
