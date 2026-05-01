import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Standard metric triangular architect scale ratios.
const List<int> kRulerScales = [20, 25, 50, 100, 200, 500];

const double _rulerHeight = 84;
const double _rulerLengthFraction = 0.88; // of parent width

/// A floating, draggable + rotatable scale ruler that overlays a preview.
///
/// - Single-finger drag to pan.
/// - Two-finger rotate gesture to rotate (ScaleUpdateDetails.rotation).
/// - Tap the scale chip on the ruler to cycle ratios.
/// - Double-tap to snap rotation back to 0° and recenter.
class RulerOverlay extends StatefulWidget {
  const RulerOverlay({
    super.key,
    required this.widthMm,
    required this.heightMm,
    this.scale = 1,
    this.onCycleScale,
  });

  final double widthMm;
  final double heightMm;
  final int scale;
  final VoidCallback? onCycleScale;

  @override
  State<RulerOverlay> createState() => _RulerOverlayState();
}

class _RulerOverlayState extends State<RulerOverlay> {
  Offset? _center;
  double _angle = 0;
  double _angleStart = 0;
  Offset _centerStart = Offset.zero;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        _center ??= Offset(size.width / 2, size.height / 2);

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final brand = isDark ? AppColors.brandDark : AppColors.brandLight;

        final rulerLengthPx = math
            .min(size.width * _rulerLengthFraction, size.width - 16)
            .clamp(260.0, 980.0);
        final pxPerMm = size.width / widget.widthMm;

        return Stack(
          clipBehavior: Clip.none,
          children: [
            // Subtle hint label at top-right when ruler is on.
            Positioned(
              top: 12,
              right: 12,
              child: IgnorePointer(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.55),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    'Drag · 2-finger rotate · double-tap reset',
                    style: AppTypography.caption.copyWith(
                      color: Colors.white.withValues(alpha: 0.85),
                      fontSize: 10,
                      letterSpacing: 0.3,
                    ),
                  ),
                ),
              ),
            ),

            // The floating ruler itself.
            Positioned(
              left: _center!.dx - rulerLengthPx / 2,
              top: _center!.dy - _rulerHeight / 2,
              width: rulerLengthPx,
              height: _rulerHeight,
              child: Transform.rotate(
                angle: _angle,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onScaleStart: (details) {
                    _angleStart = _angle;
                    _centerStart = _center!;
                  },
                  onScaleUpdate: (details) {
                    setState(() {
                      _center = Offset(
                        (_centerStart.dx + details.focalPointDelta.dx)
                            .clamp(20.0, size.width - 20),
                        (_centerStart.dy + details.focalPointDelta.dy)
                            .clamp(20.0, size.height - 20),
                      );
                      _angle = _angleStart + details.rotation;
                    });
                  },
                  onDoubleTap: () {
                    setState(() {
                      _angle = 0;
                      _center = Offset(size.width / 2, size.height / 2);
                    });
                  },
                  child: _RulerBar(
                    scale: widget.scale,
                    pxPerMm: pxPerMm,
                    brand: brand,
                    onCycleScale: widget.onCycleScale,
                    angleDegrees:
                        (_angle * 180 / math.pi).remainder(360.0),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _RulerBar extends StatelessWidget {
  const _RulerBar({
    required this.scale,
    required this.pxPerMm,
    required this.brand,
    required this.angleDegrees,
    this.onCycleScale,
  });

  final int scale;
  final double pxPerMm;
  final Color brand;
  final double angleDegrees;
  final VoidCallback? onCycleScale;

  String get _scaleLabel => scale == 1 ? '1:1' : '1:$scale';

  @override
  Widget build(BuildContext context) {
    final angleLabel = '${angleDegrees.toStringAsFixed(0)}°';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: brand.withValues(alpha: 0.45), width: 1),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 14,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(7),
        child: Stack(
          children: [
            // Tick marks across the bar (background).
            Positioned.fill(
              child: CustomPaint(
                painter: _RulerTicksPainter(
                  scale: scale,
                  pxPerMm: pxPerMm,
                  color: brand,
                ),
              ),
            ),
            // Scale chip on the left end — tap to cycle.
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onCycleScale,
                  child: Container(
                    width: 88,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: brand,
                      border: Border(
                        right: BorderSide(
                          color: Colors.black.withValues(alpha: 0.35),
                          width: 1,
                        ),
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _scaleLabel,
                          style: AppTypography.caption.copyWith(
                            color: const Color(0xFF111111),
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.4,
                            height: 1.0,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'tap to cycle',
                          style: AppTypography.caption.copyWith(
                            color:
                                const Color(0xFF111111).withValues(alpha: 0.7),
                            fontSize: 9,
                            letterSpacing: 0.2,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            // Angle pill on the right end.
            Positioned(
              right: 6,
              top: 0,
              bottom: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.65),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                      color: brand.withValues(alpha: 0.4),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(Icons.rotate_right_rounded, size: 14, color: brand),
                      const SizedBox(width: 5),
                      Text(
                        angleLabel,
                        style: AppTypography.caption.copyWith(
                          color: brand,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RulerTicksPainter extends CustomPainter {
  _RulerTicksPainter({
    required this.scale,
    required this.pxPerMm,
    required this.color,
  });

  final int scale;
  final double pxPerMm;
  final Color color;

  static const _chipWidth = 88.0;

  /// Paper-mm between major ticks based on the architect-scale ratio.
  double get _majorMm {
    switch (scale) {
      case 20:
        return 5; // 10 cm world
      case 25:
        return 4; // 10 cm world
      case 50:
        return 20; // 1 m world
      case 100:
        return 10; // 1 m world
      case 200:
        return 5; // 1 m world
      case 500:
        return 10; // 5 m world
      default:
        return 10;
    }
  }

  String _label(double paperMm) {
    final realMm = paperMm * scale;
    if (realMm >= 1000) {
      final m = realMm / 1000;
      return m == m.roundToDouble()
          ? '${m.toStringAsFixed(0)}m'
          : '${m.toStringAsFixed(1)}m';
    }
    return '${realMm.toStringAsFixed(0)}cm';
  }

  @override
  void paint(Canvas canvas, Size size) {
    if (pxPerMm <= 0) return;

    final majorPaint = Paint()
      ..color = color.withValues(alpha: 0.95)
      ..strokeWidth = 1.6;
    final minorPaint = Paint()
      ..color = color.withValues(alpha: 0.5)
      ..strokeWidth = 0.9;
    final baselinePaint = Paint()
      ..color = color.withValues(alpha: 0.45)
      ..strokeWidth = 1.2;

    // Drawable region (skip the chip on the left).
    final left = _chipWidth + 6;
    final right = size.width - 6;
    if (right <= left) return;

    // Top baseline of the ticks.
    final topY = size.height * 0.18;
    final bottomY = size.height * 0.62;

    canvas.drawLine(
      Offset(left, bottomY),
      Offset(right, bottomY),
      baselinePaint,
    );

    final majorMm = _majorMm;
    final majorPx = majorMm * pxPerMm;
    if (majorPx < 4) return; // ticks would be too dense to read

    var i = 0;
    for (double x = left; x <= right; x += majorPx) {
      // Major tick
      canvas.drawLine(Offset(x, topY), Offset(x, bottomY), majorPaint);
      // Mid tick
      final midX = x + majorPx / 2;
      if (midX <= right) {
        canvas.drawLine(
          Offset(midX, topY + 8),
          Offset(midX, bottomY),
          minorPaint,
        );
      }
      // Label below
      final mm = i * majorMm;
      final tp = TextPainter(
        text: TextSpan(
          text: _label(mm),
          style: TextStyle(
            color: color.withValues(alpha: 0.95),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
        textDirection: TextDirection.ltr,
      )..layout();
      final tx = (x - tp.width / 2).clamp(left, right - tp.width);
      tp.paint(canvas, Offset(tx, bottomY + 4));
      i++;
    }
  }

  @override
  bool shouldRepaint(covariant _RulerTicksPainter old) =>
      old.scale != scale ||
      old.pxPerMm != pxPerMm ||
      old.color != color;
}
