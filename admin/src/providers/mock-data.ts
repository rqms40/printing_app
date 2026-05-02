import type { DashboardKPIs, ChartDataPoint } from "@/types/dashboard";
import type { Order } from "@/types/order";
import type { DriverProfile } from "@/types/driver";
import type { ServiceCategory, SpecOption, ServiceAddon } from "@/types/products";

export const mockKPIs: DashboardKPIs = {
  new_orders_count: 5,
  in_production_count: 3,
  ready_for_pickup_count: 2,
  delivered_count: 128,
  avg_tat_mins: 145,
  error_rate_percent: 1.2,
};

export const mockTatData: ChartDataPoint[] = [
  { month: "Oct", value: 180 },
  { month: "Nov", value: 175 },
  { month: "Dec", value: 190 },
  { month: "Jan", value: 160 },
  { month: "Feb", value: 155 },
  { month: "Mar", value: 145 },
];

export const mockErrorRateData: ChartDataPoint[] = [
  { month: "Oct", value: 2.1 },
  { month: "Nov", value: 1.8 },
  { month: "Dec", value: 2.5 },
  { month: "Jan", value: 1.6 },
  { month: "Feb", value: 1.4 },
  { month: "Mar", value: 1.2 },
];

export const mockVolumeData: ChartDataPoint[] = [
  { month: "Oct", value: 85 },
  { month: "Nov", value: 102 },
  { month: "Dec", value: 115 },
  { month: "Jan", value: 94 },
  { month: "Feb", value: 110 },
  { month: "Mar", value: 128 },
];

export const mockOrders: Order[] = [
  {
    id: "1",
    order_id: "ORD-00147",
    user_id: "usr_001",
    category: "paper",
    file_name: "thesis_final.pdf",
    file_url: "https://storage.grid.ph/files/thesis_final.pdf",
    paper_specs: {
      paper_size: "a4",
      color_mode: "full_color",
      media_type: "matte",
      print_sides: "back_to_back",
      binding: "spiral",
    },
    quantity: 3,
    total_price: 450,
    delivery_fee: 50,
    payment_method: "gcash",
    payment_status: "paid",
    order_status: "printing_in_progress",
    delivery_option: "delivery",
    delivery_address_id: "addr_001",
    estimated_completion_at: "2026-03-31T14:00:00Z",
    admin_notes: "Rush order — customer needs by Friday",
    created_at: "2026-03-28T09:15:00Z",
    updated_at: "2026-03-29T11:30:00Z",
  },
  {
    id: "2",
    order_id: "ORD-00148",
    user_id: "usr_002",
    category: "3d",
    file_name: "figurine_v3.stl",
    three_d_specs: {
      file_format: "stl",
      material: "pla",
      color: "White",
      infill_percentage: 20,
      layer_height: 0.2,
      supports: true,
      notes: "Please orient upright",
    },
    quantity: 1,
    total_price: 1200,
    delivery_fee: 0,
    payment_method: "cod",
    payment_status: "pending",
    order_status: "order_placed",
    delivery_option: "pickup",
    created_at: "2026-03-29T15:45:00Z",
    updated_at: "2026-03-29T15:45:00Z",
  },
  {
    id: "3",
    order_id: "ORD-00149",
    user_id: "usr_003",
    category: "paper",
    file_name: "poster_design.pdf",
    paper_specs: {
      paper_size: "a1",
      color_mode: "full_color",
      media_type: "glossy",
      print_sides: "front_only",
      binding: "none",
    },
    quantity: 5,
    total_price: 2500,
    delivery_fee: 80,
    payment_method: "maya",
    payment_status: "paid",
    order_status: "ready_for_dispatch",
    delivery_option: "delivery",
    created_at: "2026-03-27T08:00:00Z",
    updated_at: "2026-03-29T16:00:00Z",
  },
  {
    id: "4",
    order_id: "ORD-00150",
    user_id: "usr_001",
    category: "paper",
    file_name: "flyers_batch.pdf",
    paper_specs: {
      paper_size: "a5",
      color_mode: "full_color",
      media_type: "glossy",
      print_sides: "front_only",
      binding: "none",
    },
    quantity: 100,
    total_price: 3500,
    delivery_fee: 100,
    payment_method: "gcash",
    payment_status: "paid",
    order_status: "delivered",
    delivery_option: "delivery",
    assigned_driver_id: "drv_001",
    created_at: "2026-03-20T10:00:00Z",
    updated_at: "2026-03-25T14:00:00Z",
  },
  {
    id: "5",
    order_id: "ORD-00151",
    user_id: "usr_004",
    category: "paper",
    file_name: "business_cards.pdf",
    paper_specs: {
      paper_size: "custom",
      color_mode: "full_color",
      media_type: "matte",
      print_sides: "back_to_back",
      binding: "none",
    },
    quantity: 200,
    total_price: 1800,
    delivery_fee: 50,
    payment_method: "cod",
    payment_status: "pending",
    order_status: "file_verified",
    delivery_option: "delivery",
    created_at: "2026-03-29T18:00:00Z",
    updated_at: "2026-03-29T18:30:00Z",
  },
];

export const mockDrivers: DriverProfile[] = [
  {
    id: "drv_001",
    user_id: "usr_010",
    full_name: "Juan Reyes",
    vehicle_type: "motorcycle",
    plate_number: "ABC-1234",
    is_available: true,
    last_latitude: 7.1338,
    last_longitude: 125.6120,
    created_at: "2026-01-15T00:00:00Z",
    updated_at: "2026-03-29T10:00:00Z",
  },
  {
    id: "drv_002",
    user_id: "usr_011",
    full_name: "Marco dela Cruz",
    vehicle_type: "motorcycle",
    plate_number: "XYZ-5678",
    is_available: true,
    last_latitude: 7.1400,
    last_longitude: 125.6180,
    created_at: "2026-02-01T00:00:00Z",
    updated_at: "2026-03-29T09:00:00Z",
  },
  {
    id: "drv_003",
    user_id: "usr_012",
    full_name: "Carlos Santos",
    vehicle_type: "car",
    plate_number: "DEF-9012",
    is_available: false,
    last_latitude: 7.1290,
    last_longitude: 125.6030,
    created_at: "2026-02-20T00:00:00Z",
    updated_at: "2026-03-29T08:00:00Z",
  },
];

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  driver_id: string;
  status: string;
  earnings: number;
  date: string;
}

export const mockDeliveries: DeliveryAssignment[] = [
  {
    id: "da_001",
    order_id: "ORD-00147",
    driver_id: "drv_001",
    status: "On the Way",
    earnings: 120,
    date: "Mar 27, 2026",
  },
  {
    id: "da_002",
    order_id: "ORD-00148",
    driver_id: "drv_001",
    status: "Delivered",
    earnings: 150,
    date: "Mar 26, 2026",
  },
  {
    id: "da_005",
    order_id: "ORD-00149",
    driver_id: "drv_002",
    status: "Picked Up",
    earnings: 90,
    date: "Mar 27, 2026",
  },
  {
    id: "da_004",
    order_id: "ORD-00150",
    driver_id: "drv_003",
    status: "Declined",
    earnings: 0,
    date: "Mar 27, 2026",
  }
];

export const mockStorageData = [
  { size: "A5", type: "Student", value: 350 },
  { size: "A5", type: "Employee", value: 80 },
  { size: "A4", type: "Student", value: 1800 },
  { size: "A4", type: "Employee", value: 1250 },
  { size: "A3", type: "Student", value: 240 },
  { size: "A3", type: "Employee", value: 410 },
  { size: "A2", type: "Student", value: 90 },
  { size: "A2", type: "Employee", value: 280 },
  { size: "A1", type: "Student", value: 40 },
  { size: "A1", type: "Employee", value: 150 },
  { size: "Poster(20x30in)", type: "Student", value: 120 },
  { size: "Poster(20x30in)", type: "Employee", value: 300 },
];

export const mockStatusHistory = [
  {
    id: "h1",
    order_id: "1",
    from_status: "order_placed",
    to_status: "file_verified",
    changed_by_user_id: "admin_001",
    notes: "File looks good",
    created_at: "2026-03-28T10:00:00Z",
  },
  {
    id: "h2",
    order_id: "1",
    from_status: "file_verified",
    to_status: "printing_in_progress",
    changed_by_user_id: "admin_001",
    created_at: "2026-03-29T11:30:00Z",
  },
];

// ─── Mock Products ───────────────────────────────────────────────────────────

export const mockCategories: ServiceCategory[] = [
  {
    id: '1',
    name: 'Paper Printing',
    slug: 'paper',
    description: 'Standard and large-format paper printing',
    mobile_description: 'Print documents, posters, flyers, and handouts.',
    icon: 'FileTextOutlined',
    file_processing_type: 'document',
    pricing_model: 'per_page_modifiers',
    base_rate: 2.0,
    quantity_unit: 'page',
    max_file_size_mb: 50,
    allowed_extensions: ['pdf', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'docx'],
    is_active: true,
    sort_order: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: '3D Printing',
    slug: '3d',
    description: 'FDM 3D printing with PLA, ABS, and PETG materials',
    mobile_description: 'Upload a 3D model and choose material, color, and print settings.',
    icon: 'AppstoreOutlined',
    file_processing_type: 'model_3d',
    pricing_model: 'base_plus_material_estimate',
    base_rate: 50.0,
    quantity_unit: 'gram',
    max_file_size_mb: 200,
    allowed_extensions: ['stl', 'obj', '3mf', 'glb', 'gltf'],
    is_active: true,
    sort_order: 2,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];

export const mockSpecOptions: SpecOption[] = [
  { id: '1',  category_id: '1', option_group: 'paper_size', label: 'A5', value: 'a5', multiplier: 0.8, fixed_fee: 0, unit_cost: 0, is_default: false, is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '2',  category_id: '1', option_group: 'paper_size', label: 'A4', value: 'a4', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, is_default: true,  is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '3',  category_id: '1', option_group: 'paper_size', label: 'A3', value: 'a3', multiplier: 1.5, fixed_fee: 0, unit_cost: 0, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '4',  category_id: '1', option_group: 'color_mode', label: 'Black & White', value: 'black_and_white', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '5',  category_id: '1', option_group: 'color_mode', label: 'Full Color',    value: 'full_color',      multiplier: 2.5, fixed_fee: 0, unit_cost: 0, is_default: false, is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '6',  category_id: '1', option_group: 'binding', label: 'None',    value: 'none',    multiplier: 1.0, fixed_fee: 0,  unit_cost: 0, is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '7',  category_id: '1', option_group: 'binding', label: 'Spiral',  value: 'spiral',  multiplier: 1.0, fixed_fee: 25, unit_cost: 0, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '8',  category_id: '2', option_group: 'material', label: 'PLA',  value: 'pla',  multiplier: 1.0, fixed_fee: 0, unit_cost: 3.0, is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '9',  category_id: '2', option_group: 'material', label: 'ABS',  value: 'abs',  multiplier: 1.0, fixed_fee: 0, unit_cost: 3.0, is_default: false, is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '10', category_id: '2', option_group: 'material', label: 'PETG', value: 'petg', multiplier: 1.0, fixed_fee: 0, unit_cost: 4.0, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '11', category_id: '2', option_group: 'infill', label: '10%', value: 'infill_10', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, estimated_grams: 20,  is_default: true,  is_active: true, sort_order: 10, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '12', category_id: '2', option_group: 'infill', label: '20%', value: 'infill_20', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, estimated_grams: 40,  is_default: false, is_active: true, sort_order: 20, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
  { id: '13', category_id: '2', option_group: 'infill', label: '50%', value: 'infill_50', multiplier: 1.0, fixed_fee: 0, unit_cost: 0, estimated_grams: 100, is_default: false, is_active: true, sort_order: 30, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' },
];

export const mockAddons: ServiceAddon[] = [
  {
    id: '1',
    category_id: '1',
    name: 'Lamination (A4)',
    description: 'Matte or glossy lamination for A4 sheets',
    price: 20.0,
    price_type: 'per_unit',
    is_active: true,
    sort_order: 10,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Rush Processing',
    description: 'Priority queue processing, ready in 2 hours',
    price: 150.0,
    price_type: 'flat',
    is_active: true,
    sort_order: 20,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  },
];
