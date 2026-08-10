/**
 * Marketplace payment authorization snapshot helpers (Task 2.2).
 *
 * Money is PHP minor units (centavos) stored as decimal-string-compatible
 * bigint values. Snapshots freeze at `payment_authorized` and must not mutate.
 *
 * Full Pilot Credits / COD eligibility rules are Phase 3 — this module only
 * scaffolds storage + freeze semantics.
 */

import type { Order } from './entities/order.entity';
import {
  PaymentAuthorizationStatus,
  type OrderAuthorizationSnapshot,
} from './entities/order.entity';

export type { OrderAuthorizationSnapshot };

export type FreezeAuthorizationInput = {
  /** Print / goods price in minor units; defaults from order major totalPrice. */
  priceMinor?: string | number | null;
  /** Delivery fee minor; defaults from order deliveryFee / deliveryFeeMinor. */
  deliveryFeeMinor?: string | number | null;
  /** Platform commission at auth time (default 0 until matching settles). */
  commissionMinor?: string | number | null;
  /** Other fees rolled into the commercial total (default 0). */
  feesMinor?: string | number | null;
  /** Spec snapshot (category/options) frozen for production. */
  specs?: Record<string, unknown> | null;
  /** Artwork file version / metadata id frozen for production. */
  artworkVersion?: string | number | null;
  /** Promised delivery / completion date at authorization. */
  promisedDate?: Date | string | null;
  /** Override payment method recorded on the snapshot. */
  paymentMethod?: string | null;
  /** Clock override for tests. */
  frozenAt?: Date | string;
};

/** Convert major-unit pesos (number or decimal string) to minor-unit string. */
export function pesosToMinor(
  pesos: number | string | null | undefined,
): string {
  if (pesos == null || pesos === '') return '0';
  const amount = typeof pesos === 'number' ? pesos : Number(pesos);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`Invalid major-unit money amount: ${String(pesos)}`);
  }
  return String(Math.round(amount * 100));
}

/** Normalize a minor-unit value to a non-negative integer string. */
export function normalizeMinor(
  value: string | number | null | undefined,
  fieldName = 'amount',
): string {
  if (value == null || value === '') return '0';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    throw new Error(`Invalid ${fieldName} minor units: ${String(value)}`);
  }
  return String(n);
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error('Invalid promisedDate');
    }
    return value.toISOString();
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid promisedDate: ${value}`);
  }
  return d.toISOString();
}

/**
 * Resolve price/fee minor units from an order, preferring already-set minor
 * columns over legacy decimal majors.
 */
export function resolveOrderMoneyMinor(
  order: Pick<
    Order,
    'totalPrice' | 'deliveryFee' | 'finalTotalMinor' | 'deliveryFeeMinor'
  >,
): {
  priceMinor: string;
  deliveryFeeMinor: string;
  finalTotalMinor: string;
} {
  const deliveryFeeMinor =
    order.deliveryFeeMinor != null && order.deliveryFeeMinor !== ''
      ? normalizeMinor(order.deliveryFeeMinor, 'deliveryFeeMinor')
      : pesosToMinor(order.deliveryFee ?? 0);

  const priceFromTotal =
    order.finalTotalMinor != null && order.finalTotalMinor !== ''
      ? null
      : pesosToMinor(order.totalPrice ?? 0);

  // Prefer explicit final total minor when present; otherwise price + fee.
  let priceMinor: string;
  let finalTotalMinor: string;

  if (order.finalTotalMinor != null && order.finalTotalMinor !== '') {
    finalTotalMinor = normalizeMinor(order.finalTotalMinor, 'finalTotalMinor');
    // Back-derive print price = final − delivery when both known.
    const finalN = Number(finalTotalMinor);
    const feeN = Number(deliveryFeeMinor);
    priceMinor = String(Math.max(0, finalN - feeN));
  } else {
    priceMinor = priceFromTotal ?? '0';
    finalTotalMinor = String(Number(priceMinor) + Number(deliveryFeeMinor));
  }

  return { priceMinor, deliveryFeeMinor, finalTotalMinor };
}

/** Build a commercial authorization snapshot (pure; no mutation). */
export function buildAuthorizationSnapshot(
  order: Pick<
    Order,
    | 'totalPrice'
    | 'deliveryFee'
    | 'finalTotalMinor'
    | 'deliveryFeeMinor'
    | 'paymentMethod'
    | 'fileMetadataId'
    | 'estimatedCompletionAt'
    | 'category'
    | 'quantity'
  >,
  input: FreezeAuthorizationInput = {},
): OrderAuthorizationSnapshot {
  const resolved = resolveOrderMoneyMinor(order);

  const deliveryFeeMinor =
    input.deliveryFeeMinor != null
      ? normalizeMinor(input.deliveryFeeMinor, 'deliveryFeeMinor')
      : resolved.deliveryFeeMinor;

  const priceMinor =
    input.priceMinor != null
      ? normalizeMinor(input.priceMinor, 'priceMinor')
      : resolved.priceMinor;

  const feesMinor = normalizeMinor(input.feesMinor ?? 0, 'feesMinor');
  const commissionMinor = normalizeMinor(
    input.commissionMinor ?? 0,
    'commissionMinor',
  );

  const finalTotalMinor = String(
    Number(priceMinor) + Number(deliveryFeeMinor) + Number(feesMinor),
  );

  const frozenAt = toIsoOrNull(input.frozenAt ?? new Date())!;

  const promisedDate =
    input.promisedDate !== undefined
      ? toIsoOrNull(input.promisedDate)
      : toIsoOrNull(order.estimatedCompletionAt);

  const artworkVersion =
    input.artworkVersion !== undefined
      ? input.artworkVersion
      : (order.fileMetadataId ?? null);

  const specs =
    input.specs !== undefined
      ? input.specs
      : {
          category: order.category ?? null,
          quantity: order.quantity ?? null,
        };

  return {
    frozenAt,
    priceMinor,
    deliveryFeeMinor,
    feesMinor,
    commissionMinor,
    finalTotalMinor,
    paymentMethod:
      input.paymentMethod !== undefined
        ? input.paymentMethod
        : (order.paymentMethod ?? null),
    specs,
    artworkVersion: artworkVersion == null ? null : artworkVersion,
    promisedDate,
  };
}

/**
 * Apply freeze onto an order in memory.
 *
 * - First freeze: writes snapshot, minor totals, authorization status.
 * - Already frozen: returns order unchanged (immutable).
 */
export function freezeAuthorizationSnapshotOnOrder(
  order: Order,
  input: FreezeAuthorizationInput = {},
): Order {
  if (order.authorizationSnapshot != null) {
    return order;
  }

  const snapshot = buildAuthorizationSnapshot(order, input);
  order.authorizationSnapshot = snapshot as object;
  order.finalTotalMinor = snapshot.finalTotalMinor;
  order.deliveryFeeMinor = snapshot.deliveryFeeMinor;
  order.paymentAuthorizationStatus = PaymentAuthorizationStatus.AUTHORIZED;
  return order;
}

/** True when a commercial snapshot has been frozen on the order. */
export function isAuthorizationSnapshotFrozen(
  order: Pick<Order, 'authorizationSnapshot'>,
): boolean {
  return order.authorizationSnapshot != null;
}

/** Read frozen snapshot with typed shape (null if not frozen). */
export function getAuthorizationSnapshot(
  order: Pick<Order, 'authorizationSnapshot'>,
): OrderAuthorizationSnapshot | null {
  if (order.authorizationSnapshot == null) return null;
  return order.authorizationSnapshot as OrderAuthorizationSnapshot;
}
