export enum ProfileCategory {
  STUDENT = 'student',
  PROFESSIONAL = 'professional',
}

export enum ProfileField {
  ARCHITECTURE = 'architecture',
  ENGINEERING = 'engineering',
  MEDICAL_NURSING = 'medical_nursing',
  LAW_ARTS_OTHERS = 'law_arts_others',
  ARCHITECT_DESIGNER = 'architect_designer',
  ENGINEER_CONTRACTOR = 'engineer_contractor',
  MEDICAL_PROFESSIONAL = 'medical_professional',
  BUSINESS_CORPORATE = 'business_corporate',
}

export enum PrintingPreference {
  PLOTTING_BLUEPRINTS = 'plotting_blueprints',
  TECHNICAL_SPECS = 'technical_specs',
  HIGH_RES_COLOR = 'high_res_color',
  DOCUMENT_PRINTING = 'document_printing',
  MARKETING_MATERIALS = 'marketing_materials',
}

export type ProfileCompletionFields = {
  fullName?: string | null;
  profileCategory?: ProfileCategory | null;
  profileField?: ProfileField | null;
};

export function isProfileComplete({
  fullName,
  profileCategory,
  profileField,
}: ProfileCompletionFields): boolean {
  return Boolean(fullName?.trim() && profileCategory && profileField);
}
