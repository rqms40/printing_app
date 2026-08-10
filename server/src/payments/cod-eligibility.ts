/**
 * COD eligibility rules (PRD §7.6 / decisions §4 / Task 3.2).
 *
 * Pure evaluation — no I/O. Service layer supplies active-order counts and
 * user/address flags, then applies this result to checkout and collection.
 *
 * Cap: finalTotalMinor <= 150000 (₱1,500 including delivery fee).
 * Concurrency: one active unpaid COD order per client.
 * Client: pilotCodEligible; ops risk not blocked; address/zone stub.
 */

/** PHP minor units — ₱1,500.00 */
export const COD_MAX_AMOUNT_MINOR = 150_000;

/** Structured reason codes returned to clients/ops. */
export enum CodIneligibilityReason {
  CLIENT_NOT_VERIFIED = 'client_not_cod_verified',
  AMOUNT_EXCEEDS_CAP = 'amount_exceeds_cap',
  ACTIVE_UNPAID_COD = 'active_unpaid_cod_exists',
  ADDRESS_ZONE_INELIGIBLE = 'address_zone_ineligible',
  OPS_RISK_BLOCKED = 'ops_risk_blocked',
  INVALID_AMOUNT = 'invalid_amount',
}

export const COD_PAYOUT_HOLD_REASON = 'missing_cod_reconciliation';

export type CodEligibilityInput = {
  /** User verified for pilot COD (users.pilot_cod_eligible). */
  pilotCodEligible: boolean;
  /** Ops risk flag (users.cod_ops_risk_blocked). */
  opsRiskBlocked?: boolean;
  /**
   * Final commercial total in PHP minor units (centavos), including delivery.
   * Accepts string (pg bigint) or number.
   */
  finalTotalMinor: string | number | null | undefined;
  /**
   * Count of other active unpaid COD orders for this client
   * (exclude the order currently being evaluated).
   */
  activeUnpaidCodCount: number;
  /**
   * Address/zone eligibility stub. Default true until zones land.
   * When false, COD is rejected with ADDRESS_ZONE_INELIGIBLE.
   */
  addressZoneEligible?: boolean;
};

export type CodEligibilityResult = {
  eligible: boolean;
  reasons: CodIneligibilityReason[];
  /** Human-readable summary (first reason or success message). */
  message: string;
  amountMinor: string | null;
  maxAmountMinor: number;
};

const REASON_MESSAGES: Record<CodIneligibilityReason, string> = {
  [CodIneligibilityReason.CLIENT_NOT_VERIFIED]:
    'Client is not verified for pilot COD.',
  [CodIneligibilityReason.AMOUNT_EXCEEDS_CAP]:
    'COD is limited to ₱1,500.00 final total (including delivery).',
  [CodIneligibilityReason.ACTIVE_UNPAID_COD]:
    'Client already has an active unpaid COD order.',
  [CodIneligibilityReason.ADDRESS_ZONE_INELIGIBLE]:
    'Delivery address/zone is not eligible for COD.',
  [CodIneligibilityReason.OPS_RISK_BLOCKED]:
    'COD is blocked for this client by operations risk policy.',
  [CodIneligibilityReason.INVALID_AMOUNT]:
    'Order final total is missing or invalid for COD.',
};

/** Normalize payment method labels to detect COD rails. */
export function isCodPaymentMethod(paymentMethod?: string | null): boolean {
  if (!paymentMethod) return false;
  const normalized = paymentMethod.replace(/[_-]/g, '').toLowerCase();
  return (
    normalized === 'cod' ||
    normalized === 'cash' ||
    normalized === 'cashondelivery'
  );
}

/** Parse minor-unit amount; returns null if missing/invalid. */
export function parseMinorAmount(
  value: string | number | null | undefined,
): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
    return null;
  }
  return n;
}

/**
 * Evaluate COD eligibility (pure).
 * Rejects ₱1,501 (150100) and any amount above the cap even if the client
 * forced `paymentMethod: cod`.
 */
export function evaluateCodEligibility(
  input: CodEligibilityInput,
): CodEligibilityResult {
  const reasons: CodIneligibilityReason[] = [];
  const amount = parseMinorAmount(input.finalTotalMinor);

  if (!input.pilotCodEligible) {
    reasons.push(CodIneligibilityReason.CLIENT_NOT_VERIFIED);
  }

  if (input.opsRiskBlocked === true) {
    reasons.push(CodIneligibilityReason.OPS_RISK_BLOCKED);
  }

  if (amount == null) {
    reasons.push(CodIneligibilityReason.INVALID_AMOUNT);
  } else if (amount > COD_MAX_AMOUNT_MINOR) {
    reasons.push(CodIneligibilityReason.AMOUNT_EXCEEDS_CAP);
  }

  if (input.activeUnpaidCodCount > 0) {
    reasons.push(CodIneligibilityReason.ACTIVE_UNPAID_COD);
  }

  // Zone stub: default allow when undefined
  if (input.addressZoneEligible === false) {
    reasons.push(CodIneligibilityReason.ADDRESS_ZONE_INELIGIBLE);
  }

  const eligible = reasons.length === 0;
  const message = eligible ? 'COD eligible' : REASON_MESSAGES[reasons[0]];

  return {
    eligible,
    reasons,
    message,
    amountMinor: amount != null ? String(amount) : null,
    maxAmountMinor: COD_MAX_AMOUNT_MINOR,
  };
}
