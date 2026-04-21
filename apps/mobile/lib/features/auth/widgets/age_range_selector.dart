import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';

const Map<String, String> _ageEmojis = {
  'under_18': '🎒',
  '18_24': '🎓',
  '25_34': '🚀',
  '35_44': '💼',
  '45_plus': '🌟',
};

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
    final selectedIndex =
        ageRangeOptions.indexWhere((o) => o.value == value);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: [
              for (final option in ageRangeOptions) ...[
                _AgeRangeCard(
                  value: option.value,
                  label: option.label,
                  description: option.description,
                  emoji: _ageEmojis[option.value] ?? '📄',
                  isSelected: value == option.value,
                  colors: colors,
                  onTap: () => onChanged(option.value),
                ),
                if (option != ageRangeOptions.last)
                  const SizedBox(width: AppSpacing.sm),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (int i = 0; i < ageRangeOptions.length; i++) ...[
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: i == selectedIndex ? 20 : 8,
                height: 8,
                decoration: BoxDecoration(
                  color: i == selectedIndex ? colors.brand : Colors.transparent,
                  border: i == selectedIndex
                      ? null
                      : Border.all(color: colors.onSurfaceDim, width: 1.5),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              if (i < ageRangeOptions.length - 1)
                const SizedBox(width: AppSpacing.xs),
            ],
          ],
        ),
      ],
    );
  }
}

class _AgeRangeCard extends StatelessWidget {
  const _AgeRangeCard({
    required this.value,
    required this.label,
    required this.description,
    required this.emoji,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String value;
  final String label;
  final String description;
  final String emoji;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 148,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          borderRadius: AppRadius.borderLg,
          color: isSelected ? colors.brand : colors.surfaceVariant,
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.30)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 20 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(emoji, style: const TextStyle(fontSize: 28)),
            const SizedBox(height: AppSpacing.sm),
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
                color: isSelected
                    ? colors.accentOnColor.withValues(alpha: 0.80)
                    : colors.onSurfaceDim,
                height: 1.4,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
