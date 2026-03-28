import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Full-width banner indicating no internet connection or API unavailability.
///
/// Uses the warning semantic color by default. When [useInfoColor] is true,
/// the info semantic color is used instead (e.g. for "demo mode" banners).
/// Optionally dismissible.
class OfflineBanner extends StatelessWidget {
  const OfflineBanner({
    super.key,
    this.message = 'No internet connection',
    this.onDismiss,
    this.useInfoColor = false,
  });

  final String message;

  /// When true, uses the info color instead of warning.
  final bool useInfoColor;

  /// If provided, a close button is shown and this callback is invoked on tap.
  final VoidCallback? onDismiss;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Material(
      color: useInfoColor ? colors.info : colors.warning,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          child: Row(
            children: [
              const HugeIcon(
                icon: HugeIcons.strokeRoundedWifiDisconnected01,
                size: 18,
                color: Colors.black87,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  message,
                  style: AppTypography.body.copyWith(color: Colors.black87),
                ),
              ),
              if (onDismiss != null)
                GestureDetector(
                  onTap: onDismiss,
                  child: const HugeIcon(
                    icon: HugeIcons.strokeRoundedCancel01,
                    size: 18,
                    color: Colors.black87,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
