import 'dart:io';
import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// 16:9 photo upload card.
///
/// Empty state: dashed border, camera icon + label.
/// Selected state: thumbnail with a "Replace" pill in the top-right corner.
class BetaPhotoUploadCard extends StatelessWidget {
  const BetaPhotoUploadCard({
    super.key,
    required this.photoFile,
    required this.onPick,
    required this.onReplace,
  });

  final File? photoFile;
  final VoidCallback onPick;
  final VoidCallback onReplace;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return AspectRatio(
      aspectRatio: 16 / 9,
      child: photoFile == null ? _emptyState(colors) : _selectedState(colors),
    );
  }

  Widget _emptyState(AppColorSet colors) {
    return GestureDetector(
      onTap: onPick,
      child: Container(
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: colors.outline,
            width: 1.5,
            // Dashed border is approximated with a custom painter below
          ),
        ),
        child: CustomPaint(
          painter: _DashedBorderPainter(color: colors.outline),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.camera_alt_rounded,
                  size: 32,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(height: 8),
                Text(
                  'Tap to add a photo of your prints',
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _selectedState(AppColorSet colors) {
    return Stack(
      fit: StackFit.expand,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.file(photoFile!, fit: BoxFit.cover),
        ),
        Positioned(
          top: 10,
          right: 10,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onReplace,
              borderRadius: BorderRadius.circular(20),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  'Replace',
                  style: AppTypography.caption.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Draws a dashed border around the widget's bounds.
class _DashedBorderPainter extends CustomPainter {
  const _DashedBorderPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    const dashWidth = 8.0;
    const dashSpace = 6.0;
    const strokeWidth = 1.5;
    const radius = 12.0;

    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          Rect.fromLTWH(0, 0, size.width, size.height),
          const Radius.circular(radius),
        ),
      );

    final pathMetrics = path.computeMetrics().toList();
    for (final metric in pathMetrics) {
      double distance = 0;
      bool draw = true;
      while (distance < metric.length) {
        final step = draw ? dashWidth : dashSpace;
        if (draw) {
          canvas.drawPath(
            metric.extractPath(
              distance,
              distance + step < metric.length
                  ? distance + step
                  : metric.length,
            ),
            paint,
          );
        }
        distance += step;
        draw = !draw;
      }
    }
  }

  @override
  bool shouldRepaint(covariant _DashedBorderPainter old) =>
      old.color != color;
}
