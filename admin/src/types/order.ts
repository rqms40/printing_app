import type {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PaperSize,
  ColorMode,
  MediaType,
  PrintSides,
  Binding,
  FileFormat3D,
  Material3D,
} from "./enums";

export interface PaperSpecs {
  paper_size: PaperSize;
  color_mode: ColorMode;
  media_type: MediaType;
  print_sides: PrintSides;
  binding: Binding;
}

export interface ThreeDSpecs {
  file_format: FileFormat3D;
  material: Material3D;
  color: string;
  infill_percentage: number;
  layer_height: number;
  supports: boolean;
  notes?: string;
}

export interface OrderDestination {
  id?: number;
  address_id?: number | null;
  label?: string | null;
  address?: string | null;
  full_address?: string | null;
  barangay?: string | null;
  city?: string | null;
  province?: string | null;
  zip_code?: string | null;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  sort_order?: number;
}

export interface AssignedRiderContact {
  user_id?: number | string | null;
  rider_profile_id?: number | string | null;
  display_name?: string | null;
  full_name?: string | null;
  nickname?: string | null;
  phone_number?: string | null;
  vehicle_type?: string | null;
  plate_number?: string | null;
  delivery_assignment_id?: number | string | null;
  delivery_status?: string | null;
  /** Plain pickup OTP for ops to share with the rider (until verified). */
  pickup_otp?: string | null;
  /** Plain delivery OTP for ops/customer (after pickup, until verified). */
  delivery_otp?: string | null;
}

export interface AssignedSupplierContact {
  supplier_id?: number | null;
  business_name?: string | null;
  decision?: string | null;
  acceptance_deadline?: string | null;
  assignment_id?: number | null;
  logo_url?: string | null;
  address?: string | null;
  broad_address?: string | null;
  self_qc_evidence_urls?: string[];
  self_qc_evidence_file_ids?: number[];
}

export type PricingStatus = "pending_quote" | "quoted" | "accepted";

export interface OrderSpecSnapshot {
  key: string;
  label: string;
  input_type?: string | null;
  value: string;
  display_value: string;
  option_id?: number | null;
  option_label?: string | null;
}

export interface MatchingOutcome {
  code: string;
  message?: string | null;
}

export interface DeliveryProof {
  type?: "photo" | "signature" | string | null;
  file_id?: number | null;
  object_key?: string | null;
  signature_data?: string | null;
  captured_at?: string | null;
  captured_by_rider_id?: number | string | null;
}

export interface Order {
  id: string;
  order_id: string;
  user_id: string;
  customer_id?: number;
  customer_name?: string | null;
  customer_email?: string | null;
  category: string;
  file_url?: string;
  file_name?: string;
  file_metadata_id?: number | null;
  paper_specs?: PaperSpecs;
  three_d_specs?: ThreeDSpecs;
  quantity: number;
  total_price: number | null;
  delivery_fee: number | null;
  pricing_status?: PricingStatus;
  quoted_total_minor?: string | null;
  quoted_at?: string | null;
  quote_accepted_at?: string | null;
  quoted_by_user_id?: string | null;
  promised_completion_at?: string | null;
  unmet_coverage?: boolean;
  matching_outcome?: MatchingOutcome | null;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  allowed_next_statuses?: OrderStatus[];
  decline_reason?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  delivery_option: "pickup" | "delivery";
  delivery_address_id?: string;
  delivery_address?: OrderDestination | null;
  assigned_rider_id?: string;
  assigned_rider_contact?: AssignedRiderContact | null;
  assigned_supplier_contact?: AssignedSupplierContact | null;
  delivery_proof?: DeliveryProof | null;
  estimated_completion_at?: string;
  admin_notes?: string;
  adminStatusNote?: string | null;
  estimatedCompletionAt?: string | null;
  adminStatusSetAt?: string | null;
  tracking_link?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  // Batch / delivery slot fields (optional — present when order has slot booking)
  deliverySlotBookingId?: number;
  priority?: boolean;
  priorityFee?: number;
  speedTier?: string;
  deliveryType?: "local" | "external";
  extraDestinationFee?: number;
  destinations?: OrderDestination[];
}

export interface OrderItem {
  id: string;
  order_id?: string;
  category: string;
  category_id?: number | null;
  category_slug?: string | null;
  category_name?: string | null;
  group_slug?: string | null;
  group_name?: string | null;
  group_description?: string | null;
  examples?: string[];
  pricing_model?: string | null;
  required_at?: string | null;
  special_instructions?: string | null;
  specs?: OrderSpecSnapshot[];
  file_url?: string;
  file_name?: string;
  file_metadata_id?: number;
  paper_specs?: PaperSpecs;
  three_d_specs?: ThreeDSpecs;
  quantity: number;
  total_price: number | null;
  delivery_address?: OrderDestination | null;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  changed_by_user_id?: string | null;
  notes?: string | null;
  created_at: string;
}
