import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';

class RulerOverlay extends StatelessWidget {
  const RulerOverlay({
    super.key,
    required this.widthMm,
    required this.heightMm,
  });

  final double widthMm;
  final double heightMm;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final brandColor = isDark ? AppColors.brandDark : AppColors.brandLight;

    return IgnorePointer(
      child: Container(
        decoration: BoxDecoration(
          border: Border(
            top: BorderSide(color: brandColor.withValues(alpha: 0.8), width: 2),
            left: BorderSide(color: brandColor.withValues(alpha: 0.8), width: 2),
          ),
        ),
        child: Align(
          alignment: Alignment.topLeft,
          child: Container(
            margin: const EdgeInsets.only(
              top: AppSpacing.xs,
              left: AppSpacing.sm,
            ),
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xs,
              vertical: 2,
            ),
            decoration: BoxDecoration(
              color: Colors.black.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              '${widthMm.round()}mm × ${heightMm.round()}mm',
              style: TextStyle(
                color: brandColor,
                fontSize: 11,
                fontFamily: 'monospace',
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
