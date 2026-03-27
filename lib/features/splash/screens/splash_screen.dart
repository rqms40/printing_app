import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';

import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/grid_logo.dart';

/// Premium branded splash screen with staggered fade-in animations.
///
/// Sequence:
///   0ms   – Screen appears with background
///   200ms – GridBrandMark fades in + scales 0.8 → 1.0
///   500ms – "GRID" fades in + slides up 10px
///   700ms – Subtitle fades in
///   2500ms – Entire content fades out
///   2800ms – Navigate to /auth/login
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 2800), () {
      if (mounted) {
        context.go('/auth/login');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors =
        brightness == Brightness.dark ? AppColors.dark : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      body: SizedBox.expand(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Brand mark (logo + wordmark)
            GridBrandMark(
              logoSize: 64,
              fontSize: 36,
              color: colors.onBackground,
            )
                .animate()
                .fadeIn(
                  delay: 200.ms,
                  duration: 300.ms,
                  curve: Curves.easeOut,
                )
                .scale(
                  begin: const Offset(0.8, 0.8),
                  end: const Offset(1, 1),
                  delay: 200.ms,
                  duration: 300.ms,
                  curve: Curves.easeOut,
                ),

            const SizedBox(height: AppSpacing.sm),

            // Subtitle
            Text(
              'Premium Printing Services',
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            ).animate().fadeIn(
                  delay: 700.ms,
                  duration: 200.ms,
                ),
          ],
        )
            .animate()
            .fadeOut(
              delay: 2500.ms,
              duration: 300.ms,
            ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.md),
          child: Text(
            'Powered by GRID',
            style: AppTypography.overline.copyWith(
              color: colors.onSurfaceDim,
            ),
            textAlign: TextAlign.center,
          ).animate().fadeIn(
                delay: 700.ms,
                duration: 200.ms,
              ),
        ),
      ),
    );
  }
}
