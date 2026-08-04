export type UserRole =
  | "client"
  | "supplier"
  | "rider"
  | "ops_admin"
  | "super_admin"
  /** @deprecated legacy — accept until clients fully cut over */
  | "customer"
  | "admin";

/** Ops Admin + Super Admin (and legacy `admin`) may use the admin panel. */
export function isAdminCapableRole(role: string | null | undefined): boolean {
  return (
    role === "ops_admin" ||
    role === "super_admin" ||
    role === "admin"
  );
}

export type OrderStatus =
  | "order_placed"
  | "file_verified"
  | "file_declined"
  | "printing_in_progress"
  | "finishing_mounting"
  | "quality_checked"
  | "ready_for_dispatch"
  | "rider_assigned"
  | "picked_up"
  | "on_the_way"
  | "arrived_at_destination"
  | "delivered"
  | "completed_pickup"
  | "cancelled";

export type DeliveryStatus =
  | "assigned"
  | "accepted"
  | "declined"
  | "picked_up"
  | "on_the_way"
  | "arrived"
  | "delivered";

export type PaymentMethod = "gcash" | "maya" | "cod" | "grid_credits";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type VehicleType = "motorcycle" | "bicycle" | "car";

export type PaperSize =
  | "a1" | "a2" | "a3" | "a4" | "a5"
  | "twenty_by_thirty" | "custom";
export type ColorMode = "black_and_white" | "full_color";
export type MediaType = "glossy" | "matte";
export type PrintSides = "front_only" | "back_to_back";
export type Binding = "none" | "spiral" | "staple" | "premium";
export type Material3D = "pla" | "abs" | "petg";
export type FileFormat3D = "stl" | "obj" | "three_mf" | "glb" | "gltf";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  order_placed: "Order Placed",
  file_verified: "File Verified",
  file_declined: "File Declined",
  printing_in_progress: "Printing",
  finishing_mounting: "Finishing",
  quality_checked: "Quality Checked",
  ready_for_dispatch: "Ready for Dispatch",
  rider_assigned: "Rider Assigned",
  picked_up: "Picked Up",
  on_the_way: "On the Way",
  arrived_at_destination: "Arrived",
  delivered: "Delivered",
  completed_pickup: "Picked Up (Customer)",
  cancelled: "Cancelled",
};
