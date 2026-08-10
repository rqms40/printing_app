import type { OrderStatus } from "@/types/enums";

/** Rider delivery process after Ready for Dispatch. */
export const DELIVERY_LOGISTICS_PIPELINE: OrderStatus[] = [
  "rider_assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
];

/**
 * Full marketplace + logistics progress steps for admin/ops order views.
 *
 * After Ready for Dispatch, always show the delivery logistics process:
 * Rider Assigned → Picked Up → Out for Delivery → Delivered.
 *
 * Do not replace logistics with "Collected by Customer" — store pickup still
 * ranks against Delivered for the current-step highlight.
 */
export function adminOrderProgressPipeline(options: {
  isPickup: boolean;
  includeOptional?: OrderStatus[];
}): OrderStatus[] {
  const optional = new Set(options.includeOptional ?? []);
  const steps: OrderStatus[] = ["submitted", "needs_qa"];

  if (optional.has("client_correction")) steps.push("client_correction");
  if (optional.has("proof_approval")) steps.push("proof_approval");

  steps.push(
    "approved_for_matching",
    "supplier_assigned",
    "supplier_accepted",
    "awaiting_payment",
    "payment_authorized",
    "production",
    "supplier_self_qc",
    "ready_for_dispatch",
    // Always the delivery process (never only collected_by_customer).
    ...DELIVERY_LOGISTICS_PIPELINE,
  );

  steps.push("issue_window_open", "completed");
  // options.isPickup retained for API symmetry; pipeline is delivery-first.
  void options.isPickup;
  return steps;
}

export function isPickupDeliveryOption(option?: string | null): boolean {
  const normalized = (option ?? "").trim().toLowerCase();
  return (
    normalized === "pickup" ||
    normalized === "self_pickup" ||
    normalized === "collect"
  );
}

/** Rank used to light completed vs future steps on the progress pipeline. */
const STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  draft: 0,
  submitted: 10,
  needs_qa: 20,
  client_correction: 25,
  proof_approval: 30,
  approved_for_matching: 40,
  supplier_assigned: 50,
  supplier_accepted: 60,
  awaiting_payment: 70,
  payment_authorized: 80,
  production: 90,
  supplier_self_qc: 100,
  ready_for_dispatch: 110,
  rider_assigned: 120,
  picked_up: 130,
  out_for_delivery: 140,
  delivered: 150,
  collected_by_customer: 150,
  issue_window_open: 160,
  completed: 170,
};

export function progressStepState(
  step: OrderStatus,
  current: OrderStatus,
  pipeline: OrderStatus[],
): "done" | "current" | "todo" {
  // Map store-pickup completion onto Delivered so logistics end lights up.
  const effective: OrderStatus =
    current === "collected_by_customer" ? "delivered" : current;

  const exact = pipeline.indexOf(effective);
  const stepIdx = pipeline.indexOf(step);
  if (exact >= 0) {
    if (stepIdx < exact) return "done";
    if (stepIdx === exact) return "current";
    return "todo";
  }
  const currentRank = STATUS_RANK[effective];
  const stepRank = STATUS_RANK[step];
  if (currentRank == null || stepRank == null) return "todo";
  if (stepRank < currentRank) return "done";
  if (stepRank === currentRank) return "current";
  return "todo";
}
