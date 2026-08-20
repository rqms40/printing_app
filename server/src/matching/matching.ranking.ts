import { SupplierProfile } from '../suppliers/entities/supplier-profile.entity';
import { SupplierCapability } from '../suppliers/entities/supplier-capability.entity';
import {
  SupplierVerification,
  SupplierVerificationStatus,
} from '../suppliers/entities/supplier-verification.entity';
import { SupplierAssignmentDecision } from './entities/supplier-assignment.entity';

/**
 * Matching score formula (Task 4.2 — simple weighted sum):
 *
 *   score = 0.35 * capabilityFit
 *         + 0.20 * zoneFit
 *         + 0.20 * capacityFit
 *         + 0.15 * qualityScore
 *         + 0.10 * acceptanceRate
 *
 * Hard filters (candidate excluded, not scored):
 * - inactive supplier profile
 * - verification.status !== verified
 * - no capability with productFamily matching order.category (case-insensitive)
 * - zone mismatch when both order zone and supplier serviceZones are non-empty
 * - capacity exhausted (openLoad >= maxCapacity when maxCapacity > 0)
 *
 * Component definitions:
 * - capabilityFit: 1.0 when a matching productFamily exists (else exclude)
 * - zoneFit: 1.0 when supplier.serviceZones is empty (covers all) OR intersects
 *   order zone tokens; 0 excludes when zones declared and none match
 * - capacityFit: maxCapacity === 0 → 1.0 (unlimited); else
 *   max(0, 1 - openLoad / maxCapacity)
 * - qualityScore: clamp(ratingAverage / 5, 0, 1)
 * - acceptanceRate: accepted / (accepted+declined+expired), or 0.5 if no history
 */
export const MATCHING_WEIGHTS = {
  capability: 0.35,
  zone: 0.2,
  capacity: 0.2,
  quality: 0.15,
  acceptance: 0.1,
} as const;

/** Default accept SLA (hours) when env MATCHING_ACCEPTANCE_SLA_HOURS unset. */
export const DEFAULT_ACCEPTANCE_SLA_HOURS = 24;

export type OrderMatchContext = {
  orderId: number;
  category: string;
  quantity: number;
  /** Zone tokens derived from delivery address (city, barangay, etc.). */
  zoneTokens: string[];
};

export type SupplierOpenLoad = {
  supplierId: number;
  /** Count of pending + accepted assignments (soft capacity reservation). */
  openLoad: number;
};

export type SupplierAcceptanceStats = {
  supplierId: number;
  accepted: number;
  declined: number;
  expired: number;
};

export type RankedSupplierCandidate = {
  supplierId: number;
  businessName: string;
  userId: number;
  score: number;
  rankPosition: number;
  rankingInputs: {
    formula: string;
    weights: typeof MATCHING_WEIGHTS;
    capabilityFit: number;
    zoneFit: number;
    capacityFit: number;
    qualityScore: number;
    acceptanceRate: number;
    matchedProductFamily: string;
    maxCapacity: number;
    openLoad: number;
    remainingCapacity: number | null;
    leadTimeDays: number;
    serviceZones: string[];
    ratingAverage: number;
    shopLatitude: number | null;
    shopLongitude: number | null;
    distanceMeters: number | null;
    acceptanceStats: {
      accepted: number;
      declined: number;
      expired: number;
    };
    zoneTokens: string[];
  };
  capability: {
    id: number;
    productFamily: string;
    maxCapacity: number;
    leadTimeDays: number;
  };
};

export type RankingExcludeReason =
  | 'inactive'
  | 'unverified'
  | 'no_capability'
  | 'zone_mismatch'
  | 'capacity_exhausted'
  | 'missing_pin';

export type MatchingPreference = 'quality' | 'price' | 'speed';

export type GeoPoint = { latitude: number; longitude: number };

export function resolveMatchingPreference(
  value: unknown,
): MatchingPreference {
  if (value === 'price' || value === 'speed' || value === 'quality') {
    return value;
  }
  return 'quality';
}

export function shopPinFromProfile(
  profile: Pick<SupplierProfile, 'latitude' | 'longitude'>,
): GeoPoint | null {
  const lat = Number(profile.latitude);
  const lng = Number(profile.longitude);
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180 ||
    (lat === 0 && lng === 0)
  ) {
    return null;
  }
  return { latitude: lat, longitude: lng };
}

export function haversineMeters(from: GeoPoint, to: GeoPoint): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(to.latitude - from.latitude);
  const dLng = toRad(to.longitude - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.latitude)) *
      Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Checkout distance fee in pesos: max(₱25, ₱15 × km). */
export function quoteDistanceFeePesos(distanceMeters: number): number {
  if (!Number.isFinite(distanceMeters) || distanceMeters < 0) return 25;
  const km = distanceMeters / 1000;
  return Math.max(25, Math.round(15 * km * 100) / 100);
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function findMatchingCapability(
  capabilities: SupplierCapability[] | undefined,
  category: string,
): SupplierCapability | null {
  if (!capabilities?.length) return null;
  const target = normalizeToken(category);
  if (!target) return null;
  return (
    capabilities.find((c) => normalizeToken(c.productFamily) === target) ?? null
  );
}

function zoneFitScore(
  serviceZones: string[] | undefined,
  orderZones: string[],
): number {
  const zones = (serviceZones ?? []).map(normalizeToken).filter(Boolean);
  // Empty service zones → supplier covers all pilot zones.
  if (zones.length === 0) return 1;

  const order = orderZones.map(normalizeToken).filter(Boolean);
  // Order has no zone info (pickup / missing address) → do not exclude;
  // partial credit for declared multi-zone suppliers.
  if (order.length === 0) return 0.75;

  const hits = order.filter((z) => zones.includes(z));
  if (hits.length === 0) return 0;
  return Math.min(1, hits.length / Math.max(order.length, 1));
}

function capacityFitScore(maxCapacity: number, openLoad: number): number {
  if (maxCapacity <= 0) return 1;
  if (openLoad >= maxCapacity) return 0;
  return Math.max(0, 1 - openLoad / maxCapacity);
}

function qualityScore(
  ratingAverage: number | string | null | undefined,
): number {
  const n = Number(ratingAverage ?? 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, Math.max(0, n / 5));
}

function acceptanceRateScore(
  stats: SupplierAcceptanceStats | undefined,
): number {
  if (!stats) return 0.5;
  const total = stats.accepted + stats.declined + stats.expired;
  if (total <= 0) return 0.5;
  return Math.min(1, Math.max(0, stats.accepted / total));
}

export function isVerificationVerified(
  verification: SupplierVerification | null | undefined,
): boolean {
  return verification?.status === SupplierVerificationStatus.VERIFIED;
}

/**
 * Pure ranking for unit tests. Returns sorted candidates (desc score, asc id).
 */
export function rankSupplierCandidates(
  order: OrderMatchContext,
  profiles: SupplierProfile[],
  openLoads: Map<number, number>,
  acceptanceStats: Map<number, SupplierAcceptanceStats>,
  options: { requireShopPin?: boolean } = {},
): {
  candidates: RankedSupplierCandidate[];
  excluded: Array<{ supplierId: number; reason: RankingExcludeReason }>;
} {
  const excluded: Array<{ supplierId: number; reason: RankingExcludeReason }> =
    [];
  const scored: RankedSupplierCandidate[] = [];

  for (const profile of profiles) {
    if (!profile.isActive) {
      excluded.push({ supplierId: profile.id, reason: 'inactive' });
      continue;
    }
    if (!isVerificationVerified(profile.verification)) {
      excluded.push({ supplierId: profile.id, reason: 'unverified' });
      continue;
    }

    const capability = findMatchingCapability(
      profile.capabilities,
      order.category,
    );
    if (!capability) {
      excluded.push({ supplierId: profile.id, reason: 'no_capability' });
      continue;
    }

    const zFit = zoneFitScore(profile.serviceZones, order.zoneTokens);
    if (zFit <= 0) {
      excluded.push({ supplierId: profile.id, reason: 'zone_mismatch' });
      continue;
    }

    const openLoad = openLoads.get(profile.id) ?? 0;
    const cFit = capacityFitScore(capability.maxCapacity, openLoad);
    if (cFit <= 0 && capability.maxCapacity > 0) {
      excluded.push({ supplierId: profile.id, reason: 'capacity_exhausted' });
      continue;
    }

    const capFit = 1; // hard filter already ensured family match
    const qScore = qualityScore(profile.ratingAverage);
    const stats = acceptanceStats.get(profile.id);
    const aRate = acceptanceRateScore(stats);

    const score =
      MATCHING_WEIGHTS.capability * capFit +
      MATCHING_WEIGHTS.zone * zFit +
      MATCHING_WEIGHTS.capacity * cFit +
      MATCHING_WEIGHTS.quality * qScore +
      MATCHING_WEIGHTS.acceptance * aRate;

    const remainingCapacity =
      capability.maxCapacity > 0
        ? Math.max(0, capability.maxCapacity - openLoad)
        : null;

    const pin = shopPinFromProfile(profile);
    if (options.requireShopPin && !pin) {
      excluded.push({ supplierId: profile.id, reason: 'missing_pin' });
      continue;
    }

    scored.push({
      supplierId: profile.id,
      businessName: profile.businessName,
      userId: profile.userId,
      score: Math.round(score * 10000) / 10000,
      rankPosition: 0,
      rankingInputs: {
        formula:
          '0.35*capability + 0.20*zone + 0.20*capacity + 0.15*quality + 0.10*acceptance',
        weights: MATCHING_WEIGHTS,
        capabilityFit: capFit,
        zoneFit: zFit,
        capacityFit: cFit,
        qualityScore: qScore,
        acceptanceRate: aRate,
        matchedProductFamily: capability.productFamily,
        maxCapacity: capability.maxCapacity,
        openLoad,
        remainingCapacity,
        leadTimeDays: capability.leadTimeDays,
        serviceZones: profile.serviceZones ?? [],
        ratingAverage: Number(profile.ratingAverage ?? 0),
        shopLatitude: pin?.latitude ?? null,
        shopLongitude: pin?.longitude ?? null,
        distanceMeters: null,
        acceptanceStats: {
          accepted: stats?.accepted ?? 0,
          declined: stats?.declined ?? 0,
          expired: stats?.expired ?? 0,
        },
        zoneTokens: order.zoneTokens,
      },
      capability: {
        id: capability.id,
        productFamily: capability.productFamily,
        maxCapacity: capability.maxCapacity,
        leadTimeDays: capability.leadTimeDays,
      },
    });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.supplierId - b.supplierId;
  });

  scored.forEach((c, i) => {
    c.rankPosition = i + 1;
  });

  return { candidates: scored, excluded };
}

export function sortByMatchingPreference(
  candidates: RankedSupplierCandidate[],
  preference: MatchingPreference,
  destination: GeoPoint | null,
): RankedSupplierCandidate[] {
  const withDistance = candidates.map((candidate) => {
    const pin =
      candidate.rankingInputs.shopLatitude != null &&
      candidate.rankingInputs.shopLongitude != null
        ? {
            latitude: candidate.rankingInputs.shopLatitude,
            longitude: candidate.rankingInputs.shopLongitude,
          }
        : null;
    const distanceMeters =
      destination && pin ? haversineMeters(pin, destination) : null;
    return {
      ...candidate,
      rankingInputs: {
        ...candidate.rankingInputs,
        distanceMeters,
      },
    };
  });

  const effective: MatchingPreference =
    preference === 'price' && destination == null ? 'quality' : preference;

  withDistance.sort((left, right) => {
    if (effective === 'price') {
      const l = left.rankingInputs.distanceMeters ?? Number.POSITIVE_INFINITY;
      const r = right.rankingInputs.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (l !== r) return l - r;
      return left.supplierId - right.supplierId;
    }
    if (effective === 'speed') {
      const lead =
        left.rankingInputs.leadTimeDays - right.rankingInputs.leadTimeDays;
      if (lead !== 0) return lead;
      const l = left.rankingInputs.distanceMeters ?? Number.POSITIVE_INFINITY;
      const r = right.rankingInputs.distanceMeters ?? Number.POSITIVE_INFINITY;
      if (l !== r) return l - r;
      return left.supplierId - right.supplierId;
    }
    const rating =
      right.rankingInputs.ratingAverage - left.rankingInputs.ratingAverage;
    if (rating !== 0) return rating;
    if (right.score !== left.score) return right.score - left.score;
    return left.supplierId - right.supplierId;
  });

  return withDistance.map((candidate, index) => ({
    ...candidate,
    rankPosition: index + 1,
  }));
}

/** Decisions that hold soft capacity. */
export const CAPACITY_HOLDING_DECISIONS: SupplierAssignmentDecision[] = [
  SupplierAssignmentDecision.PENDING,
  SupplierAssignmentDecision.ACCEPTED,
];
