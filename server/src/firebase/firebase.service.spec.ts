import { FirebaseService } from './firebase.service';

describe('FirebaseService.sendToDevice', () => {
  let service: FirebaseService;

  beforeEach(() => {
    service = new FirebaseService();
  });

  it('sends data-only messages with title and body in the data map', async () => {
    const send = jest.fn().mockResolvedValue('message-id');
    (service as unknown as { messaging: unknown }).messaging = { send };

    await expect(
      service.sendToDevice(
        'token-a',
        'Printing Started',
        'Your order is being printed.',
        {
          orderId: '42',
          type: 'delivery_status',
        },
        { dataOnly: true },
      ),
    ).resolves.toBe('message-id');

    expect(send).toHaveBeenCalledWith({
      token: 'token-a',
      data: {
        orderId: '42',
        type: 'delivery_status',
        title: 'Printing Started',
        body: 'Your order is being printed.',
      },
      android: { priority: 'high' },
    });
    expect(send.mock.calls[0][0]).not.toHaveProperty('notification');
  });
});

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

  it('places an image URL in Android notification config and string data', async () => {
    const sendEachForMulticast = jest
      .fn()
      .mockResolvedValue({ successCount: 1, failureCount: 0 });
    (service as unknown as { messaging: unknown }).messaging = {
      sendEachForMulticast,
    };

    await service.sendToMultiple(
      ['token-a'],
      'Fresh offer',
      'Print today',
      { type: 'marketing' },
      'https://cdn.example.com/promo.jpg',
    );

    expect(sendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['token-a'],
      notification: { title: 'Fresh offer', body: 'Print today' },
      data: {
        type: 'marketing',
        imageUrl: 'https://cdn.example.com/promo.jpg',
      },
      android: {
        notification: {
          imageUrl: 'https://cdn.example.com/promo.jpg',
        },
      },
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
