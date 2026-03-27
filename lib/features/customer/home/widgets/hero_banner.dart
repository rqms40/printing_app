import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Editorial hero banner with Instrument Serif display text.
class HeroBanner extends StatelessWidget {
  const HeroBanner({super.key});

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
      width: double.infinity,
      padding: const EdgeInsets.only(
        left: AppSpacing.xl,
        right: AppSpacing.xl,
        top: AppSpacing.xxl,
        bottom: AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderXl,
        boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Professional printing,\ndelivered.',
            style: AppTypography.display.copyWith(
              color: colors.onBackground,
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Paper and 3D printing services at your fingertips',
            style: AppTypography.body.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
        ],
      ),
    );
  }
}
