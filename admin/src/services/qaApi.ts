import { apiClient } from '@/providers/api-client';
import type { OrderItem } from '@/types/order';
import { normalizeOrder, normalizeOrders } from '@/utils/api-normalizers';

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
  const [qaResponse, adminResponse] = await Promise.all([
    apiClient.get<QaQueueItem[]>('/ops/qa/queue'),
    apiClient.get('/admin/orders'),
  ]);
  const byId = new Map(normalizeOrders(adminResponse.data).map((order) => [order.id, order]));
  return qaResponse.data.map((row) => mergeAdminProjection(row, byId.get(String(row.id))));
}

export async function fetchQaWorkspace(
  orderId: number,
): Promise<QaWorkspaceDetail> {
  const [qaResponse, adminResponse] = await Promise.all([
    apiClient.get<QaWorkspaceDetail>(`/ops/qa/${orderId}`),
    apiClient.get(`/admin/orders/${orderId}`),
  ]);
  const adminOrder = normalizeOrder(adminResponse.data);
  return {
    ...qaResponse.data,
    order: mergeAdminProjection(qaResponse.data.order, adminOrder),
  };
}

function mergeAdminProjection<T extends QaRenderableOrder>(
  target: T,
  adminOrder: ReturnType<typeof normalizeOrder> | undefined,
): T & Pick<QaQueueItem, 'pricingStatus' | 'quotedTotalMinor' | 'items'> {
  if (!adminOrder) return target as T & Pick<QaQueueItem, 'pricingStatus' | 'quotedTotalMinor' | 'items'>;
  return {
    ...target,
    category: adminOrder.category,
    quantity: adminOrder.quantity,
    totalPrice: adminOrder.total_price,
    pricingStatus: adminOrder.pricing_status,
    quotedTotalMinor: adminOrder.quoted_total_minor,
    items: adminOrder.items?.map((item) => ({
      id: Number(item.id),
      category: item.category_slug ?? item.category,
      categoryName: item.category_name,
      groupName: item.group_name,
      quantity: item.quantity,
      totalPrice: item.total_price,
      specs: item.specs?.map((spec) => ({
        key: spec.key,
        label: spec.label,
        value: spec.value,
        displayValue: spec.display_value,
      })),
    })),
  };
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
