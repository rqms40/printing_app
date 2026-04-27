import type {
  OrderStatus, PaymentMethod, PaymentStatus,
  PaperSize, ColorMode, MediaType, PrintSides, Binding,
  FileFormat3D, Material3D,
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

export interface Order {
  id: string;
  order_id: string;
  user_id: string;
  customer_id?: number;
  customer_name?: string | null;
  customer_email?: string | null;
  category: "paper" | "3d";
  file_url?: string;
  file_name?: string;
  file_metadata_id?: number;
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
  assigned_driver_id?: string;
  estimated_completion_at?: string;
  admin_notes?: string;
  tracking_link?: string;
  created_at: string;
  updated_at: string;
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
