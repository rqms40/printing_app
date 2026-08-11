import { apiClient } from '@/providers/api-client';
import type { OrderItem } from '@/types/order';

export interface QaProjectedItem {
  id: number;
  category: string;
  categoryName?: string | null;
  groupName?: string | null;
  quantity: number;
  totalPrice: number | null;
  specs?: Array<{ key: string; label: string; value: string; displayValue: string }>;
}

export interface QaRenderableOrder {
  id: number;
  category: string;
  quantity: number;
  totalPrice: number | null;
  items?: QaProjectedItem[];
}

export function qaOrderItems(order: QaRenderableOrder): OrderItem[] {
  const source = order.items?.length ? order.items : [{
    id: order.id, category: order.category, quantity: order.quantity,
    totalPrice: order.totalPrice,
  }];
  return source.map((item) => ({
    id: String(item.id),
    category: item.category,
    category_name: item.categoryName ?? null,
    group_name: item.groupName ?? null,
    quantity: item.quantity,
    total_price: item.totalPrice,
    specs: item.specs?.map((spec) => ({
      key: spec.key, label: spec.label, value: spec.value,
      display_value: spec.displayValue,
    })) ?? [],
  }));
}

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
  totalPrice: number | null;
  pricingStatus?: 'pending_quote' | 'quoted' | 'accepted';
  quotedTotalMinor?: string | null;
  items?: QaProjectedItem[];
  unmetCoverage?: boolean;
  matchingOutcome?: { code: string; message?: string | null } | null;
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
    totalPrice: number | null;
    deliveryFee: number | null;
    pricingStatus?: 'pending_quote' | 'quoted' | 'accepted';
    quotedTotalMinor?: string | null;
    items?: QaProjectedItem[];
    unmetCoverage?: boolean;
    matchingOutcome?: { code: string; message?: string | null } | null;
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
  const response = await apiClient.get<QaQueueItem[]>('/ops/qa/queue');
  return response.data;
}

export async function fetchQaWorkspace(
  orderId: number,
): Promise<QaWorkspaceDetail> {
  const response = await apiClient.get<QaWorkspaceDetail>(`/ops/qa/${orderId}`);
  return response.data;
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
