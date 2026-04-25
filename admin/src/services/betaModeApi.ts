import { apiClient } from '@/providers/api-client';

export interface BetaModeSettings {
  id: number;
  isEnabled: boolean;
}

export interface BetaUserItem {
  rank: number;
  id: number;
  email: string;
  fullName: string | null;
  betaEnrolledAt: string;
  betaCreditsGranted: boolean;
}

export async function getSettings(): Promise<BetaModeSettings> {
  const res = await apiClient.get('/beta-mode/settings');
  return res.data as BetaModeSettings;
}

export async function updateSettings(isEnabled: boolean): Promise<BetaModeSettings> {
  const res = await apiClient.patch('/beta-mode/settings', { isEnabled });
  return res.data as BetaModeSettings;
}

export async function getBetaUsers(): Promise<BetaUserItem[]> {
  const res = await apiClient.get('/beta-mode/users');
  return res.data as BetaUserItem[];
}

export async function enrollUser(userId: number): Promise<void> {
  await apiClient.post(`/beta-mode/users/${userId}/enroll`);
}

export async function unenrollUser(userId: number): Promise<void> {
  await apiClient.delete(`/beta-mode/users/${userId}/enroll`);
}
