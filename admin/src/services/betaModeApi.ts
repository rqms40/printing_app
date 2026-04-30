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

export interface BetaMemberRow {
  id: number;
  email: string;
  fullName: string | null;
  betaEnrolledAt: string | null;
  betaCreditsGranted: boolean;
  isBetaSurveyExempt: boolean;
  pendingSurveyCount: number;
}

export interface BetaMembersPage {
  rows: BetaMemberRow[];
  total: number;
  page: number;
  limit: number;
}

export async function searchBetaMembers(opts: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<BetaMembersPage> {
  const params = new URLSearchParams();
  if (opts.search) params.set('search', opts.search);
  if (opts.page) params.set('page', String(opts.page));
  if (opts.limit) params.set('limit', String(opts.limit));
  const res = await apiClient.get(
    `/beta-mode/members${params.toString() ? '?' + params.toString() : ''}`,
  );
  return res.data as BetaMembersPage;
}

export async function setBetaSurveyExempt(
  userId: number,
  exempt: boolean,
): Promise<{ id: number; isBetaSurveyExempt: boolean }> {
  const res = await apiClient.patch(
    `/beta-mode/users/${userId}/survey-exempt`,
    { exempt },
  );
  return res.data as { id: number; isBetaSurveyExempt: boolean };
}

export async function resetOrderLimit(
  userId: number,
): Promise<{ id: number; betaEnrolledAt: string }> {
  const res = await apiClient.post(
    `/beta-mode/users/${userId}/reset-order-limit`,
  );
  return res.data as { id: number; betaEnrolledAt: string };
}
