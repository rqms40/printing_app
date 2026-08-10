import { apiClient } from '@/providers/api-client';

/** Job list filter matching GET /supplier/jobs?filter= */
export type SupplierJobListFilter =
  | 'assigned'
  | 'accepted'
  | 'in_production'
  | 'all';

export type SupplierAssignmentDecision =
  | 'pending'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'cancelled';

export type ProductionMilestone =
  | 'materials_setup'
  | 'in_production'
  | 'production_complete';

/** Actions returned by GET job detail `allowedActions`. */
export type SupplierJobAction =
  | 'accept'
  | 'decline'
  | 'production-status'
  | 'self-qc'
  | 'ready-for-pickup';

export interface SupplierJobListItem {
  id: number;
  orderId: number;
  orderPublicId: string;
  orderStatus: string;
  decision: SupplierAssignmentDecision;
  acceptanceDeadline: string;
  finalPriceMinor: string | null;
  promisedDate: string | null;
  category: string;
  quantity: number;
  rankPosition: number;
  decidedAt: string | null;
  createdAt: string;
  paymentAuthorizationStatus: string;
}

export interface SupplierJobSpecValue {
  key: string;
  label: string;
  value: string;
  displayValue: string;
  optionId: number | null;
  optionLabel: string | null;
}

export interface SupplierJobDetail {
  assignment: {
    id: number;
    orderId: number;
    supplierId: number;
    decision: SupplierAssignmentDecision;
    decisionReason: string | null;
    acceptanceDeadline: string;
    finalPriceMinor: string | null;
    promisedDate: string | null;
    rankPosition: number;
    decidedAt: string | null;
    createdAt: string;
  };
  order: {
    id: number;
    orderId: string;
    orderStatus: string;
    category: string;
    quantity: number;
    totalPrice: number;
    deliveryFee: number;
    finalTotalMinor: string | null;
    deliveryFeeMinor: string | null;
    paymentMethod: string;
    paymentAuthorizationStatus: string;
    pricingStatus?: 'pending_quote' | 'quoted' | 'accepted';
    deliveryOption: string;
    estimatedCompletionAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  artwork: {
    fileMetadataId: number | null;
    fileName: string | null;
    signedUrl: string | null;
  };
  specs: {
    category: string;
    quantity: number;
    items: Array<{
      id: number;
      category: string;
      categoryName: string | null;
      quantity: number;
      specialInstructions: string | null;
      fileName: string | null;
      fileMetadataId: number | null;
      specs: SupplierJobSpecValue[];
    }>;
  };
  allowedActions: SupplierJobAction[] | string[];
}

export interface SupplierJobActionResult {
  assignment: {
    id: number;
    decision: SupplierAssignmentDecision;
    finalPriceMinor: string | null;
    promisedDate: string | null;
    decisionReason: string | null;
    decidedAt: string | null;
  };
  order: {
    id: number;
    orderId: string;
    orderStatus: string;
    pricingStatus?: 'pending_quote' | 'quoted' | 'accepted';
  };
  fromStatus: string;
  toStatus: string;
  milestone?: string | null;
  evidenceFileIds?: number[];
}

export interface AcceptSupplierJobPayload {
  /** Final goods price in PHP minor units (centavos). */
  finalPriceMinor: number;
  /** ISO-8601 promised completion date. */
  promisedDate: string;
}

export interface DeclineSupplierJobPayload {
  reason: string;
}

export interface ProductionStatusPayload {
  milestone?: ProductionMilestone;
  status?: string;
  notes?: string;
}

export interface SelfQcPayload {
  evidenceFileIds?: number[];
  checklist?: Record<string, unknown>;
  notes?: string;
}

export async function fetchSupplierJobs(
  filter: SupplierJobListFilter = 'all',
): Promise<SupplierJobListItem[]> {
  const res = await apiClient.get<SupplierJobListItem[]>('/supplier/jobs', {
    params: { filter },
  });
  return res.data;
}

export async function fetchSupplierJob(
  jobId: number,
): Promise<SupplierJobDetail> {
  const res = await apiClient.get<SupplierJobDetail>(`/supplier/jobs/${jobId}`);
  return res.data;
}

export async function acceptSupplierJob(
  jobId: number,
  payload: AcceptSupplierJobPayload,
): Promise<SupplierJobActionResult> {
  const res = await apiClient.post<SupplierJobActionResult>(
    `/supplier/jobs/${jobId}/accept`,
    payload,
  );
  return res.data;
}

export async function declineSupplierJob(
  jobId: number,
  payload: DeclineSupplierJobPayload,
): Promise<SupplierJobActionResult> {
  const res = await apiClient.post<SupplierJobActionResult>(
    `/supplier/jobs/${jobId}/decline`,
    payload,
  );
  return res.data;
}

export async function updateSupplierProductionStatus(
  jobId: number,
  payload: ProductionStatusPayload,
): Promise<SupplierJobActionResult> {
  const res = await apiClient.post<SupplierJobActionResult>(
    `/supplier/jobs/${jobId}/production-status`,
    payload,
  );
  return res.data;
}

/**
 * Self-QC: JSON body and/or multipart file upload.
 * Prefer multipart when a local evidence file is selected.
 */
export async function submitSupplierSelfQc(
  jobId: number,
  payload: SelfQcPayload,
  file?: File | null,
): Promise<SupplierJobActionResult> {
  if (file) {
    const form = new FormData();
    form.append('file', file);
    if (payload.evidenceFileIds?.length) {
      form.append('evidenceFileIds', JSON.stringify(payload.evidenceFileIds));
    }
    if (payload.checklist) {
      form.append('checklist', JSON.stringify(payload.checklist));
    }
    if (payload.notes) {
      form.append('notes', payload.notes);
    }
    // Do not set Content-Type — browser must attach multipart boundary.
    const res = await apiClient.post<SupplierJobActionResult>(
      `/supplier/jobs/${jobId}/self-qc`,
      form,
    );
    return res.data;
  }

  const res = await apiClient.post<SupplierJobActionResult>(
    `/supplier/jobs/${jobId}/self-qc`,
    payload,
  );
  return res.data;
}

export async function markSupplierReadyForPickup(
  jobId: number,
): Promise<SupplierJobActionResult> {
  const res = await apiClient.post<SupplierJobActionResult>(
    `/supplier/jobs/${jobId}/ready-for-pickup`,
  );
  return res.data;
}

/** PHP minor units (centavos) → display pesos string. */
export function formatMinorAsCurrency(
  minor: string | number | null | undefined,
): string {
  if (minor == null || minor === '') return '—';
  let value: bigint;
  try {
    value = BigInt(String(minor));
  } catch {
    return '—';
  }
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const pesos = (absolute / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const cents = (absolute % 100n).toString().padStart(2, '0');
  return `${negative ? '-' : ''}₱${pesos}.${cents}`;
}

/** Pesos amount → integer minor units (centavos). */
export function pesosToMinor(pesos: number): number {
  return Math.round(pesos * 100);
}

export function buildSupplierQuotePayload(
  pricePesos: number | null,
  promisedDate: string | null,
): AcceptSupplierJobPayload {
  if (pricePesos == null || !Number.isFinite(pricePesos) || pricePesos <= 0) {
    throw new Error('Final price is required');
  }
  if (!promisedDate) throw new Error('Promised date is required');
  return { finalPriceMinor: pesosToMinor(pricePesos), promisedDate };
}

export function canOperateProduction(
  allowedActions: readonly string[],
  paymentAuthorizationStatus: string,
): boolean {
  return allowedActions.includes('production-status') &&
    paymentAuthorizationStatus.toLowerCase() === 'authorized';
}

/** Axios / Nest error message extraction. */
export function extractApiError(err: unknown): string {
  const axiosErr = err as {
    response?: { data?: { message?: string | string[]; code?: string } };
    message?: string;
  };
  const raw = axiosErr.response?.data?.message ?? axiosErr.message;
  if (Array.isArray(raw)) return raw.join(', ');
  return raw || 'Request failed';
}
