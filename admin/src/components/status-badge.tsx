import { Tag } from "antd";
import type { OrderStatus } from "@/types/enums";
import { statusLabel } from "@/utils/format";

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
  collected_by_customer: "green",
  issue_window_open: "lime",
  completed: "green",
  cancelled: "red",
  file_rejected: "red",
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Tag color={STATUS_COLORS[status]}>{statusLabel(status)}</Tag>;
}
