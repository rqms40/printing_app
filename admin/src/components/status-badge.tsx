import { Tag } from "antd";
import type { OrderStatus } from "@/types/enums";
import { statusLabel } from "@/utils/format";

/**
 * Semantic colors for marketplace order statuses.
 * Always paired with [statusLabel] text — never rely on color alone.
 */
const STATUS_COLORS: Record<OrderStatus, string> = {
  draft: "default",
  submitted: "blue",
  needs_qa: "blue",
  client_correction: "orange",
  proof_approval: "purple",
  approved_for_matching: "blue",
  supplier_assigned: "geekblue",
  supplier_accepted: "geekblue",
  awaiting_payment: "gold",
  payment_authorized: "gold",
  production: "orange",
  supplier_self_qc: "orange",
  ready_for_dispatch: "cyan",
  rider_assigned: "cyan",
  picked_up: "gold",
  out_for_delivery: "gold",
  delivered: "green",
  delivery_failed: "red",
  collected_by_customer: "green",
  issue_window_open: "lime",
  completed: "green",
  cancelled: "red",
  file_rejected: "red",
};

interface StatusBadgeProps {
  status: OrderStatus;
}

/** Order status chip: human label + optional color (label is required for a11y). */
export function StatusBadge({ status }: StatusBadgeProps) {
  const label = statusLabel(status);
  return (
    <Tag color={STATUS_COLORS[status] ?? "default"} title={label}>
      {label}
    </Tag>
  );
}
