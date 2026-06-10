import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OpenRouterService } from './openrouter.service';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('OpenRouterService', () => {
  let service: OpenRouterService;

  const mockConfig = {
    get: (key: string, def?: string) => {
      const values: Record<string, string> = {
        OPENROUTER_API_KEY: 'test-key',
        OPENROUTER_MODEL: 'nvidia/nemotron-3-nano-30b-a3b:free',
        OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
      };
      return values[key] ?? def;
    },
    getOrThrow: (key: string) => {
      const values: Record<string, string> = {
        OPENROUTER_API_KEY: 'test-key',
        OPENROUTER_MODEL: 'nvidia/nemotron-3-nano-30b-a3b:free',
      };
      if (!(key in values)) throw new Error(`Missing: ${key}`);
      return values[key];
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        OpenRouterService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    service = module.get(OpenRouterService);
    jest.clearAllMocks();
  });

  it('returns bot reply on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Hello from GridBot!' } }],
      }),
    });

    const result = await service.complete([{ role: 'user', content: 'Hi' }]);
    expect(result).toBe('Hello from GridBot!');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://openrouter.ai/api/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key' }),
      }),
    );
  });

  it('returns fallback message when fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await service.complete([{ role: 'user', content: 'Hi' }]);
    expect(result).toContain('having trouble');
  });

  it('returns fallback message on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 });
    const result = await service.complete([{ role: 'user', content: 'Hi' }]);
    expect(result).toContain('having trouble');
  });

  it('uses fallback model when configured and primary fails', async () => {
    const configWithFallback = {
      ...mockConfig,
      get: (key: string, def?: string) => {
        if (key === 'OPENROUTER_FALLBACK_MODEL') return 'openai/gpt-3.5-turbo';
        return mockConfig.get(key, def);
      },
    };
    const module2 = await Test.createTestingModule({
      providers: [
        OpenRouterService,
        { provide: ConfigService, useValue: configWithFallback },
      ],
    }).compile();
    const svc2 = module2.get(OpenRouterService);

    mockFetch
      .mockRejectedValueOnce(new Error('primary fail'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'fallback reply' } }],
        }),
      });

    const result = await svc2.complete([{ role: 'user', content: 'Hi' }]);
    expect(result).toBe('fallback reply');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('returns fallback message when request times out', async () => {
    jest.useFakeTimers();
    let aborted = false;
    mockFetch.mockImplementation(
      (_url: string, opts: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () => {
              aborted = true;
              reject(
                new DOMException('The operation was aborted.', 'AbortError'),
              );
            });
          }
          jest.advanceTimersByTime(11_000);
        }),
    );
    const result = await service.complete([{ role: 'user', content: 'Hi' }]);
    jest.useRealTimers();
    expect(aborted).toBe(true);
    expect(result).toContain('having trouble');
  });
});
