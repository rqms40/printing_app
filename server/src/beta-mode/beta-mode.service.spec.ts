import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { BetaModeService } from './beta-mode.service';
import { BetaModeSettings } from './entities/beta-mode-settings.entity';
import { User } from '../users/entities/user.entity';
import { FileMetadata } from '../files/entities/file-metadata.entity';
import { CreditsService } from '../credits/credits.service';
import { DataSource, EntityManager } from 'typeorm';

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
  }) as User;

describe('BetaModeService', () => {
  let service: BetaModeService;
  let settingsRepo: { find: jest.Mock; create: jest.Mock; save: jest.Mock };
  let userRepo: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let fileMetadataRepo: { findOne: jest.Mock };
  let creditsService: { grantBetaEnrollmentCredits: jest.Mock };
  let dataSource: { transaction: jest.Mock };
  let transactionUserRepo: { findOne: jest.Mock; save: jest.Mock };
  let transactionManager: EntityManager;
  let mockQB: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getCount: jest.Mock;
  };

  beforeEach(async () => {
    settingsRepo = {
      find: jest.fn().mockResolvedValue([{ id: 1, isEnabled: false }]),
      create: jest.fn().mockReturnValue({ id: 1, isEnabled: false }),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      save: jest.fn().mockImplementation(async (v) => v),
    };
    mockQB = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    userRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn().mockReturnValue(mockQB),
    };
    fileMetadataRepo = {
      findOne: jest.fn(),
    };
    creditsService = {
      grantBetaEnrollmentCredits: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn(),
    };
    transactionUserRepo = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      findOne: jest.fn((options) => userRepo.findOne(options)),
      save: jest.fn().mockImplementation(async (user: User) => user),
    };
    transactionManager = {
      getRepository: jest.fn().mockReturnValue(transactionUserRepo),
    } as unknown as EntityManager;
    dataSource.transaction.mockImplementation(
      async (work: (manager: EntityManager) => Promise<unknown>) => {
        await work(transactionManager);
      },
    );

    const module = await Test.createTestingModule({
      providers: [
        BetaModeService,
        {
          provide: getRepositoryToken(BetaModeSettings),
          useValue: settingsRepo,
        },
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(FileMetadata),
          useValue: fileMetadataRepo,
        },
        { provide: CreditsService, useValue: creditsService },
        { provide: DataSource, useValue: dataSource },
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

  it('updateSettings disables beta mode and reopens beta survey held accounts', async () => {
    settingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: true }]);

    const result = await service.updateSettings(false);

    expect(result.isEnabled).toBe(false);
    expect(userRepo.update).toHaveBeenCalledWith(
      { isActive: false, accountHoldReason: 'beta_survey_complete' },
      { isActive: true, accountHoldReason: null, accountHeldAt: null },
    );
  });

  it('updateSettings does not reopen held accounts when enabling beta mode', async () => {
    settingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: false }]);

    await service.updateSettings(true);

    expect(userRepo.update).not.toHaveBeenCalledWith(
      { isActive: false, accountHoldReason: 'beta_survey_complete' },
      expect.anything(),
    );
  });

  // ── enrollUser ─────────────────────────────────────────────────────────────

  it('enrollUser sets isBetaUser=true and grants 100 credits atomically on first enroll', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ credits: 50 }));
    await service.enrollUser(1);
    expect(transactionUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isBetaUser: true }),
    );
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(
      1,
      100,
      transactionManager,
    );
  });

  it('delegates multi-instance correctness to locked database transactions', async () => {
    userRepo.findOne.mockResolvedValue(makeUser({ id: 9, credits: 0 }));

    await Promise.all([service.enrollUser(9), service.enrollUser(9)]);

    expect(dataSource.transaction).toHaveBeenCalledTimes(2);
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledTimes(2);
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(
      9,
      100,
      transactionManager,
    );
  });

  it('locks enrollment state and shares one transaction with the credit grant', async () => {
    const lockedUser = makeUser({ id: 9, credits: 0 });
    const transactionUserRepo = {
      findOne: jest.fn().mockResolvedValue(lockedUser),
      save: jest.fn().mockImplementation(async (user: User) => user),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(transactionUserRepo),
    } as unknown as EntityManager;
    dataSource.transaction.mockImplementation(
      async (work: (manager: EntityManager) => Promise<unknown>) => {
        await work(manager);
      },
    );

    await service.enrollUser(9);

    expect(transactionUserRepo.findOne).toHaveBeenCalledWith({
      where: { id: 9 },
      lock: { mode: 'pessimistic_write' },
    });
    expect(transactionUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 9,
        isBetaUser: true,
        betaEnrolledAt: expect.any(Date),
      }),
    );
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(
      9,
      100,
      manager,
    );
    expect(userRepo.update).not.toHaveBeenCalled();
  });

  it('enrollUser is idempotent — does nothing if already enrolled', async () => {
    userRepo.findOne.mockResolvedValue(
      makeUser({
        isBetaUser: true,
        betaEnrolledAt: new Date('2026-07-01T00:00:00Z'),
        betaCreditsGranted: true,
        credits: 150,
      }),
    );
    await service.enrollUser(1);
    expect(transactionUserRepo.save).not.toHaveBeenCalled();
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(
      1,
      100,
      transactionManager,
    );
  });

  it('enrollUser recovers an enrolled user whose credit grant was interrupted', async () => {
    userRepo.findOne.mockResolvedValue(
      makeUser({
        isBetaUser: true,
        betaEnrolledAt: new Date('2026-07-01T00:00:00Z'),
        betaCreditsGranted: false,
        credits: 0,
      }),
    );

    await service.enrollUser(1);

    expect(transactionUserRepo.save).not.toHaveBeenCalled();
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(
      1,
      100,
      transactionManager,
    );
  });

  it('enrollUser does not grant credits again if betaCreditsGranted is already true', async () => {
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: false, betaCreditsGranted: true, credits: 150 }),
    );
    await service.enrollUser(1);
    expect(transactionUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isBetaUser: true }),
    );
    expect(creditsService.grantBetaEnrollmentCredits).toHaveBeenCalledWith(
      1,
      100,
      transactionManager,
    );
  });

  it('enrollUser preserves original betaEnrolledAt on re-enroll', async () => {
    const original = new Date('2026-01-01');
    userRepo.findOne.mockResolvedValue(
      makeUser({
        isBetaUser: false,
        betaEnrolledAt: original,
        betaCreditsGranted: true,
      }),
    );
    await service.enrollUser(1);
    expect(transactionUserRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ betaEnrolledAt: original }),
    );
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

    expect(result).toEqual({
      globallyEnabled: true,
      isBetaUser: false,
      rank: null,
    });
    expect(userRepo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('getBetaStatus returns correct rank for enrolled user', async () => {
    settingsRepo.find.mockResolvedValue([{ id: 1, isEnabled: true }]);
    const enrolledAt = new Date('2026-01-15');
    userRepo.findOne.mockResolvedValue(
      makeUser({ isBetaUser: true, betaEnrolledAt: enrolledAt }),
    );
    mockQB.getCount.mockResolvedValue(3);

    const result = await service.getBetaStatus(1);

    expect(result).toEqual({
      globallyEnabled: true,
      isBetaUser: true,
      rank: 3,
    });
  });

  it('breaks equal enrollment timestamps by user id', async () => {
    const sharedTimestamp = new Date('2026-01-15T00:00:00Z');
    const rankQuery = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(3),
    };
    userRepo.createQueryBuilder.mockReturnValueOnce(rankQuery);
    userRepo.findOne.mockResolvedValue(
      makeUser({ id: 9, isBetaUser: true, betaEnrolledAt: sharedTimestamp }),
    );

    await service.getBetaStatus(9);

    expect(rankQuery.andWhere).toHaveBeenCalledWith(
      '(u.beta_enrolled_at < :at OR (u.beta_enrolled_at = :at AND u.id <= :id))',
      { at: sharedTimestamp, id: 9 },
    );
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
    expect(userRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({
        order: { betaEnrolledAt: 'ASC', id: 'ASC' },
      }),
    );
  });

  it('uses user id as the secondary order for paginated beta members', async () => {
    const countQuery = { getCount: jest.fn().mockResolvedValue(0) };
    const memberQuery = {
      where: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValue(countQuery),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    userRepo.createQueryBuilder.mockReturnValueOnce(memberQuery);

    await service.searchBetaMembers({ page: 1, limit: 10 });

    expect(memberQuery.orderBy).toHaveBeenCalledWith(
      'u.beta_enrolled_at',
      'ASC',
    );
    expect(memberQuery.addOrderBy).toHaveBeenCalledWith('u.id', 'ASC');
  });

  // ── submitTestimonial ──────────────────────────────────────────────────────

  describe('submitTestimonial', () => {
    it('happy path: updates user row and returns { ok: true }', async () => {
      fileMetadataRepo.findOne.mockResolvedValue({
        id: 42,
        uploadedBy: 1,
        objectKey: 'uploads/beta_testimonial/2026/07/photo.png',
        purpose: 'beta_testimonial',
        mimeType: 'image/png',
      });

      const result = await service.submitTestimonial(1, {
        fileId: 42,
        sharedOnSocial: true,
      });

      expect(result).toEqual({ ok: true });
      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({
          betaPhotoFileId: 42,
          betaPhotoUploadedAt: expect.any(Date),
          betaSharedOnSocial: true,
        }),
      );
    });

    it('defaults sharedOnSocial to false when omitted', async () => {
      fileMetadataRepo.findOne.mockResolvedValue({
        id: 42,
        uploadedBy: 1,
        objectKey: 'uploads/beta_testimonial/2026/07/photo.png',
        purpose: 'beta_testimonial',
        mimeType: 'image/png',
      });

      await service.submitTestimonial(1, { fileId: 42 });

      expect(userRepo.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ betaSharedOnSocial: false }),
      );
    });

    it('throws NotFoundException when file does not exist', async () => {
      fileMetadataRepo.findOne.mockResolvedValue(null);

      await expect(
        service.submitTestimonial(1, { fileId: 999 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when file belongs to a different user', async () => {
      fileMetadataRepo.findOne.mockResolvedValue({ id: 42, uploadedBy: 99 });

      await expect(
        service.submitTestimonial(1, { fileId: 42 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects an ordinary order upload as a beta testimonial', async () => {
      fileMetadataRepo.findOne.mockResolvedValue({
        id: 42,
        uploadedBy: 1,
        objectKey: 'uploads/beta_testimonial/2026/07/spoofed.png',
        purpose: 'general',
        mimeType: 'image/png',
      });

      await expect(
        service.submitTestimonial(1, { fileId: 42 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a testimonial file with a non-image MIME type', async () => {
      fileMetadataRepo.findOne.mockResolvedValue({
        id: 42,
        uploadedBy: 1,
        objectKey: 'uploads/beta_testimonial/2026/07/document.pdf',
        purpose: 'beta_testimonial',
        mimeType: 'application/pdf',
      });

      await expect(
        service.submitTestimonial(1, { fileId: 42 }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects a testimonial record without a storage object key', async () => {
      fileMetadataRepo.findOne.mockResolvedValue({
        id: 42,
        uploadedBy: 1,
        objectKey: null,
        purpose: 'beta_testimonial',
        mimeType: 'image/jpeg',
      });

      await expect(
        service.submitTestimonial(1, { fileId: 42 }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('resetOrderLimit', () => {
    it('updates betaEnrolledAt to a recent timestamp for a beta user', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 7,
        isBetaUser: true,
        betaEnrolledAt: new Date('2026-04-01T00:00:00Z'),
      } as any);
      userRepo.update.mockResolvedValue(undefined as any);

      const before = Date.now();
      const result = await service.resetOrderLimit(7);
      const after = Date.now();

      expect(userRepo.update).toHaveBeenCalledWith(
        7,
        expect.objectContaining({ betaEnrolledAt: expect.any(Date) }),
      );
      const updateCalls = userRepo.update.mock.calls;
      const passedDate: Date =
        updateCalls[updateCalls.length - 1][1].betaEnrolledAt;
      expect(passedDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(passedDate.getTime()).toBeLessThanOrEqual(after);
      expect(result.id).toBe(7);
      expect(result.betaEnrolledAt).toBeInstanceOf(Date);
    });

    it('throws NotFoundException when user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.resetOrderLimit(7)).rejects.toThrow(/not found/i);
    });

    it('throws NotFoundException when user is not a beta member', async () => {
      userRepo.findOne.mockResolvedValue({
        id: 7,
        isBetaUser: false,
      } as any);
      await expect(service.resetOrderLimit(7)).rejects.toThrow(/not a beta/i);
    });
  });
});
