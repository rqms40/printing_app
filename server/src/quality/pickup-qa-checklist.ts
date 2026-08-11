/**
 * Shared Pickup QA Checklist (physical gate before handoff / pickup).
 * Source: product ops checklist — all lines must pass.
 * `supplier_sign_off` requires a drawn digital signature (not a plain checkbox).
 */
export type PickupQaActorRole = 'supplier' | 'rider';

export interface PickupQaChecklistItem {
  key: string;
  label: string;
  whatToVerify: string;
  /** When true, pass requires non-empty `signatureData` (drawn signature). */
  requiresSignature?: boolean;
}

export const PICKUP_QA_SIGN_OFF_KEY = 'supplier_sign_off';

/** Max UTF-8 bytes for stored signature JSON (drawn points). */
export const PICKUP_QA_SIGNATURE_MAX_BYTES = 65_536;

/** Canonical checklist lines — keep in sync with mobile/admin UIs. */
export const PICKUP_QA_CHECKLIST_ITEMS: readonly PickupQaChecklistItem[] = [
  {
    key: 'quantity_match',
    label: 'Quantity match',
    whatToVerify: 'Physical count matches the order ticket quantity',
  },
  {
    key: 'specification_match',
    label: 'Specification match',
    whatToVerify: 'Item matches described size, color, material, and design',
  },
  {
    key: 'visible_defects',
    label: 'Visible defects',
    whatToVerify:
      'No tears, misprints, color shifts, cracks, or stains on inspection',
  },
  {
    key: 'packaging_integrity',
    label: 'Packaging integrity',
    whatToVerify:
      'Items are wrapped/boxed adequately for transport on a motorcycle',
  },
  {
    key: 'documentation',
    label: 'Documentation',
    whatToVerify:
      'Delivery receipt / invoice / order slip is included and matches order ID',
  },
  {
    key: PICKUP_QA_SIGN_OFF_KEY,
    label: 'Digital sign-off',
    whatToVerify:
      'Draw your signature to confirm handoff / pickup quality check',
    requiresSignature: true,
  },
] as const;

export const PICKUP_QA_CHECKLIST_KEYS = PICKUP_QA_CHECKLIST_ITEMS.map(
  (item) => item.key,
);

export type PickupQaChecklistResults = Record<
  string,
  { pass: boolean; notes?: string; signatureData?: string }
>;

function extractSignatureData(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = (value as { signatureData?: unknown }).signatureData;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (Buffer.byteLength(trimmed, 'utf8') > PICKUP_QA_SIGNATURE_MAX_BYTES) {
    return null;
  }
  return trimmed;
}

/**
 * Normalize free-form client payloads into { key: { pass, signatureData? } }.
 * Sign-off cannot pass from a bare boolean — it needs signatureData.
 */
export function normalizePickupQaChecklist(
  raw: Record<string, unknown> | null | undefined,
): PickupQaChecklistResults {
  const out: PickupQaChecklistResults = {};
  if (!raw || typeof raw !== 'object') return out;

  for (const item of PICKUP_QA_CHECKLIST_ITEMS) {
    const key = item.key;
    const value = raw[key];

    if (item.requiresSignature) {
      const signatureData = extractSignatureData(value);
      out[key] = signatureData
        ? { pass: true, signatureData }
        : { pass: false };
      continue;
    }

    if (value === true || value === 'true' || value === 'pass' || value === 1) {
      out[key] = { pass: true };
      continue;
    }
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      'pass' in value
    ) {
      const pass = Boolean((value as { pass: unknown }).pass);
      const notes = (value as { notes?: unknown }).notes;
      out[key] = {
        pass,
        ...(typeof notes === 'string' && notes.trim()
          ? { notes: notes.trim().slice(0, 500) }
          : {}),
      };
      continue;
    }
    out[key] = { pass: false };
  }
  return out;
}

export function assertPickupQaChecklistPassed(
  raw: Record<string, unknown> | null | undefined,
): PickupQaChecklistResults {
  const results = normalizePickupQaChecklist(raw);
  const missing: string[] = [];
  const failed: string[] = [];

  for (const item of PICKUP_QA_CHECKLIST_ITEMS) {
    const entry = results[item.key];
    if (!entry) {
      missing.push(item.label);
      continue;
    }
    if (!entry.pass) {
      failed.push(
        item.requiresSignature
          ? `${item.label} (draw your signature)`
          : item.label,
      );
    }
  }

  if (missing.length > 0 || failed.length > 0) {
    const parts: string[] = [];
    if (missing.length) parts.push(`missing: ${missing.join(', ')}`);
    if (failed.length) parts.push(`failed: ${failed.join(', ')}`);
    throw new Error(
      `Pickup QA checklist incomplete — ${parts.join('; ')}. All checks must pass.`,
    );
  }
  return results;
}

export function allPickupQaChecksPassed(
  raw: Record<string, unknown> | null | undefined,
): boolean {
  try {
    assertPickupQaChecklistPassed(raw);
    return true;
  } catch {
    return false;
  }
}
