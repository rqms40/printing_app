import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/shared/widgets/grid_logo.dart';

/// GRID brand strip from rider-UI.png.
class RiderBrandingBanner extends StatelessWidget {
  const RiderBrandingBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 14),
      decoration: BoxDecoration(
        color: RiderTheme.surfaceElevated,
        borderRadius: BorderRadius.circular(13),
        border: Border.all(color: RiderTheme.mapLine.withValues(alpha: 0.6)),
      ),
      child: Stack(
        children: [
          const Positioned.fill(child: _DotGridTexture()),
          Column(
            children: [
              const GridLogo(
                size: 29,
                foregroundColor: RiderTheme.textPrimary,
                accentColor: RiderTheme.yellow,
                secondaryColor: Color(0xFF5B5B5B),
              ),
              Text(
                'GRID',
                style: AppTypography.h1.copyWith(
                  color: RiderTheme.textPrimary,
                  fontSize: 38,
                  letterSpacing: 3.5,
                  fontWeight: FontWeight.w800,
                  height: 0.96,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                'MAPPING THE FUTURE OF PRINTING.',
                style: AppTypography.overline.copyWith(
                  color: RiderTheme.textPrimary,
                  letterSpacing: 1.8,
                  fontSize: 8,
                  fontWeight: FontWeight.w800,
                ),
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DotGridTexture extends StatelessWidget {
  const _DotGridTexture();

  @override
  Widget build(BuildContext context) {
    return CustomPaint(painter: _DotGridPainter());
  }
}

class _DotGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = const Color(0xFF393939);
    for (var x = -2.0; x < size.width + 2; x += 6) {
      for (var y = -2.0; y < size.height + 2; y += 6) {
        final fade = (x / size.width - 0.5).abs();
        paint.color = Color.lerp(
          const Color(0xFF474747),
          const Color(0xFF222222),
          fade.clamp(0, 1),
        )!;
        canvas.drawCircle(Offset(x, y), 0.85, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
