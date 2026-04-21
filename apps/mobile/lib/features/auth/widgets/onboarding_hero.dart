import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Icon badge, display headline, and optional subtitle for onboarding screens.
class OnboardingHero extends StatelessWidget {
  const OnboardingHero({
    super.key,
    required this.icon,
    required this.headline,
    this.subtitle,
    this.withPulse = false,
  });

  final IconData icon;
  final String headline;
  final String? subtitle;
  final bool withPulse;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final subtitleText = subtitle;

    final badge = Container(
      width: 80,
      height: 80,
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        shape: BoxShape.circle,
      ),
      child: Center(
        child: Icon(icon, size: 48, color: colors.brand),
      ),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: withPulse
              ? badge
                  .animate(onPlay: (c) => c.repeat(reverse: true))
                  .scaleXY(
                    begin: 1.0,
                    end: 1.06,
                    duration: 1800.ms,
                    curve: Curves.easeInOut,
                  )
              : badge,
        ),
        const SizedBox(height: AppSpacing.xl),
        Text(
          headline,
          style: AppTypography.display.copyWith(color: colors.onBackground),
        ),
        if (subtitleText != null && subtitleText.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitleText,
            style: AppTypography.bodyLarge.copyWith(
              color: colors.onSurfaceDim,
              height: 1.5,
            ),
          ),
        ],
      ],
    );
  }
}
