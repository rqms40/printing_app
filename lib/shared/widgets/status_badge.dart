import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Semantic status variants for [StatusBadge].
enum StatusBadgeVariant { success, error, warning, info, neutral }

/// Small chip displaying an icon + text pair in a semantic color.
///
/// Icon and text are always paired for accessibility -- color is never the
/// sole indicator of status.
class StatusBadge extends StatelessWidget {
  const StatusBadge({
    super.key,
    required this.label,
    this.variant = StatusBadgeVariant.neutral,
  });

  final String label;
  final StatusBadgeVariant variant;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final scheme = _scheme(colors);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: scheme.background,
        borderRadius: AppRadius.borderFull,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HugeIcon(icon: scheme.icon, size: 16, color: scheme.foreground),
          const SizedBox(width: AppSpacing.xs),
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: scheme.foreground,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  _BadgeScheme _scheme(AppColorSet colors) {
    switch (variant) {
      case StatusBadgeVariant.success:
        return _BadgeScheme(
          background: colors.success.withValues(alpha: 0.12),
          foreground: colors.success,
          icon: HugeIcons.strokeRoundedCheckmarkCircle02,
        );
      case StatusBadgeVariant.error:
        return _BadgeScheme(
          background: colors.error.withValues(alpha: 0.12),
          foreground: colors.error,
          icon: HugeIcons.strokeRoundedCancelCircle,
        );
      case StatusBadgeVariant.warning:
        return _BadgeScheme(
          background: colors.warning.withValues(alpha: 0.12),
          foreground: colors.warning,
          icon: HugeIcons.strokeRoundedAlert02,
        );
      case StatusBadgeVariant.info:
        return _BadgeScheme(
          background: colors.info.withValues(alpha: 0.12),
          foreground: colors.info,
          icon: HugeIcons.strokeRoundedInformationCircle,
        );
      case StatusBadgeVariant.neutral:
        return _BadgeScheme(
          background: colors.onSurfaceDim.withValues(alpha: 0.12),
          foreground: colors.onSurfaceDim,
          icon: HugeIcons.strokeRoundedCircle,
        );
    }
  }
}

class _BadgeScheme {
  const _BadgeScheme({
    required this.background,
    required this.foreground,
    required this.icon,
  });

  final Color background;
  final Color foreground;
  /// HugeIcons SVG data (List<List<dynamic>>).
  final dynamic icon;
}
