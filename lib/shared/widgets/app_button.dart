import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_motion.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Button variants for [AppButton].
enum AppButtonVariant { primary, secondary, ghost }

/// Reusable button following the DarkastixPrint greyscale design system.
///
/// Three variants:
/// - **primary** -- solid accent background, contrasting text.
/// - **secondary** -- transparent with 1px accent border.
/// - **ghost** -- transparent, no border.
class AppButton extends StatelessWidget {
  const AppButton({
    super.key,
    required this.label,
    this.onTap,
    this.variant = AppButtonVariant.primary,
    this.isLoading = false,
    this.isDisabled = false,
    this.isFullWidth = false,
    this.icon,
  });

  final String label;
  final VoidCallback? onTap;
  final AppButtonVariant variant;
  final bool isLoading;
  final bool isDisabled;
  final bool isFullWidth;
  final IconData? icon;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  bool get _effectivelyDisabled => isDisabled || onTap == null;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return AnimatedOpacity(
      duration: AppMotion.fast,
      opacity: _effectivelyDisabled ? AppColors.disabledOpacity : 1.0,
      child: SizedBox(
        width: isFullWidth ? double.infinity : null,
        height: 48,
        child: Material(
          color: _backgroundColor(colors),
          shape: _shape(colors),
          child: InkWell(
            onTap: _effectivelyDisabled || isLoading ? null : onTap,
            borderRadius: AppRadius.borderMd,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Center(
                widthFactor: isFullWidth ? null : 1.0,
                child: _buildContent(colors),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Color _backgroundColor(AppColorSet colors) {
    switch (variant) {
      case AppButtonVariant.primary:
        return colors.accent;
      case AppButtonVariant.secondary:
      case AppButtonVariant.ghost:
        return Colors.transparent;
    }
  }

  ShapeBorder _shape(AppColorSet colors) {
    switch (variant) {
      case AppButtonVariant.primary:
        return RoundedRectangleBorder(borderRadius: AppRadius.borderMd);
      case AppButtonVariant.secondary:
        return RoundedRectangleBorder(
          borderRadius: AppRadius.borderMd,
          side: BorderSide(color: colors.accent, width: 1),
        );
      case AppButtonVariant.ghost:
        return RoundedRectangleBorder(borderRadius: AppRadius.borderMd);
    }
  }

  Color _foregroundColor(AppColorSet colors) {
    switch (variant) {
      case AppButtonVariant.primary:
        return colors.background;
      case AppButtonVariant.secondary:
      case AppButtonVariant.ghost:
        return colors.accent;
    }
  }

  Widget _buildContent(AppColorSet colors) {
    if (isLoading) {
      return SizedBox(
        width: 20,
        height: 20,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: _foregroundColor(colors),
        ),
      );
    }

    final textColor = _foregroundColor(colors);
    final textWidget = Text(
      label,
      style: AppTypography.button.copyWith(color: textColor),
    );

    if (icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18, color: textColor),
          const SizedBox(width: AppSpacing.sm),
          textWidget,
        ],
      );
    }

    return textWidget;
  }
}
