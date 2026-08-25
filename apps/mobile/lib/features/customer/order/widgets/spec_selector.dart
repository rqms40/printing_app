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
    this.isOptionEnabled,
    this.helperText,
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

  /// When false, the chip is grayed out and not tappable.
  final bool Function(T value)? isOptionEnabled;

  /// Optional caption under the chips (size policy, printer hint).
  final String? helperText;

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
            final enabled = isOptionEnabled?.call(option) ?? true;
            return Opacity(
              opacity: enabled ? 1 : 0.42,
              child: ChoiceChip(
                label: Text(displayName(option)),
                selected: isSelected && enabled,
                onSelected: enabled ? (_) => onChanged(option) : null,
                selectedColor: colors.accent,
                backgroundColor: colors.surfaceVariant,
                disabledColor: colors.surfaceVariant,
                labelStyle: AppTypography.body.copyWith(
                  color: !enabled
                      ? colors.onSurfaceDim
                      : isSelected
                      ? colors.background
                      : colors.onSurface,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                  side: BorderSide(
                    color: isSelected && enabled
                        ? colors.accent
                        : colors.outline,
                  ),
                ),
                showCheckmark: false,
              ),
            );
          }).toList(),
        ),
        if (helperText != null && helperText!.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            helperText!,
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ],
    );
  }
}
