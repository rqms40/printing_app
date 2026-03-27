import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_illustrations.dart';
import 'package:printing_app/shared/widgets/icon_container.dart';

/// Centered empty state placeholder with optional icon, heading, body, and CTA.
///
/// When [illustration] is provided it renders that widget instead of the icon.
/// When neither [illustration] nor [icon] is provided, the default
/// [EmptyBoxIllustration] is shown.
class EmptyState extends StatelessWidget {
  const EmptyState({
    super.key,
    required this.heading,
    this.body,
    this.icon,
    this.illustration,
    this.ctaLabel,
    this.onCtaTap,
  });

  final String heading;
  final String? body;
  /// Can be [IconData] (Material) or HugeIcons SVG data (List).
  final dynamic icon;

  /// Optional custom illustration widget shown above the heading.
  /// Takes priority over [icon].
  final Widget? illustration;

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

    // Determine the visual element to display
    final Widget visual;
    if (illustration != null) {
      visual = illustration!;
    } else if (icon != null) {
      visual = IconContainer(
        icon: icon!,
        size: IconContainerSize.xl,
        iconColor: colors.onSurfaceDim,
      );
    } else {
      visual = EmptyBoxIllustration(
        size: 96,
        color: colors.onSurfaceDim,
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            visual,
            const SizedBox(height: AppSpacing.lg),
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
