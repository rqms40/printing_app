export type UserRole =
  | "client"
  | "supplier"
  | "rider"
  | "ops_admin"
  | "super_admin"
  /** @deprecated legacy — accept until clients fully cut over */
  | "customer"
  | "admin";

/** Marketplace client metadata only — not an auth role. */
export type ClientAccountType = "business" | "organization" | "teacher";

/** Ops Admin + Super Admin (and legacy `admin`) may use the admin panel. */
export function isAdminCapableRole(role: string | null | undefined): boolean {
  return (
    role === "ops_admin" ||
    role === "super_admin" ||
    role === "admin"
  );
}

/**
 * Roles allowed to log into the Refine admin app.
 * Suppliers get the supplier portal section only (not ops nav).
 */
export function isAdminAppLoginRole(role: string | null | undefined): boolean {
  return isAdminCapableRole(role) || role === "supplier";
}

export function isSupplierRole(role: string | null | undefined): boolean {
  return role === "supplier";
}

export type OrderStatus =
  | "draft"
  | "submitted"
  | "needs_qa"
  | "client_correction"
  | "proof_approval"
  | "approved_for_matching"
  | "supplier_assigned"
  | "supplier_accepted"
  | "awaiting_payment"
  | "payment_authorized"
  | "production"
  | "supplier_self_qc"
  | "ready_for_dispatch"
  | "rider_assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "collected_by_customer"
  | "issue_window_open"
  | "completed"
  | "cancelled"
  | "file_rejected";

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
  draft: "Draft",
  submitted: "Submitted",
  needs_qa: "Needs QA",
  client_correction: "Client Correction",
  proof_approval: "Proof Approval",
  approved_for_matching: "Approved for Matching",
  supplier_assigned: "Supplier Assigned",
  supplier_accepted: "Supplier Accepted",
  awaiting_payment: "Awaiting Payment",
  payment_authorized: "Payment Authorized",
  production: "Production",
  supplier_self_qc: "Supplier Self-QC",
  ready_for_dispatch: "Ready for Dispatch",
  rider_assigned: "Rider Assigned",
  picked_up: "Picked Up",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  collected_by_customer: "Collected by Customer",
  issue_window_open: "Issue Window Open",
  completed: "Completed",
  cancelled: "Cancelled",
  file_rejected: "File Rejected",
};
