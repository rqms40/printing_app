import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { BetaModeService } from './beta-mode.service';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User } from '../users/entities/user.entity';

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 1,
    email: 'user@test.com',
    fullName: 'Test User',
    isBetaUser: false,
    betaEnrolledAt: null,
    betaCreditsGranted: false,
    credits: 50,
    ...overrides,
  } as User);

describe('BetaModeService', () => {
  let service: BetaModeService;
  let settingsRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let mockQB: { update: jest.Mock; set: jest.Mock; where: jest.Mock; execute: jest.Mock };

  beforeEach(async () => {
    settingsRepo = {
      find: jest.fn().mockResolvedValue([{ id: 1, isEnabled: false }]),
      create: jest.fn().mockReturnValue({ id: 1, isEnabled: false }),
      save: jest.fn().mockImplementation(async (v) => v),
    };
    mockQB = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      count: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQB),
    };

    const module = await Test.createTestingModule({
      providers: [
        BetaModeService,
        { provide: getRepositoryToken(BetaModeSettings), useValue: settingsRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
      ],
    }).compile();

    service = module.get(BetaModeService);
  });

  // ── getSettings ────────────────────────────────────────────────────────────

  it('getSettings returns existing settings', async () => {
    settingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: true }]);
    const result = await service.getSettings();
    expect(result.isEnabled).toBe(true);
  });

  it('getSettings creates singleton if table is empty', async () => {
    settingsRepo.find.mockResolvedValue([]);
    await service.getSettings();
    expect(settingsRepo.create).toHaveBeenCalled();
    expect(settingsRepo.save).toHaveBeenCalled();
  });

  // ── enrollUser ─────────────────────────────────────────────────────────────

  it('enrollUser sets isBetaUser=true and grants 100 credits atomically on first enroll', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ credits: 50 }));
    await service.enrollUser(1);
    expect(userRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ isBetaUser: true }),
    );
    expect(mockQB.set).toHaveBeenCalledWith(
      expect.objectContaining({ betaCreditsGranted: true }),
    );
    expect(mockQB.where).toHaveBeenCalledWith(
      expect.stringContaining('beta_credits_granted = false'),
      expect.objectContaining({ id: 1 }),
    );
    expect(mockQB.execute).toHaveBeenCalled();
  });

  it('enrollUser is idempotent — does nothing if already enrolled', async () => {
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: true, betaCreditsGranted: true, credits: 150 }),
    );
    await service.enrollUser(1);
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('enrollUser does not grant credits again if betaCreditsGranted is already true', async () => {
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: false, betaCreditsGranted: true, credits: 150 }),
    );
    await service.enrollUser(1);
    expect(mockQB.execute).not.toHaveBeenCalled();
  });

  it('enrollUser preserves original betaEnrolledAt on re-enroll', async () => {
    const original = new Date('2026-01-01');
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: false, betaEnrolledAt: original, betaCreditsGranted: true }),
    );
    await service.enrollUser(1);
    const [, updateArg] = userRepo.update.mock.calls[0];
    expect(updateArg).not.toHaveProperty('betaEnrolledAt');
  });

  it('enrollUser throws NotFoundException for unknown userId', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.enrollUser(999)).rejects.toThrow(NotFoundException);
  });

  // ── unenrollUser ───────────────────────────────────────────────────────────

  it('unenrollUser sets isBetaUser=false without touching credits', async () => {
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: true, betaCreditsGranted: true, credits: 150 }),
    );
    await service.unenrollUser(1);
    expect(userRepo.update).toHaveBeenCalledWith(1, { isBetaUser: false });
  });

  it('unenrollUser throws NotFoundException for unknown userId', async () => {
    userRepo.findOne.mockResolvedValue(null);
    await expect(service.unenrollUser(999)).rejects.toThrow(NotFoundException);
  });

  // ── getBetaStatus ──────────────────────────────────────────────────────────

  it('getBetaStatus returns isBetaUser=false and rank=null for non-beta user', async () => {
    settingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: true }]);
    userRepo.findOne.mockResolvedValue(makeUser({ isBetaUser: false }));

    const result = await service.getBetaStatus(1);

    expect(result).toEqual({ globallyEnabled: true, isBetaUser: false, rank: null });
    expect(userRepo.count).not.toHaveBeenCalled();
  });

  it('getBetaStatus returns correct rank for enrolled user', async () => {
    settingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: true }]);
    const enrolledAt = new Date('2026-01-15');
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: true, betaEnrolledAt: enrolledAt }),
    );
    userRepo.count.mockResolvedValue(3);

    const result = await service.getBetaStatus(1);

    expect(result).toEqual({ globallyEnabled: true, isBetaUser: true, rank: 3 });
  });

  // ── getBetaUsers ───────────────────────────────────────────────────────────

  it('getBetaUsers returns users ordered by enroll date with 1-indexed rank', async () => {
    const t1 = new Date('2026-01-01');
    const t2 = new Date('2026-01-10');
    userRepo.find.mockResolvedValue([
      makeUser({ id: 1, betaEnrolledAt: t1, betaCreditsGranted: true }),
      makeUser({ id: 2, betaEnrolledAt: t2, betaCreditsGranted: false }),
    ]);

    const result = await service.getBetaUsers();

    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
    expect(result[0].betaEnrolledAt).toBe(t1);
  });
});
