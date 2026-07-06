import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';

const Map<String, String> _ageSvgs = {
  'under_18': 'assets/animations/undraw_cool-guy-avatar.svg',
  '18_24': 'assets/animations/undraw_chill-guy-avatar.svg',
  '25_34': 'assets/animations/undraw_focused.svg',
  '35_44': 'assets/animations/undraw_in-the-office.svg',
  '45_plus': 'assets/animations/undraw_professor-avatar.svg',
};

class AgeRangeSelector extends StatefulWidget {
  const AgeRangeSelector({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final String? value;
  final ValueChanged<String> onChanged;

  @override
  State<AgeRangeSelector> createState() => _AgeRangeSelectorState();
}

class _AgeRangeSelectorState extends State<AgeRangeSelector> {
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
        for (final option in ageRangeOptions) ...[
          _AgeRangeCard(
            key: ValueKey('age-range-${option.value}'),
            value: option.value,
            label: option.label,
            description: option.description,
            svgAsset: _ageSvgs[option.value] ?? '',
            isSelected: widget.value == option.value,
            colors: colors,
            onTap: () => widget.onChanged(option.value),
          ),
          if (option != ageRangeOptions.last)
            const SizedBox(height: AppSpacing.md),
        ],
      ],
    );
  }
}

class _AgeRangeCard extends StatelessWidget {
  const _AgeRangeCard({
    super.key,
    required this.value,
    required this.label,
    required this.description,
    required this.svgAsset,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String value;
  final String label;
  final String description;
  final String svgAsset;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: AppRadius.borderXl,
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
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (svgAsset.isNotEmpty) SvgPicture.asset(svgAsset, height: 180),
              const SizedBox(height: AppSpacing.md),
              Text(
                label,
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                description,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
