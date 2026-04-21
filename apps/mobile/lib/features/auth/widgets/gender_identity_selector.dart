import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

class GenderIdentitySelector extends StatelessWidget {
  const GenderIdentitySelector({
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

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _GenderCard(
                label: 'Male',
                icon: Icons.male_rounded,
                isSelected: value == 'Male',
                colors: colors,
                onTap: () => onChanged('Male'),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: _GenderCard(
                label: 'Female',
                icon: Icons.female_rounded,
                isSelected: value == 'Female',
                colors: colors,
                onTap: () => onChanged('Female'),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        GestureDetector(
          onTap: () => onChanged('Prefer not to say'),
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 180),
            style: AppTypography.bodyBold.copyWith(
              color: value == 'Prefer not to say'
                  ? colors.onBackground
                  : colors.onSurfaceDim,
              decoration: value == 'Prefer not to say'
                  ? TextDecoration.underline
                  : TextDecoration.none,
            ),
            child: const Text('Prefer not to say'),
          ),
        ),
      ],
    );
  }
}

class _GenderCard extends StatelessWidget {
  const _GenderCard({
    required this.label,
    required this.icon,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.xl,
        ),
        decoration: BoxDecoration(
          borderRadius: AppRadius.borderXl,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isSelected
                ? [colors.brand, colors.brand.withValues(alpha: 0.80)]
                : [colors.surfaceVariant, colors.surfaceVariant],
          ),
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.30)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 24 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 52,
              color: isSelected ? colors.accentOnColor : colors.onBackground,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              label,
              style: AppTypography.bodyBold.copyWith(
                color: isSelected ? colors.accentOnColor : colors.onBackground,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
