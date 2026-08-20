export enum ProfileCategory {
  STUDENT = 'student',
  PROFESSIONAL = 'professional',
  /** Sign-up lane for print-shop owners (maps to auth role supplier). */
  SUPPLIER = 'supplier',
  /** Sign-up lane for future riders (maps to auth role rider, requires verification). */
  RIDER = 'rider',
}

/**
 * Marketplace client account type metadata (PRD §4.2).
 * Not a separate auth role or workflow fork — optional on clients only.
 */
export enum ClientAccountType {
  BUSINESS = 'business',
  ORGANIZATION = 'organization',
  TEACHER = 'teacher',
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
  /** Default field for the supplier sign-up lane. */
  PRINT_SHOP = 'print_shop',
}

export enum PrintingPreference {
  PLOTTING_BLUEPRINTS = 'plotting_blueprints',
  TECHNICAL_SPECS = 'technical_specs',
  HIGH_RES_COLOR = 'high_res_color',
  DOCUMENT_PRINTING = 'document_printing',
  MARKETING_MATERIALS = 'marketing_materials',
}

/** Client shopping preference used to auto-match a supplier. */
export enum MatchingPreference {
  QUALITY = 'quality',
  PRICE = 'price',
  SPEED = 'speed',
}

export enum AgeRange {
  UNDER_18 = 'under_18',
  FROM_18_TO_24 = '18_24',
  FROM_25_TO_34 = '25_34',
  FROM_35_TO_44 = '35_44',
  FROM_45_PLUS = '45_plus',
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
  if (!fullName?.trim() || !profileCategory) return false;
  // Supplier lane uses service-focus ranks; print_shop is the synthetic field.
  if (profileCategory === ProfileCategory.SUPPLIER) {
    return profileField === ProfileField.PRINT_SHOP || Boolean(profileField);
  }
  if (profileCategory === ProfileCategory.RIDER) {
    return true; // Riders don't need a profile field
  }
  return Boolean(profileField);
}
