// admin/src/types/products.ts

export type ProductFileProcessingType =
  | "document"
  | "model_3d"
  | "generic_file";
export type ProductPricingModel =
  | "per_page_modifiers"
  | "base_plus_material_estimate"
  | "quote_required";
export type ProductInputType = "select" | "number" | "boolean" | "text";
export type ProductValueType = "string" | "number" | "boolean";
export type ProductPricingRole =
  | "none"
  | "multiplier"
  | "fixed_fee"
  | "unit_cost"
  | "estimated_quantity";

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  group_slug?: string;
  group_name?: string;
  group_description?: string;
  group_sort_order?: number;
  examples?: string[];
  description?: string;
  mobile_description?: string;
  icon?: string;
  file_processing_type: ProductFileProcessingType;
  pricing_model: ProductPricingModel;
  base_rate: number;
  quantity_unit: string;
  max_file_size_mb: number;
  allowed_extensions: string[];
  is_active: boolean;
  sort_order: number;
  specs?: ProductSpecDefinition[];
  created_at: string;
  updated_at: string;
}

export interface ProductSpecDefinition {
  id: string;
  category_id: string;
  key: string;
  label: string;
  help_text?: string;
  input_type: ProductInputType;
  value_type: ProductValueType;
  is_required: boolean;
  is_active: boolean;
  default_value?: string;
  pricing_role: ProductPricingRole;
  unit_label?: string;
  placeholder?: string;
  min_value?: number;
  max_value?: number;
  step_value?: number;
  sort_order: number;
  metadata?: Record<string, unknown>;
  options?: SpecOption[];
  created_at: string;
  updated_at: string;
}

export interface SpecOption {
  id: string;
  category_id: string;
  spec_definition_id?: string;
  option_group: string;
  label: string;
  value: string;
  multiplier: number;
  fixed_fee: number;
  unit_cost: number;
  estimated_quantity?: number;
  estimated_grams?: number;
  is_default: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ServiceAddon {
  id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  price_type: "flat" | "per_unit";
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
