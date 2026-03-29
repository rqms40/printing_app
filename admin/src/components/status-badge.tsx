import { Tag } from "antd";
import type { OrderStatus } from "@/types/enums";
import { statusLabel } from "@/utils/format";

const STATUS_COLORS: Record<OrderStatus, string> = {
  order_placed: "blue",
  file_verified: "blue",
  file_declined: "red",
  printing_in_progress: "orange",
  finishing_mounting: "orange",
  quality_checked: "orange",
  ready_for_dispatch: "cyan",
  driver_assigned: "cyan",
  picked_up: "gold",
  on_the_way: "gold",
  arrived_at_destination: "gold",
  delivered: "green",
  completed_pickup: "green",
  cancelled: "red",
};

interface StatusBadgeProps {
  status: OrderStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return <Tag color={STATUS_COLORS[status]}>{statusLabel(status)}</Tag>;
}
