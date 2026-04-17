import 'package:flutter/material.dart';

class ProfilingCategoryOption {
  const ProfilingCategoryOption({
    required this.value,
    required this.label,
    required this.description,
    required this.icon,
  });

  final String value;
  final String label;
  final String description;
  final IconData icon;
}

class ProfilingFieldOption {
  const ProfilingFieldOption({
    required this.category,
    required this.value,
    required this.label,
    required this.description,
  });

  final String category;
  final String value;
  final String label;
  final String description;
}

class PrintingPreferenceOption {
  const PrintingPreferenceOption({
    required this.value,
    required this.label,
  });

  final String value;
  final String label;
}

const profileCategories = [
  ProfilingCategoryOption(
    value: 'student',
    label: 'Student',
    description: 'School plates, reports, capstones, and deadlines.',
    icon: Icons.school_rounded,
  ),
  ProfilingCategoryOption(
    value: 'professional',
    label: 'Professional',
    description: 'Client-ready prints, specs, and production documents.',
    icon: Icons.work_rounded,
  ),
];

const profileFields = [
  ProfilingFieldOption(
    category: 'student',
    value: 'architecture',
    label: 'Architecture',
    description: 'Pre-selects Plotting / Blueprints',
  ),
  ProfilingFieldOption(
    category: 'student',
    value: 'engineering',
    label: 'Engineering',
    description: 'Pre-selects Technical Specs',
  ),
  ProfilingFieldOption(
    category: 'student',
    value: 'medical_nursing',
    label: 'Medical / Nursing',
    description: 'Pre-selects High-Res Color',
  ),
  ProfilingFieldOption(
    category: 'student',
    value: 'law_arts_others',
    label: 'Law / Arts / Others',
    description: 'Pre-selects Document Printing',
  ),
  ProfilingFieldOption(
    category: 'professional',
    value: 'architect_designer',
    label: 'Architect / Designer',
    description: 'Pre-selects Plotting / Blueprints',
  ),
  ProfilingFieldOption(
    category: 'professional',
    value: 'engineer_contractor',
    label: 'Engineer / Contractor',
    description: 'Pre-selects Technical Specs',
  ),
  ProfilingFieldOption(
    category: 'professional',
    value: 'medical_professional',
    label: 'Medical Professional',
    description: 'Pre-selects High-Res Color',
  ),
  ProfilingFieldOption(
    category: 'professional',
    value: 'business_corporate',
    label: 'Business / Corporate',
    description: 'Pre-selects Marketing Materials',
  ),
];

const printingPreferenceOptions = [
  PrintingPreferenceOption(
    value: 'plotting_blueprints',
    label: 'Plotting / Blueprints',
  ),
  PrintingPreferenceOption(
    value: 'technical_specs',
    label: 'Technical Specs',
  ),
  PrintingPreferenceOption(
    value: 'high_res_color',
    label: 'High-Res Color',
  ),
  PrintingPreferenceOption(
    value: 'document_printing',
    label: 'Document Printing',
  ),
  PrintingPreferenceOption(
    value: 'marketing_materials',
    label: 'Marketing Materials',
  ),
];

class ProfilingFormValue {
  const ProfilingFormValue({
    this.profileCategory,
    this.profileField,
    this.printingPreferences = const [],
  });

  final String? profileCategory;
  final String? profileField;
  final List<String> printingPreferences;

  ProfilingFormValue copyWith({
    Object? profileCategory = _unset,
    Object? profileField = _unset,
    List<String>? printingPreferences,
  }) {
    return ProfilingFormValue(
      profileCategory: profileCategory == _unset
          ? this.profileCategory
          : profileCategory as String?,
      profileField: profileField == _unset
          ? this.profileField
          : profileField as String?,
      printingPreferences: printingPreferences ?? this.printingPreferences,
    );
  }
}

const _unset = Object();

List<ProfilingFieldOption> profileFieldsForCategory(String? category) {
  return profileFields.where((field) => field.category == category).toList();
}

List<String> defaultPrintingPreferencesForField(String? profileField) {
  switch (profileField) {
    case 'architecture':
    case 'architect_designer':
      return const ['plotting_blueprints'];
    case 'engineering':
    case 'engineer_contractor':
      return const ['technical_specs'];
    case 'medical_nursing':
    case 'medical_professional':
      return const ['high_res_color'];
    case 'law_arts_others':
      return const ['document_printing'];
    case 'business_corporate':
      return const ['marketing_materials'];
    default:
      return const [];
  }
}

ProfilingFormValue seededProfilingValue({
  String? profileCategory,
  String? profileField,
  List<String>? printingPreferences,
}) {
  final seededPreferences =
      (printingPreferences == null || printingPreferences.isEmpty)
      ? defaultPrintingPreferencesForField(profileField)
      : printingPreferences;

  return ProfilingFormValue(
    profileCategory: profileCategory,
    profileField: profileField,
    printingPreferences: seededPreferences,
  );
}

String profilingPrompt(String? profileCategory) {
  if (profileCategory == 'professional') {
    return 'What is your field?';
  }

  return 'What are you studying?';
}

String profilingCourseLabel(String? profileCategory) {
  if (profileCategory == 'professional') {
    return 'Specialization / Title';
  }

  return 'Course / Program';
}

String profilingOrganizationLabel(String? profileCategory) {
  if (profileCategory == 'professional') {
    return 'Company / Organization';
  }

  return 'School';
}
