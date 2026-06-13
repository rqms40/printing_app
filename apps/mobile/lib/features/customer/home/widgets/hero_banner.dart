import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/grid_logo.dart';

/// Compact hero banner — real GridLogo stamp + bentobox.webp fills edge-to-edge.
class HeroBanner extends StatelessWidget {
  const HeroBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        height: 115,
        width: double.infinity,
        color: Colors.black,
        child: Stack(
          children: [
            // WebP background — Positioned.fill for true edge-to-edge coverage
            Positioned.fill(
              child: Opacity(
                opacity: 0.45,
                child: Image.asset(
                  'assets/animations/bentobox.webp',
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                ),
              ),
            ),

            // Gradient scrim
            Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.08),
                      Colors.black.withValues(alpha: 0.62),
                    ],
                  ),
                ),
              ),
            ),

            // Content: logo + text, centered
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Real GRID dot-matrix logo, white dots
                  GridLogo(
                    size: 28,
                    foregroundColor: Colors.white.withValues(alpha: 0.82),
                    accentColor: const Color(0xFFFFDE58),
                    secondaryColor: Colors.white.withValues(alpha: 0.35),
                  ),

                  const SizedBox(height: AppSpacing.xs),

                  // GRID wordmark
                  Text.rich(
                        const TextSpan(
                          children: [
                            TextSpan(
                              text: 'GRID',
                              style: TextStyle(color: Colors.white),
                            ),
                            TextSpan(
                              text: 'GO',
                              style: TextStyle(color: Color(0xFFFFDE58)),
                            ),
                          ],
                        ),
                        style: AppTypography.display.copyWith(
                          color: Colors.white,
                          fontSize: 38,
                          height: 1.0,
                          letterSpacing: 5,
                        ),
                      ),

                  const SizedBox(height: 3),

                  // Tagline
                  Text(
                    'MAPPING THE FUTURE OF PRINTING',
                    style: AppTypography.overline.copyWith(
                      color: Colors.white.withValues(alpha: 0.50),
                      fontSize: 7.5,
                      letterSpacing: 2,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 450.ms, curve: Curves.easeOut);
  }
}
