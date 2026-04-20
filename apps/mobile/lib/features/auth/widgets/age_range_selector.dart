import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';

class AgeRangeSelector extends StatelessWidget {
  const AgeRangeSelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: [
          for (final option in ageRangeOptions) ...[
            _AgeRangeCard(
              label: option.label,
              description: option.description,
              isSelected: value == option.value,
              colors: colors,
              onTap: () => onChanged(option.value),
            ),
            if (option != ageRangeOptions.last)
              const SizedBox(width: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}

class _AgeRangeCard extends StatelessWidget {
  const _AgeRangeCard({
    required this.label,
    required this.description,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final String description;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 132,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: AppRadius.borderLg,
          color: isSelected ? colors.accent : colors.surface,
          border: Border.all(
            color: isSelected ? colors.accent : colors.outline,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isSelected ? 0.10 : 0.04),
              blurRadius: 18,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: AppTypography.bodyBold.copyWith(
                color: isSelected ? colors.accentOnColor : colors.onBackground,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              description,
              style: AppTypography.caption.copyWith(
                color: isSelected ? colors.accentOnColor : colors.onSurfaceDim,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
