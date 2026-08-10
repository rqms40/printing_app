import { apiClient } from '@/providers/api-client';

export type IssueRow = {
  id: number;
  orderId: number;
  category: string;
  evidence: unknown[];
  deadline: string | null;
  status: string;
  payoutImpact: string;
  refundAmountMinor: string | null;
  adjustmentAmountMinor: string | null;
  openedByUserId: number;
  resolvedByUserId: number | null;
  resolutionNotes: string | null;
  withinWindow: boolean;
  openedAt: string;
  resolvedAt: string | null;
  order?: { orderId?: string; id?: number } | null;
  openedBy?: { fullName?: string | null; email?: string } | null;
};

export type ResolvePath =
  | 'reprint'
  | 'refund'
  | 'adjustment'
  | 'release'
  | 'reject';

export async function loadIssues(status?: string): Promise<IssueRow[]> {
  const res = await apiClient.get('/issues', {
    params: status ? { status } : undefined,
  });
  return res.data;
}

export async function resolveIssue(
  issueId: number,
  body: {
    path: ResolvePath;
    resolutionNotes?: string;
    refundAmountMinor?: string;
    adjustmentAmountMinor?: string;
  },
) {
  const res = await apiClient.post(`/issues/${issueId}/resolve`, body);
  return res.data as IssueRow;
}
