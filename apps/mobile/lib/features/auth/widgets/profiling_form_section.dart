import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

class ProfilingFormSection extends StatelessWidget {
  const ProfilingFormSection({
    super.key,
    required this.value,
    required this.onChanged,
    required this.courseController,
    required this.organizationController,
    this.categoryError,
    this.fieldError,
  });

  final ProfilingFormValue value;
  final ValueChanged<ProfilingFormValue> onChanged;
  final TextEditingController courseController;
  final TextEditingController organizationController;
  final String? categoryError;
  final String? fieldError;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final availableFields = profileFieldsForCategory(value.profileCategory);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Tell us a bit about yourself',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        const SizedBox(height: AppSpacing.sm),
        Text(
          'This helps us shape smarter print defaults from day one.',
          style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.lg),
        Column(
          children: [
            for (final option in profileCategories) ...[
              _CategoryCard(
                option: option,
                colors: colors,
                isSelected: value.profileCategory == option.value,
                onTap: () {
                  onChanged(
                    value.copyWith(
                      profileCategory: option.value,
                      profileField: option.value == 'supplier'
                          ? 'print_shop'
                          : null,
                      printingPreferences: const [],
                    ),
                  );
                },
              ),
              if (option != profileCategories.last)
                const SizedBox(height: AppSpacing.sm),
            ],
          ],
        ),
        if (categoryError != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            categoryError!,
            style: AppTypography.caption.copyWith(color: colors.error),
          ),
        ],
        if (value.profileCategory != null &&
            value.profileCategory != 'supplier') ...[
          const SizedBox(height: AppSpacing.xl),
          Text(
            profilingPrompt(value.profileCategory),
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.sm),
          Column(
            children: [
              for (final field in availableFields) ...[
                _FieldCard(
                  option: field,
                  colors: colors,
                  isSelected: value.profileField == field.value,
                  onTap: () {
                    onChanged(
                      value.copyWith(
                        profileField: field.value,
                        printingPreferences:
                            defaultPrintingPreferencesForField(field.value),
                      ),
                    );
                  },
                ),
                if (field != availableFields.last)
                  const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ),
          if (fieldError != null) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              fieldError!,
              style: AppTypography.caption.copyWith(color: colors.error),
            ),
          ],
        ],
        if (value.profileCategory != null) ...[
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: courseController,
            label: profilingCourseLabel(value.profileCategory),
            hintText: value.profileCategory == 'professional'
                ? 'e.g. Site Engineer'
                : value.profileCategory == 'supplier'
                    ? 'e.g. Large-format & apparel'
                    : 'e.g. BS Architecture',
          ),
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: organizationController,
            label: profilingOrganizationLabel(value.profileCategory),
            hintText: value.profileCategory == 'professional'
                ? 'e.g. Grid Print Studio'
                : value.profileCategory == 'supplier'
                    ? 'e.g. Davao Print Co'
                    : 'e.g. Mapua University',
          ),
        ],
        if (value.profileField != null &&
            value.profileCategory != 'supplier') ...[
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Printing Preferences',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: printingPreferenceOptions.map((option) {
              final isSelected =
                  value.printingPreferences.contains(option.value);
              return FilterChip(
                label: Text(
                  option.label,
                  style: AppTypography.caption.copyWith(
                    color: isSelected
                        ? colors.accentOnColor
                        : colors.onSurface,
                  ),
                ),
                selected: isSelected,
                onSelected: (_) {
                  final nextPreferences = [...value.printingPreferences];
                  if (isSelected) {
                    nextPreferences.remove(option.value);
                  } else {
                    nextPreferences.add(option.value);
                  }

                  onChanged(
                    value.copyWith(
                      printingPreferences: nextPreferences,
                    ),
                  );
                },
                selectedColor: colors.accent,
                backgroundColor: colors.surfaceVariant,
                shape: RoundedRectangleBorder(
                  borderRadius: AppRadius.borderFull,
                  side: BorderSide(
                    color: isSelected ? colors.accent : colors.outline,
                  ),
                ),
                showCheckmark: false,
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.option,
    required this.colors,
    required this.isSelected,
    required this.onTap,
  });

  final ProfilingCategoryOption option;
  final AppColorSet colors;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderLg,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: isSelected ? colors.accent : colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: isSelected ? colors.accent : colors.outline,
            ),
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: colors.accent.withValues(alpha: 0.12),
                      blurRadius: 16,
                      offset: const Offset(0, 8),
                    ),
                  ]
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                option.icon,
                color: isSelected ? colors.accentOnColor : colors.brand,
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                option.label,
                style: AppTypography.bodyBold.copyWith(
                  color:
                      isSelected ? colors.accentOnColor : colors.onBackground,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                option.description,
                style: AppTypography.caption.copyWith(
                  color: isSelected
                      ? colors.accentOnColor.withValues(alpha: 0.78)
                      : colors.onSurfaceDim,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldCard extends StatelessWidget {
  const _FieldCard({
    required this.option,
    required this.colors,
    required this.isSelected,
    required this.onTap,
  });

  final ProfilingFieldOption option;
  final AppColorSet colors;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderLg,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: isSelected ? colors.surfaceHigh : colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: isSelected ? colors.brand : colors.outline,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                option.label,
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                option.description,
                style: AppTypography.caption.copyWith(
                  color: isSelected ? colors.onSurface : colors.onSurfaceDim,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
