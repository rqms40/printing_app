// admin/src/types/products.ts

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  base_rate: number;
  max_file_size_mb: number;
  allowed_extensions: string[];
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface SpecOption {
  id: string;
  category_id: string;
  option_group: string;
  label: string;
  value: string;
  multiplier: number;
  fixed_fee: number;
  unit_cost: number;
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
  price_type: 'flat' | 'per_unit';
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
