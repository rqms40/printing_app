/** Shared Pickup QA checklist — must match server `pickup-qa-checklist.ts`. */
export interface PickupQaChecklistItem {
  key: string;
  label: string;
  whatToVerify: string;
  requiresSignature?: boolean;
}

export const PICKUP_QA_SIGN_OFF_KEY = "supplier_sign_off";

export const PICKUP_QA_CHECKLIST_ITEMS: PickupQaChecklistItem[] = [
  {
    key: "quantity_match",
    label: "Quantity match",
    whatToVerify: "Physical count matches the order ticket quantity",
  },
  {
    key: "specification_match",
    label: "Specification match",
    whatToVerify: "Item matches described size, color, material, and design",
  },
  {
    key: "visible_defects",
    label: "Visible defects",
    whatToVerify:
      "No tears, misprints, color shifts, cracks, or stains on inspection",
  },
  {
    key: "packaging_integrity",
    label: "Packaging integrity",
    whatToVerify:
      "Items are wrapped/boxed adequately for transport on a motorcycle",
  },
  {
    key: "documentation",
    label: "Documentation",
    whatToVerify:
      "Delivery receipt / invoice / order slip is included and matches order ID",
  },
  {
    key: PICKUP_QA_SIGN_OFF_KEY,
    label: "Digital sign-off",
    whatToVerify: "Draw your signature to confirm handoff / pickup quality check",
    requiresSignature: true,
  },
];

/** Checkbox keys only (boolean). Sign-off is stored separately. */
export type PickupQaChecklistState = Record<string, boolean>;

export function emptyPickupQaChecklist(): PickupQaChecklistState {
  return Object.fromEntries(
    PICKUP_QA_CHECKLIST_ITEMS.filter((i) => !i.requiresSignature).map(
      (item) => [item.key, false],
    ),
  );
}

export function allPickupQaChecksPassed(
  state: PickupQaChecklistState,
  signatureData?: string | null,
): boolean {
  const checksOk = PICKUP_QA_CHECKLIST_ITEMS.filter(
    (i) => !i.requiresSignature,
  ).every((item) => state[item.key] === true);
  const sigOk = Boolean(signatureData && signatureData.trim().length > 0);
  return checksOk && sigOk;
}

/** Payload shape accepted by the API (sign-off needs signatureData). */
export function pickupQaChecklistPayload(
  state: PickupQaChecklistState,
  signatureData: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const item of PICKUP_QA_CHECKLIST_ITEMS) {
    if (item.requiresSignature) {
      out[item.key] = {
        pass: true,
        signatureData,
      };
    } else {
      out[item.key] = state[item.key] === true;
    }
  }
  return out;
}
