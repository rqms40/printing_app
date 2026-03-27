import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';

/// Reusable card with optional left accent line and configurable shadow.
class AppCard extends StatelessWidget {
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

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        boxShadow: isDark ? AppShadows.none : (shadow ?? AppShadows.subtle),
        border: isDark
            ? Border.all(color: colors.outline, width: 0.5)
            : null,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        children: [
          // Left accent line
          if (accentColor != null)
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Container(width: 4, color: accentColor),
            ),
          // Content with InkWell
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onTap,
              borderRadius: AppRadius.borderMd,
              child: Padding(
                padding: padding ??
                    EdgeInsets.only(
                      left: accentColor != null
                          ? AppSpacing.md + 4
                          : AppSpacing.md,
                      right: AppSpacing.md,
                      top: AppSpacing.md,
                      bottom: AppSpacing.md,
                    ),
                child: child,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
