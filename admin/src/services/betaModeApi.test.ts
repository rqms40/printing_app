import { describe, it, expect, vi, beforeEach } from 'vitest';
import { apiClient } from '@/providers/api-client';
import {
  getSettings,
  updateSettings,
  getBetaUsers,
  enrollUser,
  unenrollUser,
} from './betaModeApi';

vi.mock('@/providers/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    patch: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('betaModeApi', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getSettings calls GET /beta-mode/settings', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { id: 1, isEnabled: true } });
    const result = await getSettings();
    expect(apiClient.get).toHaveBeenCalledWith('/beta-mode/settings');
    expect(result.isEnabled).toBe(true);
  });

  it('updateSettings calls PATCH /beta-mode/settings with body', async () => {
    vi.mocked(apiClient.patch).mockResolvedValue({ data: { id: 1, isEnabled: false } });
    const result = await updateSettings(false);
    expect(apiClient.patch).toHaveBeenCalledWith('/beta-mode/settings', { isEnabled: false });
    expect(result.isEnabled).toBe(false);
  });

  it('getBetaUsers calls GET /beta-mode/users', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: [] });
    const result = await getBetaUsers();
    expect(apiClient.get).toHaveBeenCalledWith('/beta-mode/users');
    expect(result).toEqual([]);
  });

  it('enrollUser calls POST /beta-mode/users/:id/enroll', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: null });
    await enrollUser(42);
    expect(apiClient.post).toHaveBeenCalledWith('/beta-mode/users/42/enroll');
  });

  it('unenrollUser calls DELETE /beta-mode/users/:id/enroll', async () => {
    vi.mocked(apiClient.delete).mockResolvedValue({ data: null });
    await unenrollUser(42);
    expect(apiClient.delete).toHaveBeenCalledWith('/beta-mode/users/42/enroll');
  });
});
