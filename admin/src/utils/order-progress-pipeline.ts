import type { OrderStatus } from "@/types/enums";

/** Rider delivery process after Ready for Dispatch. */
export const DELIVERY_LOGISTICS_PIPELINE: OrderStatus[] = [
  "rider_assigned",
  "picked_up",
  "out_for_delivery",
  "delivered",
];

/** Supplier production sub-milestones (audited while order is `production`). */
export const PRODUCTION_MILESTONE_KEYS = [
  "materials_setup",
  "in_production",
  "production_complete",
] as const;

export type ProductionMilestoneKey = (typeof PRODUCTION_MILESTONE_KEYS)[number];

export type ProgressStepKey = OrderStatus | ProductionMilestoneKey;

export const PRODUCTION_MILESTONE_LABELS: Record<
  ProductionMilestoneKey,
  string
> = {
  materials_setup: "Materials setup",
  in_production: "In production",
  production_complete: "Production complete",
};

export function isProductionMilestoneKey(
  step: ProgressStepKey,
): step is ProductionMilestoneKey {
  return (PRODUCTION_MILESTONE_KEYS as readonly string[]).includes(step);
}

/**
 * Full marketplace + production + logistics progress steps for admin/ops.
 *
 * Production is expanded into the PRD §7.8 milestones so ops can track
 * materials setup → in production → production complete before Self-QC.
 */
export function adminOrderProgressPipeline(options: {
  isPickup: boolean;
  includeOptional?: OrderStatus[];
}): ProgressStepKey[] {
  const optional = new Set(options.includeOptional ?? []);
  const steps: ProgressStepKey[] = ["submitted", "needs_qa"];

  if (optional.has("client_correction")) steps.push("client_correction");
  if (optional.has("proof_approval")) steps.push("proof_approval");

  steps.push(
    "approved_for_matching",
    "supplier_assigned",
    "supplier_accepted",
    "awaiting_payment",
    "payment_authorized",
    // Production milestones (replaces the single coarse `production` blob).
    ...PRODUCTION_MILESTONE_KEYS,
    "supplier_self_qc",
    "ready_for_dispatch",
    ...DELIVERY_LOGISTICS_PIPELINE,
  );

  steps.push("issue_window_open", "completed");
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

const MILESTONE_ORDER: ProductionMilestoneKey[] = [
  "materials_setup",
  "in_production",
  "production_complete",
];

export type ProductionMilestoneRecord = {
  milestone: string;
  reached_at?: string | null;
  notes?: string | null;
};

function normalizeMilestoneKey(
  raw: string | null | undefined,
): ProductionMilestoneKey | null {
  const key = (raw ?? "").trim().toLowerCase();
  if ((PRODUCTION_MILESTONE_KEYS as readonly string[]).includes(key)) {
    return key as ProductionMilestoneKey;
  }
  // Aliases suppliers may send.
  if (key === "production" || key === "in-production") return "in_production";
  if (key === "materials" || key === "setup") return "materials_setup";
  if (key === "complete" || key === "completed") return "production_complete";
  return null;
}

function highestReachedMilestoneIndex(
  reached: Iterable<string>,
): number {
  let best = -1;
  for (const raw of reached) {
    const key = normalizeMilestoneKey(raw);
    if (!key) continue;
    const idx = MILESTONE_ORDER.indexOf(key);
    if (idx > best) best = idx;
  }
  return best;
}

/**
 * Resolve step state for admin progress, including production sub-milestones.
 */
export function progressStepState(
  step: ProgressStepKey,
  current: OrderStatus,
  pipeline: ProgressStepKey[],
  productionMilestones: ProductionMilestoneRecord[] = [],
): "done" | "current" | "todo" {
  const effective: OrderStatus =
    current === "collected_by_customer" ? "delivered" : current;

  const currentRank = STATUS_RANK[effective];
  const reachedKeys = productionMilestones.map((m) => m.milestone);
  const highestMilestoneIdx = highestReachedMilestoneIndex(reachedKeys);

  // Past production entirely → all production milestones done.
  if (isProductionMilestoneKey(step)) {
    if (currentRank != null && currentRank >= 100) return "done";
    if (currentRank != null && currentRank < 90) return "todo";

    // In production band (or payment_authorized with early milestone audit).
    const stepIdx = MILESTONE_ORDER.indexOf(step);
    if (stepIdx < 0) return "todo";

    // If no milestone audits yet but order is already `production`, treat
    // first milestone as current (supplier entered production).
    if (highestMilestoneIdx < 0) {
      if (effective === "production") {
        return stepIdx === 0 ? "current" : "todo";
      }
      return "todo";
    }

    if (stepIdx < highestMilestoneIdx) return "done";
    if (stepIdx === highestMilestoneIdx) return "current";
    // If production_complete was reached, mark it done and move focus forward
    // (self-qc becomes current via status rank).
    if (
      highestMilestoneIdx === MILESTONE_ORDER.length - 1 &&
      stepIdx === highestMilestoneIdx
    ) {
      return effective === "production" ? "current" : "done";
    }
    return "todo";
  }

  // Prefer exact pipeline position when the status itself is a pipeline step.
  const stepIdx = pipeline.indexOf(step);
  if (pipeline.includes(effective) && stepIdx >= 0) {
    const currentIdx = pipeline.indexOf(effective);
    if (stepIdx < currentIdx) return "done";
    if (stepIdx === currentIdx) return "current";
    return "todo";
  }

  // When current is `production`, treat production milestones as the current
  // band: statuses before payment_authorized are done; self_qc+ are todo.
  if (effective === "production") {
    const stepRank = STATUS_RANK[step as OrderStatus];
    if (stepRank == null) return "todo";
    if (stepRank <= 80) return "done"; // through payment_authorized
    if (stepRank >= 100) return "todo";
    return "todo";
  }

  if (currentRank == null) return "todo";
  const stepRank = STATUS_RANK[step as OrderStatus];
  if (stepRank == null) return "todo";
  if (stepRank < currentRank) return "done";
  if (stepRank === currentRank) return "current";
  return "todo";
}

export function progressStepLabel(step: ProgressStepKey): string {
  if (isProductionMilestoneKey(step)) {
    return PRODUCTION_MILESTONE_LABELS[step];
  }
  return step;
}
