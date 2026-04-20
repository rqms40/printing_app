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
        const SizedBox(height: AppSpacing.md),
        TextButton(
          onPressed: () => onChanged('Prefer not to say'),
          child: Text(
            'Prefer not to say',
            style: AppTypography.bodyBold.copyWith(
              color: value == 'Prefer not to say'
                  ? colors.onBackground
                  : colors.onSurfaceDim,
            ),
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
          vertical: AppSpacing.lg,
        ),
        decoration: BoxDecoration(
          borderRadius: AppRadius.borderXl,
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isSelected
                ? [colors.accent, colors.accentSoft]
                : [colors.surface, colors.surfaceVariant],
          ),
          border: Border.all(
            color: isSelected ? colors.accent : colors.outline,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isSelected ? 0.10 : 0.04),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Column(
          children: [
            Icon(
              icon,
              size: 36,
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
