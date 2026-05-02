export enum FileProcessingType {
  DOCUMENT = 'document',
  MODEL_3D = 'model_3d',
  GENERIC_FILE = 'generic_file',
}

export enum PricingModel {
  PER_PAGE_MODIFIERS = 'per_page_modifiers',
  BASE_PLUS_MATERIAL_ESTIMATE = 'base_plus_material_estimate',
}

export enum InputType {
  SELECT = 'select',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  TEXT = 'text',
}

export enum ValueType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
}

export enum PricingRole {
  NONE = 'none',
  MULTIPLIER = 'multiplier',
  FIXED_FEE = 'fixed_fee',
  UNIT_COST = 'unit_cost',
  ESTIMATED_QUANTITY = 'estimated_quantity',
}
