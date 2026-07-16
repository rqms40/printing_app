import { FirebaseService } from './firebase.service';

describe('FirebaseService.sendToMultiple', () => {
  let service: FirebaseService;

  beforeEach(() => {
    service = new FirebaseService();
  });

  it('returns null when messaging is not initialized', async () => {
    await expect(
      service.sendToMultiple(['tok-1'], 'Title', 'Body'),
    ).resolves.toBeNull();
  });

  it('returns zero counts for an empty token list without calling FCM', async () => {
    const sendEachForMulticast = jest.fn();
    (service as unknown as { messaging: unknown }).messaging = {
      sendEachForMulticast,
    };

    await expect(service.sendToMultiple([], 'Title', 'Body')).resolves.toEqual({
      successCount: 0,
      failureCount: 0,
    });
    expect(sendEachForMulticast).not.toHaveBeenCalled();
  });

  it('maps the multicast batch response to counts', async () => {
    const sendEachForMulticast = jest
      .fn()
      .mockResolvedValue({ successCount: 2, failureCount: 1 });
    (service as unknown as { messaging: unknown }).messaging = {
      sendEachForMulticast,
    };

    await expect(
      service.sendToMultiple(['a', 'b', 'c'], 'Title', 'Body', {
        type: 'marketing',
      }),
    ).resolves.toEqual({ successCount: 2, failureCount: 1 });
    expect(sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['a', 'b', 'c'],
      notification: { title: 'Title', body: 'Body' },
      data: { type: 'marketing' },
    });
  });

  it('rethrows multicast errors so callers can report failure', async () => {
    (service as unknown as { messaging: unknown }).messaging = {
      sendEachForMulticast: jest.fn().mockRejectedValue(new Error('fcm down')),
    };

    await expect(
      service.sendToMultiple(['a'], 'Title', 'Body'),
    ).rejects.toThrow('fcm down');
  });
});
