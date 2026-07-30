import { NotFoundException } from '@nestjs/common';
import { MarketingSchedulerService } from './marketing-scheduler.service';
import { MarketingNotification } from './entities/marketing-notification.entity';

describe('MarketingSchedulerService', () => {
  const now = new Date('2026-05-02T12:00:00.000Z');

  function setup(
    notification: Partial<MarketingNotification> = {},
    options: {
      fcmAvailable?: boolean;
      firebaseResult?: { successCount: number; failureCount: number } | null;
      users?: { id: number; fcmToken: string | null }[];
    } = {},
  ) {
    const row = {
      id: 1,
      header: 'Promo',
      body: 'Print today',
      description: 'Promo',
      imageUrl: null,
      frequency: '1d',
      isActive: true,
      lastSentAt: null,
      ...notification,
    } as MarketingNotification;
    const repo = {
      find: jest.fn().mockResolvedValue([row]),
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn().mockResolvedValue(row),
    };
    const firebaseService = {
      isAvailable: options.fcmAvailable ?? true,
      sendToMultiple: jest
        .fn()
        .mockResolvedValue(
          options.firebaseResult === undefined
            ? { successCount: 1, failureCount: 0 }
            : options.firebaseResult,
        ),
    };
    const usersService = {
      findAll: jest
        .fn()
        .mockResolvedValue(options.users ?? [{ id: 1, fcmToken: 'token-a' }]),
    };
    const service = new MarketingSchedulerService(
      repo as any,
      firebaseService as any,
      usersService as any,
    );

    return { firebaseService, repo, row, service, usersService };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('does not send a weekly interval before enough days have elapsed', async () => {
    const { firebaseService, repo, service } = setup({
      frequency: '2w',
      lastSentAt: new Date('2026-04-20T12:00:00.000Z'),
    });

    await service.handleCron();

    expect(firebaseService.sendToMultiple).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('uses the shared send path when a scheduled interval is due', async () => {
    const { firebaseService, repo, row, service } = setup({
      frequency: '2w',
      lastSentAt: new Date('2026-04-17T12:00:00.000Z'),
    });

    await service.handleCron();

    expect(firebaseService.sendToMultiple).toHaveBeenCalledWith(
      ['token-a'],
      'Promo',
      'Print today',
      { type: 'marketing' },
      undefined,
    );
    expect(row.lastSentAt).toEqual(now);
    expect(repo.save).toHaveBeenCalledWith(row);
  });

  it('sends immediately, returns delivery counts, and bumps lastSentAt', async () => {
    const { firebaseService, repo, row, service } = setup(
      {},
      {
        firebaseResult: { successCount: 2, failureCount: 1 },
        users: [
          { id: 1, fcmToken: 'token-a' },
          { id: 2, fcmToken: 'token-b' },
          { id: 3, fcmToken: 'token-c' },
          { id: 4, fcmToken: '  ' },
        ],
      },
    );

    const result = await service.sendNotificationById(1);

    expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(firebaseService.sendToMultiple).toHaveBeenCalledWith(
      ['token-a', 'token-b', 'token-c'],
      'Promo',
      'Print today',
      { type: 'marketing' },
      undefined,
    );
    expect(result).toEqual({
      sentTo: 2,
      failed: 1,
      fcmAvailable: true,
      tokens: 3,
    });
    expect(row.lastSentAt).toEqual(now);
    expect(repo.save).toHaveBeenCalledWith(row);
  });

  it('passes the marketing image URL in data and Firebase image config', async () => {
    const { firebaseService, service } = setup({
      imageUrl: 'https://cdn.example.com/promo.jpg',
    });

    await service.sendNotificationById(1);

    expect(firebaseService.sendToMultiple).toHaveBeenCalledWith(
      ['token-a'],
      'Promo',
      'Print today',
      {
        type: 'marketing',
        imageUrl: 'https://cdn.example.com/promo.jpg',
      },
      'https://cdn.example.com/promo.jpg',
    );
  });

  it('throws a 404 when the marketing notification does not exist', async () => {
    const { firebaseService, repo, service } = setup();
    repo.findOne.mockResolvedValue(null);

    await expect(service.sendNotificationById(999)).rejects.toThrow(
      NotFoundException,
    );
    expect(firebaseService.sendToMultiple).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('reports unavailable FCM without bumping lastSentAt', async () => {
    const previousLastSentAt = new Date('2026-04-01T12:00:00.000Z');
    const { repo, row, service } = setup(
      { lastSentAt: previousLastSentAt },
      { fcmAvailable: false, firebaseResult: null },
    );

    const result = await service.sendNotificationById(1);

    expect(result).toEqual({
      sentTo: 0,
      failed: 0,
      fcmAvailable: false,
      tokens: 1,
    });
    expect(row.lastSentAt).toBe(previousLastSentAt);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('returns zero counts without sending or bumping when no tokens exist', async () => {
    const { firebaseService, repo, row, service } = setup(
      {},
      {
        fcmAvailable: true,
        users: [
          { id: 1, fcmToken: null },
          { id: 2, fcmToken: '' },
          { id: 3, fcmToken: '   ' },
        ],
      },
    );

    const result = await service.sendNotificationById(1);

    expect(result).toEqual({
      sentTo: 0,
      failed: 0,
      fcmAvailable: true,
      tokens: 0,
    });
    expect(firebaseService.sendToMultiple).not.toHaveBeenCalled();
    expect(row.lastSentAt).toBeNull();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
