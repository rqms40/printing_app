import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Reusable chip-group widget for selecting one option from a list.
///
/// Renders a label and a [Wrap] of [ChoiceChip]s. The selected chip uses
/// the accent background with contrasting text; unselected chips use
/// surfaceVariant with onSurface text.
class SpecSelector<T> extends StatelessWidget {
  const SpecSelector({
    super.key,
    required this.label,
    required this.options,
    required this.selected,
    required this.onChanged,
    required this.displayName,
  });

  /// Section label displayed above the chips.
  final String label;

  /// All available options.
  final List<T> options;

  /// The currently selected value.
  final T selected;

  /// Called when the user taps a chip.
  final ValueChanged<T> onChanged;

  /// Returns the display label for each option.
  final String Function(T) displayName;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        ),
        const SizedBox(height: AppSpacing.sm),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: options.map((option) {
            final isSelected = option == selected;
            return ChoiceChip(
              label: Text(displayName(option)),
              selected: isSelected,
              onSelected: (_) => onChanged(option),
              selectedColor: colors.accent,
              backgroundColor: colors.surfaceVariant,
              labelStyle: AppTypography.body.copyWith(
                color: isSelected ? colors.background : colors.onSurface,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(8),
                side: BorderSide(
                  color: isSelected ? colors.accent : colors.outline,
                ),
              ),
              showCheckmark: false,
            );
          }).toList(),
        ),
      ],
    );
  }
}
