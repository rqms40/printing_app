import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/tutorial/widgets/primary_action_button.dart';

class FeatureIconTile {
  const FeatureIconTile({required this.icon, required this.label});
  final dynamic icon;
  final String label;
}

class FeatureOverlayCard extends StatelessWidget {
  const FeatureOverlayCard({
    super.key,
    required this.title,
    required this.body,
    required this.iconTiles,
    required this.ctaLabel,
    required this.onCta,
    required this.onSkip,
    this.tipLine,
    this.heroIcon,
    this.showSkip = true,
  });

  final String title;
  final String body;
  final List<FeatureIconTile> iconTiles;
  final String ctaLabel;
  final VoidCallback onCta;
  final VoidCallback onSkip;
  final String? tipLine;

  // When non-null, renders a single hero icon block instead of the icon-tile row.
  final dynamic heroIcon;

  // Whether to render the "Skip for now" text button. False for the pipeline
  // welcome card — skipping happens via the coach-mark bubbles instead.
  final bool showSkip;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return SafeArea(
      top: false,
      child: Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl, AppSpacing.md, AppSpacing.xl, AppSpacing.xl,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Center(
            child: Container(
              width: 36, height: 4,
              decoration: BoxDecoration(
                color: colors.outline,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),

          if (heroIcon != null) ...[
            Center(
              child: Container(
                width: 72,
                height: 72,
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.10),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Center(
                  child: HugeIcon(
                    icon: heroIcon,
                    color: colors.brand,
                    size: 36,
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          Center(
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: AppTypography.h2.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
                fontSize: 24,
              ),
            ),
          ),

          if (body.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: Text(
                body,
                textAlign: TextAlign.center,
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim,
                  height: 1.4,
                ),
              ),
            ),
          ],

          if (heroIcon == null && iconTiles.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.lg),
            Row(
              children: iconTiles.map((tile) => Expanded(
                child: Column(
                  children: [
                    Container(
                      width: 48, height: 48,
                      decoration: BoxDecoration(
                        color: colors.brand.withValues(alpha: 0.10),
                        borderRadius: AppRadius.borderMd,
                      ),
                      child: Center(
                        child: HugeIcon(
                          icon: tile.icon,
                          color: colors.brand,
                          size: 22,
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      tile.label,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              )).toList(),
            ),
          ],

          if (tipLine != null) ...[
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md, vertical: 10,
              ),
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.10),
                borderRadius: AppRadius.borderMd,
              ),
              child: Text(
                tipLine!,
                style: AppTypography.caption.copyWith(
                  color: colors.onBackground, fontSize: 12,
                ),
              ),
            ),
          ],

          const SizedBox(height: AppSpacing.lg),

          PrimaryActionButton(label: ctaLabel, onPressed: onCta),

          if (showSkip) ...[
            const SizedBox(height: AppSpacing.sm),
            Center(
              child: TextButton(
                onPressed: onSkip,
                child: Text(
                  'Skip for now',
                  style: AppTypography.body.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    ),
    ).animate().fadeIn(duration: 200.ms);
  }
}
