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

export interface Order {
  id: string;
  order_id: string;
  user_id: string;
  customer_id?: number;
  customer_name?: string | null;
  customer_email?: string | null;
  category: "paper" | "3d" | "batch";
  file_url?: string;
  file_name?: string;
  file_metadata_id?: number | null;
  paper_specs?: PaperSpecs;
  three_d_specs?: ThreeDSpecs;
  quantity: number;
  total_price: number;
  delivery_fee: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  order_status: OrderStatus;
  decline_reason?: string;
  cancellation_reason?: string;
  cancelled_at?: string;
  delivery_option: "pickup" | "delivery";
  delivery_address_id?: string;
  delivery_address?: OrderDestination | null;
  assigned_rider_id?: string;
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
  category: "paper" | "3d";
  file_url?: string;
  file_name?: string;
  file_metadata_id?: number;
  paper_specs?: PaperSpecs;
  three_d_specs?: ThreeDSpecs;
  quantity: number;
  total_price: number;
  delivery_address?: OrderDestination | null;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  changed_by_user_id?: string;
  notes?: string;
  created_at: string;
}
