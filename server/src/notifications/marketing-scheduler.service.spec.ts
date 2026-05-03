import { MarketingSchedulerService } from './marketing-scheduler.service';
import { MarketingNotification } from './entities/marketing-notification.entity';

describe('MarketingSchedulerService', () => {
  const now = new Date('2026-05-02T12:00:00.000Z');

  function setup(notification: Partial<MarketingNotification>) {
    const row = {
      id: 1,
      header: 'Promo',
      body: 'Print today',
      description: 'Promo',
      frequency: '1d',
      isActive: true,
      lastSentAt: null,
      ...notification,
    } as MarketingNotification;
    const repo = {
      find: jest.fn().mockResolvedValue([row]),
      save: jest.fn().mockResolvedValue(row),
    };
    const firebaseService = {
      sendToMultiple: jest.fn().mockResolvedValue(undefined),
    };
    const usersService = {
      findAll: jest.fn().mockResolvedValue([{ id: 1, fcmToken: 'token-a' }]),
    };
    const service = new MarketingSchedulerService(
      repo as any,
      firebaseService as any,
      usersService as any,
    );

    return { firebaseService, repo, row, service };
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

  it('sends a weekly interval after enough days have elapsed', async () => {
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
    );
    expect(row.lastSentAt).toEqual(now);
    expect(repo.save).toHaveBeenCalledWith(row);
  });
});
