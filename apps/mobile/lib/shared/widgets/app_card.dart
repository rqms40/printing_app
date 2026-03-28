import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';

/// Reusable card with optional left accent line and configurable shadow.
class AppCard extends StatefulWidget {
  const AppCard({
    super.key,
    required this.child,
    this.onTap,
    this.shadow,
    this.accentColor,
    this.padding,
  });

  final Widget child;
  final VoidCallback? onTap;

  /// Shadow level from [AppShadows]. Defaults to [AppShadows.subtle].
  final List<BoxShadow>? shadow;

  /// Optional thin left accent line (4px wide) for status indication.
  final Color? accentColor;

  /// Card padding. Defaults to [AppSpacing.md] on all sides.
  final EdgeInsetsGeometry? padding;

  @override
  State<AppCard> createState() => _AppCardState();
}

class _AppCardState extends State<AppCard> {
  bool _isPressed = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasTap = widget.onTap != null;

    final card = Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        boxShadow:
            isDark ? AppShadows.none : (widget.shadow ?? AppShadows.subtle),
        border: isDark
            ? Border.all(color: colors.outline, width: 0.5)
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Left accent line
          if (widget.accentColor != null)
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(width: 4, color: widget.accentColor),
            ),
          // Content with InkWell
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.onTap,
              borderRadius: AppRadius.borderMd,
              child: Padding(
                padding: widget.padding ??
                    EdgeInsets.only(
                      left: widget.accentColor != null
                          ? AppSpacing.md + 4
                          : AppSpacing.md,
                      right: AppSpacing.md,
                      top: AppSpacing.md,
                      bottom: AppSpacing.md,
                    ),
                child: widget.child,
              ),
            ),
          ),
        ],
      ),
    );

    if (!hasTap) return card;

    return GestureDetector(
      onTapDown: (_) => setState(() => _isPressed = true),
      onTapUp: (_) => setState(() => _isPressed = false),
      onTapCancel: () => setState(() => _isPressed = false),
      child: AnimatedScale(
        scale: _isPressed ? 0.98 : 1.0,
        duration: _isPressed
            ? const Duration(milliseconds: 100)
            : const Duration(milliseconds: 150),
        curve: Curves.easeOut,
        child: card,
      ),
    );
  }
}
