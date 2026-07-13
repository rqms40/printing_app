import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_motion.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Button variants for [AppButton].
enum AppButtonVariant { primary, secondary, ghost, brand }

/// Reusable button following the GRIDGO design system.
///
/// Four variants:
/// - **primary** -- solid accent background, contrasting text.
/// - **secondary** -- transparent with 1px accent border.
/// - **ghost** -- transparent, no border.
/// - **brand** -- brand-yellow fill (`colors.brand`), black text (`colors.accentOnColor`). In dark mode this is #FFDE58; in light mode it renders as the deep amber brand token.
class AppButton extends StatefulWidget {
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

  /// Can be [IconData] (Material) or HugeIcons SVG data (List).
  final dynamic icon;

  @override
  State<AppButton> createState() => _AppButtonState();
}

class _AppButtonState extends State<AppButton> {
  bool _isPressed = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  bool get _effectivelyDisabled => widget.isDisabled || widget.onTap == null;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return GestureDetector(
      excludeFromSemantics: true,
      onTapDown: _effectivelyDisabled
          ? null
          : (_) => setState(() => _isPressed = true),
      onTapUp: _effectivelyDisabled
          ? null
          : (_) => setState(() => _isPressed = false),
      onTapCancel: _effectivelyDisabled
          ? null
          : () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.97 : 1.0,
        duration: _isPressed
            ? const Duration(milliseconds: 100)
            : const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        child: AnimatedOpacity(
          duration: AppMotion.fast,
          opacity: _effectivelyDisabled ? AppColors.disabledOpacity : 1.0,
          child: SizedBox(
            width: widget.isFullWidth ? double.infinity : null,
            height: 48,
            child: Material(
              color: _backgroundColor(colors),
              shape: _shape(colors),
              child: InkWell(
                onTap: _effectivelyDisabled || widget.isLoading
                    ? null
                    : widget.onTap,
                borderRadius: AppRadius.borderMd,
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                  ),
                  child: Center(
                    widthFactor: widget.isFullWidth ? null : 1.0,
                    child: _buildContent(colors),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Color _backgroundColor(AppColorSet colors) {
    switch (widget.variant) {
      case AppButtonVariant.primary:
        return colors.accent;
      case AppButtonVariant.secondary:
      case AppButtonVariant.ghost:
        return Colors.transparent;
      case AppButtonVariant.brand:
        return colors.brand;
    }
  }

  ShapeBorder _shape(AppColorSet colors) {
    switch (widget.variant) {
      case AppButtonVariant.primary:
        return RoundedRectangleBorder(borderRadius: AppRadius.borderMd);
      case AppButtonVariant.secondary:
        return RoundedRectangleBorder(
          borderRadius: AppRadius.borderMd,
          side: BorderSide(color: colors.accent, width: 1),
        );
      // ghost and brand share the same shape — no border, rounded corners.
      case AppButtonVariant.ghost:
      case AppButtonVariant.brand:
        return RoundedRectangleBorder(borderRadius: AppRadius.borderMd);
    }
  }

  Color _foregroundColor(AppColorSet colors) {
    switch (widget.variant) {
      case AppButtonVariant.primary:
        return colors.accentOnColor;
      case AppButtonVariant.secondary:
      case AppButtonVariant.ghost:
        return colors.onBackground;
      case AppButtonVariant.brand:
        return colors.accentOnColor;
    }
  }

  Widget _buildContent(AppColorSet colors) {
    if (widget.isLoading) {
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
      widget.label,
      textAlign: TextAlign.center,
      style: AppTypography.button.copyWith(color: textColor),
    );

    if (widget.icon != null) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          ExcludeSemantics(
            child: widget.icon is IconData
                ? Icon(widget.icon as IconData, size: 18, color: textColor)
                : HugeIcon(icon: widget.icon, size: 18, color: textColor),
          ),
          const SizedBox(width: AppSpacing.sm),
          textWidget,
        ],
      );
    }

    return textWidget;
  }
}
