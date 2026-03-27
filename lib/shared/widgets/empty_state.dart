import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// Centered empty state placeholder with optional icon, heading, body, and CTA.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.heading,
    this.body,
    this.icon,
    this.ctaLabel,
    this.onCtaTap,
  });

  final String heading;
  final String? body;
  final IconData? icon;
  final String? ctaLabel;
  final VoidCallback? onCtaTap;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 64, color: colors.onSurfaceDim),
              const SizedBox(height: AppSpacing.lg),
            ],
            Text(
              heading,
              style: AppTypography.h2.copyWith(color: colors.onBackground),
              textAlign: TextAlign.center,
            ),
            if (body != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                body!,
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
                textAlign: TextAlign.center,
              ),
            ],
            if (ctaLabel != null && onCtaTap != null) ...[
              const SizedBox(height: AppSpacing.lg),
              AppButton(
                label: ctaLabel!,
                onTap: onCtaTap,
                variant: AppButtonVariant.ghost,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
