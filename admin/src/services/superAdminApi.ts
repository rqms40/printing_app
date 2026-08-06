import { apiClient } from "@/providers/api-client";

export type SupplierVerificationStatus =
  | "pending"
  | "under_review"
  | "verified"
  | "rejected";

export type RiderVerificationStatus =
  | "pending"
  | "under_review"
  | "verified"
  | "rejected";

export type SupplierProfileRow = {
  id: number;
  userId: number;
  businessName: string;
  description?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  address?: string | null;
  logoFileId?: number | null;
  logoUrl?: string | null;
  attributes?: Record<string, string> | null;
  serviceZones?: string[];
  isActive: boolean;
  capabilities?: Array<{
    id: number;
    productFamily: string;
    materials?: string[];
    maxCapacity?: number;
    leadTimeDays?: number;
  }>;
  verification?: {
    status: SupplierVerificationStatus;
    payoutDetailsRef?: string | null;
    notes?: string | null;
    reviewedBy?: number | null;
    reviewedAt?: string | null;
  } | null;
};

export type RiderVerificationRow = {
  id: number;
  userId: number;
  fullName: string | null;
  email: string | null;
  vehicleType: string;
  plateNumber: string | null;
  isAvailable: boolean;
  verificationStatus: RiderVerificationStatus;
  verificationNotes: string | null;
  verificationReviewedBy: number | null;
  verificationReviewedAt: string | null;
  createdAt: string;
};

export type AuditEventRow = {
  id: number;
  actorId: number | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  orderId: number | null;
  fromState: string | null;
  toState: string | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PlatformHealth = {
  status: string;
  timestamp: string;
  database: string;
  counts: Record<string, number>;
};

export type GeoZoneRow = {
  id: number;
  name: string;
  code: string;
  polygon: { type: string; coordinates: number[][][] };
  baseDeliveryFeeMinor: string;
  isActive: boolean;
  sortOrder: number;
};

export type CommerceSettings = {
  id: number;
  defaultCommissionBps: number;
  defaultDeliveryFeeMinor: string;
  rejectOutsideZones: boolean;
};

export type CodCollectionRow = {
  id: number;
  orderId: number;
  status: string;
  amountMinor: string;
  collectedAt?: string | null;
  reconciledAt?: string | null;
  discrepancyReason?: string | null;
  order?: { orderId?: string; id?: number } | null;
};

export type PayoutRow = {
  id: number;
  supplierId: number;
  orderId: number;
  grossMinor: string;
  commissionMinor: string;
  netMinor: string;
  holdReason: string | null;
  settlementState: string;
  settlementReference: string | null;
  releasedAt: string | null;
  createdAt: string;
};

export async function loadSuppliers(): Promise<SupplierProfileRow[]> {
  const res = await apiClient.get("/suppliers");
  return res.data;
}

export async function setSupplierVerification(
  supplierId: number,
  body: {
    status: SupplierVerificationStatus;
    payoutDetailsRef?: string | null;
    notes?: string | null;
  },
) {
  const res = await apiClient.patch(
    `/suppliers/${supplierId}/verification`,
    body,
  );
  return res.data;
}

export async function loadRiderVerifications(): Promise<RiderVerificationRow[]> {
  const res = await apiClient.get("/super/riders/verification");
  return res.data;
}

export async function setRiderVerification(
  riderId: number,
  body: { status: RiderVerificationStatus; notes?: string | null },
) {
  const res = await apiClient.patch(`/super/riders/${riderId}/verification`, body);
  return res.data;
}

export async function updateUserRole(userId: number, role: string) {
  const res = await apiClient.patch(`/super/users/${userId}/role`, { role });
  return res.data;
}

export async function loadAudit(params: {
  page?: number;
  limit?: number;
  action?: string;
  entityType?: string;
}) {
  const res = await apiClient.get("/super/audit", { params });
  return res.data as {
    items: AuditEventRow[];
    total: number;
    page: number;
    limit: number;
    pageCount: number;
  };
}

export async function loadPlatformHealth(): Promise<PlatformHealth> {
  const res = await apiClient.get("/super/health");
  return res.data;
}

export async function loadGeoZones(): Promise<GeoZoneRow[]> {
  const res = await apiClient.get("/geo-zones");
  return res.data;
}

export async function updateGeoZone(
  id: number,
  body: Partial<GeoZoneRow> & { baseDeliveryFeeMinor?: number },
) {
  const res = await apiClient.patch(`/geo-zones/${id}`, body);
  return res.data;
}

export async function createGeoZone(body: {
  name: string;
  code: string;
  polygon: GeoZoneRow["polygon"];
  baseDeliveryFeeMinor?: number;
  isActive?: boolean;
}) {
  const res = await apiClient.post("/geo-zones", body);
  return res.data;
}

export async function loadCommerceSettings(): Promise<CommerceSettings> {
  const res = await apiClient.get("/geo-zones/commerce-settings");
  return res.data;
}

export async function updateCommerceSettings(
  body: Partial<CommerceSettings> & {
    defaultDeliveryFeeMinor?: number | string;
  },
) {
  const res = await apiClient.patch("/geo-zones/commerce-settings", body);
  return res.data;
}

export async function loadCodQueue(status = "collected"): Promise<CodCollectionRow[]> {
  const res = await apiClient.get("/payments/cod", { params: { status } });
  return res.data;
}

export async function reconcileCod(orderId: number, discrepancyReason?: string) {
  const res = await apiClient.post(`/payments/cod/${orderId}/reconcile`, {
    discrepancyReason,
  });
  return res.data;
}

export async function loadPayouts(settlementState?: string): Promise<PayoutRow[]> {
  const res = await apiClient.get("/payouts", {
    params: settlementState ? { settlementState } : undefined,
  });
  return res.data;
}

export async function approvePayout(
  payoutId: number,
  settlementReference?: string,
) {
  const res = await apiClient.post(`/payouts/${payoutId}/approve`, {
    settlementReference,
  });
  return res.data;
}

export function minorToPesos(minor: string | number | null | undefined): number {
  const n = Number(minor ?? 0);
  if (!Number.isFinite(n)) return 0;
  return n / 100;
}
