import { apiClient } from '@/providers/api-client';

export type QaDecision =
  | 'needs_correction'
  | 'proof_required'
  | 'proof_approval'
  | 'approved_for_matching'
  | 'blocked';

export type QaRiskLevel = 'low' | 'medium' | 'high';

export interface QaQueueItem {
  id: number;
  orderId: string;
  orderStatus: string;
  category: string;
  quantity: number;
  totalPrice: number;
  fileName: string | null;
  fileMetadataId: number | null;
  userId: number;
  userEmail: string | null;
  userFullName: string | null;
  createdAt: string;
  updatedAt: string;
  latestReview: {
    id: number;
    decision: string;
    riskLevel: string;
    createdAt: string;
  } | null;
}

export interface QaWorkspaceDetail {
  order: {
    id: number;
    orderId: string;
    orderStatus: string;
    category: string;
    quantity: number;
    totalPrice: number;
    deliveryFee: number;
    paymentMethod: string;
    deliveryOption: string;
    fileName: string | null;
    fileUrl: string | null;
    fileMetadataId: number | null;
    adminNotes: string | null;
    declineReason: string | null;
    createdAt: string;
    updatedAt: string;
    user: {
      id: number;
      email: string | null;
      fullName: string | null;
    } | null;
  };
  artwork: {
    fileMetadataId: number | null;
    fileName: string | null;
    signedUrl: string | null;
  };
  checklistKeys: string[];
  reviews: Array<{
    id: number;
    decision: string;
    riskLevel: string;
    checklistResults: Record<string, unknown>;
    correctionRequest: string | null;
    proofRequired: boolean;
    evidence: Record<string, unknown> | null;
    reviewerId: number;
    createdAt: string;
  }>;
  allowedDecisions: QaDecision[];
}

export interface QaDecisionPayload {
  decision: QaDecision;
  checklist: Record<string, boolean | string>;
  riskLevel: QaRiskLevel;
  correctionRequest?: string;
  proofRequired?: boolean;
}

export interface QaDecisionResult {
  review: {
    id: number;
    decision: string;
    riskLevel: string;
    proofRequired: boolean;
  };
  order: {
    id: number;
    orderId: string;
    orderStatus: string;
  };
  fromStatus: string;
  toStatus: string;
  autoPromotedFromSubmitted: boolean;
}

export async function fetchQaQueue(): Promise<QaQueueItem[]> {
  const res = await apiClient.get<QaQueueItem[]>('/ops/qa/queue');
  return res.data;
}

export async function fetchQaWorkspace(
  orderId: number,
): Promise<QaWorkspaceDetail> {
  const res = await apiClient.get<QaWorkspaceDetail>(`/ops/qa/${orderId}`);
  return res.data;
}

export async function submitQaDecision(
  orderId: number,
  payload: QaDecisionPayload,
): Promise<QaDecisionResult> {
  const res = await apiClient.post<QaDecisionResult>(
    `/ops/qa/${orderId}/decision`,
    payload,
  );
  return res.data;
}
