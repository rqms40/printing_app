import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

const double _mmPerInch = 25.4;
const double _rulerHeight = 84;
const double _rulerLengthFraction = 0.88;
const double _scaleChipWidth = 132;

@immutable
class ArchitectScale {
  const ArchitectScale({
    required this.label,
    required this.inchesPerFoot,
    this.isFullSize = false,
  });

  /// Visible triangular architect scale label.
  final String label;

  /// Drawing inches that represent one real-world foot.
  ///
  /// Example: 1/4" = 1'-0" has 0.25 drawing inches per real foot.
  final double inchesPerFoot;

  /// True for the triangular ruler's standard full-size inch face.
  final bool isFullSize;

  double drawingInchesForRealFeet(double realFeet) => realFeet * inchesPerFoot;

  double realFeetForDrawingInches(double drawingInches) =>
      drawingInches / inchesPerFoot;
}

const ArchitectScale kDefaultArchitectScale = ArchitectScale(
  label: '1/4" = 1\'-0"',
  inchesPerFoot: 1 / 4,
);

/// Standard imperial triangular architect scale faces.
///
/// These intentionally exclude metric and engineer decimal scales.
const List<ArchitectScale> kArchitectScales = <ArchitectScale>[
  kDefaultArchitectScale,
  ArchitectScale(label: '1/8" = 1\'-0"', inchesPerFoot: 1 / 8),
  ArchitectScale(label: '1/2" = 1\'-0"', inchesPerFoot: 1 / 2),
  ArchitectScale(label: '3/32" = 1\'-0"', inchesPerFoot: 3 / 32),
  ArchitectScale(label: '3/16" = 1\'-0"', inchesPerFoot: 3 / 16),
  ArchitectScale(label: '3/8" = 1\'-0"', inchesPerFoot: 3 / 8),
  ArchitectScale(label: '3/4" = 1\'-0"', inchesPerFoot: 3 / 4),
  ArchitectScale(label: '1" = 1\'-0"', inchesPerFoot: 1),
  ArchitectScale(label: '1 1/2" = 1\'-0"', inchesPerFoot: 1.5),
  ArchitectScale(label: '3" = 1\'-0"', inchesPerFoot: 3),
  ArchitectScale(
    label: 'Full size (1/16")',
    inchesPerFoot: 12,
    isFullSize: true,
  ),
];

Rect rulerFittedDrawingRect({
  required Size viewportSize,
  required double drawingWidthMm,
  required double drawingHeightMm,
}) {
  if (viewportSize.isEmpty || drawingWidthMm <= 0 || drawingHeightMm <= 0) {
    return Offset.zero & viewportSize;
  }

  final fitted = applyBoxFit(
    BoxFit.contain,
    Size(drawingWidthMm, drawingHeightMm),
    viewportSize,
  ).destination;
  return Rect.fromLTWH(
    (viewportSize.width - fitted.width) / 2,
    (viewportSize.height - fitted.height) / 2,
    fitted.width,
    fitted.height,
  );
}

double drawingPixelsPerInchForViewport({
  required Size viewportSize,
  required double drawingWidthMm,
  required double drawingHeightMm,
}) {
  final rect = rulerFittedDrawingRect(
    viewportSize: viewportSize,
    drawingWidthMm: drawingWidthMm,
    drawingHeightMm: drawingHeightMm,
  );
  final drawingWidthIn = drawingWidthMm / _mmPerInch;
  if (drawingWidthIn <= 0) return 0;
  return rect.width / drawingWidthIn;
}

double pixelsForRealFeet({
  required ArchitectScale scale,
  required double realFeet,
  required double pxPerDrawingInch,
}) {
  return scale.drawingInchesForRealFeet(realFeet) * pxPerDrawingInch;
}

double pixelsForDrawingInches({
  required double drawingInches,
  required double pxPerDrawingInch,
}) {
  return drawingInches * pxPerDrawingInch;
}

Offset rulerCenterForGesture({
  required Offset startCenter,
  required Offset startFocalPoint,
  required Offset currentFocalPoint,
  required Size bounds,
  required Size rulerSize,
}) {
  final nextCenter = startCenter + (currentFocalPoint - startFocalPoint);
  return clampRulerCenter(
    center: nextCenter,
    bounds: bounds,
    rulerSize: rulerSize,
  );
}

Offset clampRulerCenter({
  required Offset center,
  required Size bounds,
  required Size rulerSize,
}) {
  if (bounds.isEmpty) return center;

  final halfWidth = math.min(rulerSize.width / 2, bounds.width / 2);
  final halfHeight = math.min(rulerSize.height / 2, bounds.height / 2);
  return Offset(
    _clampDouble(center.dx, halfWidth, bounds.width - halfWidth),
    _clampDouble(center.dy, halfHeight, bounds.height - halfHeight),
  );
}

double _clampDouble(double value, double min, double max) {
  if (max < min) return (min + max) / 2;
  return value.clamp(min, max).toDouble();
}

/// A floating, draggable and rotatable architect scale ruler overlay.
///
/// It is calibrated against the fitted document bounds, so letterboxed previews
/// do not distort the inch-to-foot scale.
class RulerOverlay extends StatefulWidget {
  const RulerOverlay({
    super.key,
    required this.widthMm,
    required this.heightMm,
    this.scale = kDefaultArchitectScale,
    this.onCycleScale,
  });

  final double widthMm;
  final double heightMm;
  final ArchitectScale scale;
  final VoidCallback? onCycleScale;

  @override
  State<RulerOverlay> createState() => _RulerOverlayState();
}

class _RulerOverlayState extends State<RulerOverlay> {
  Offset? _center;
  Offset _centerStart = Offset.zero;
  Offset _focalPointStart = Offset.zero;
  double _angle = 0;
  double _angleStart = 0;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, constraints.maxHeight);
        final drawingRect = rulerFittedDrawingRect(
          viewportSize: size,
          drawingWidthMm: widget.widthMm,
          drawingHeightMm: widget.heightMm,
        );
        final pxPerDrawingInch = drawingPixelsPerInchForViewport(
          viewportSize: size,
          drawingWidthMm: widget.widthMm,
          drawingHeightMm: widget.heightMm,
        );

        final isDark = Theme.of(context).brightness == Brightness.dark;
        final brand = isDark ? AppColors.brandDark : AppColors.brandLight;

        final availableWidth = drawingRect.width > 0
            ? drawingRect.width
            : size.width;
        final maxViewportLength = math.max(120.0, size.width - 16);
        final rulerLengthPx = math
            .min(
              math.min(availableWidth * _rulerLengthFraction, 980),
              maxViewportLength,
            )
            .clamp(120.0, maxViewportLength)
            .toDouble();
        final rulerSize = Size(rulerLengthPx, _rulerHeight);
        final initialCenter = drawingRect.isEmpty
            ? size.center(Offset.zero)
            : drawingRect.center;
        _center = clampRulerCenter(
          center: _center ?? initialCenter,
          bounds: size,
          rulerSize: rulerSize,
        );

        return Stack(
          clipBehavior: Clip.none,
          children: [
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
                    _focalPointStart = details.focalPoint;
                  },
                  onScaleUpdate: (details) {
                    setState(() {
                      _center = rulerCenterForGesture(
                        startCenter: _centerStart,
                        startFocalPoint: _focalPointStart,
                        currentFocalPoint: details.focalPoint,
                        bounds: size,
                        rulerSize: rulerSize,
                      );
                      _angle = _angleStart + details.rotation;
                    });
                  },
                  onDoubleTap: () {
                    setState(() {
                      _angle = 0;
                      _center = clampRulerCenter(
                        center: initialCenter,
                        bounds: size,
                        rulerSize: rulerSize,
                      );
                    });
                  },
                  child: _RulerBar(
                    scale: widget.scale,
                    pxPerDrawingInch: pxPerDrawingInch,
                    brand: brand,
                    onCycleScale: widget.onCycleScale,
                    angleDegrees: (_angle * 180 / math.pi).remainder(360.0),
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
    required this.pxPerDrawingInch,
    required this.brand,
    required this.angleDegrees,
    this.onCycleScale,
  });

  final ArchitectScale scale;
  final double pxPerDrawingInch;
  final Color brand;
  final double angleDegrees;
  final VoidCallback? onCycleScale;

  @override
  Widget build(BuildContext context) {
    final angleLabel = '${angleDegrees.toStringAsFixed(0)}°';

    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF171717),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: brand.withValues(alpha: 0.5), width: 1),
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
            Positioned.fill(
              child: CustomPaint(
                painter: _RulerTicksPainter(
                  scale: scale,
                  pxPerDrawingInch: pxPerDrawingInch,
                  color: brand,
                ),
              ),
            ),
            Positioned(
              left: 0,
              top: 0,
              bottom: 0,
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: onCycleScale,
                  child: Container(
                    width: _scaleChipWidth,
                    padding: const EdgeInsets.symmetric(horizontal: 10),
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
                          'ARCH SCALE',
                          style: AppTypography.caption.copyWith(
                            color: const Color(
                              0xFF111111,
                            ).withValues(alpha: 0.7),
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 0.4,
                          ),
                        ),
                        const SizedBox(height: 4),
                        FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.centerLeft,
                          child: Text(
                            scale.label,
                            maxLines: 1,
                            style: AppTypography.caption.copyWith(
                              color: const Color(0xFF111111),
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              height: 1.0,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
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
    required this.pxPerDrawingInch,
    required this.color,
  });

  final ArchitectScale scale;
  final double pxPerDrawingInch;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (pxPerDrawingInch <= 0 || scale.inchesPerFoot <= 0) return;

    const left = _scaleChipWidth + 8;
    final right = size.width - 64;
    if (right <= left) return;

    final majorPaint = Paint()
      ..color = color.withValues(alpha: 0.96)
      ..strokeWidth = 1.5;
    final mediumPaint = Paint()
      ..color = color.withValues(alpha: 0.68)
      ..strokeWidth = 1.0;
    final minorPaint = Paint()
      ..color = color.withValues(alpha: 0.42)
      ..strokeWidth = 0.8;
    final baselinePaint = Paint()
      ..color = color.withValues(alpha: 0.45)
      ..strokeWidth = 1.1;
    final facetPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.045)
      ..style = PaintingStyle.fill;

    final topY = size.height * 0.16;
    final bottomY = size.height * 0.66;
    final midY = size.height * 0.38;

    final facet = Path()
      ..moveTo(left, 0)
      ..lineTo(right, 0)
      ..lineTo(right - 20, midY)
      ..lineTo(left + 20, midY)
      ..close();
    canvas.drawPath(facet, facetPaint);
    canvas.drawLine(
      Offset(left, bottomY),
      Offset(right, bottomY),
      baselinePaint,
    );
    canvas.drawLine(Offset(left, topY), Offset(right, topY), baselinePaint);

    if (scale.isFullSize) {
      _paintFullSizeTicks(
        canvas: canvas,
        left: left,
        right: right,
        topY: topY,
        bottomY: bottomY,
        majorPaint: majorPaint,
        mediumPaint: mediumPaint,
        minorPaint: minorPaint,
      );
      return;
    }

    final footPx = pixelsForRealFeet(
      scale: scale,
      realFeet: 1,
      pxPerDrawingInch: pxPerDrawingInch,
    );
    if (footPx <= 0) return;

    final tickEveryFeet = _niceFootInterval(footPx, minSpacingPx: 8);
    final labelEveryFeet = _niceFootInterval(footPx, minSpacingPx: 42);
    final inchPx = footPx / 12;

    if (inchPx >= 4 && footPx >= 28) {
      for (double footX = left; footX <= right; footX += footPx) {
        for (var inch = 1; inch < 12; inch++) {
          final x = footX + inch * inchPx;
          if (x >= right) break;
          final isHalfFoot = inch == 6;
          canvas.drawLine(
            Offset(x, isHalfFoot ? topY + 9 : topY + 15),
            Offset(x, bottomY),
            isHalfFoot ? mediumPaint : minorPaint,
          );
        }
      }
    }

    for (var feet = 0; left + feet * footPx <= right; feet += tickEveryFeet) {
      final x = left + feet * footPx;
      final isLabelTick = feet % labelEveryFeet == 0;
      canvas.drawLine(
        Offset(x, isLabelTick ? topY : topY + 6),
        Offset(x, bottomY),
        isLabelTick ? majorPaint : mediumPaint,
      );
      if (isLabelTick) {
        _paintLabel(canvas, '$feet\'', x, bottomY + 4, left, right);
      }
    }
  }

  void _paintFullSizeTicks({
    required Canvas canvas,
    required double left,
    required double right,
    required double topY,
    required double bottomY,
    required Paint majorPaint,
    required Paint mediumPaint,
    required Paint minorPaint,
  }) {
    final sixteenthPx = pixelsForDrawingInches(
      drawingInches: 1 / 16,
      pxPerDrawingInch: pxPerDrawingInch,
    );
    if (sixteenthPx <= 0) return;

    final tickEverySixteenths = _niceSixteenthInterval(
      sixteenthPx,
      minSpacingPx: 3,
    );
    final labelEveryInches = _niceInchInterval(
      pxPerDrawingInch,
      minSpacingPx: 42,
    );

    for (
      var sixteenths = 0;
      left + sixteenths * sixteenthPx <= right;
      sixteenths += tickEverySixteenths
    ) {
      final x = left + sixteenths * sixteenthPx;
      final isInch = sixteenths % 16 == 0;
      final isHalfInch = sixteenths % 8 == 0;
      final isQuarterInch = sixteenths % 4 == 0;
      final tickTop = isInch
          ? topY
          : isHalfInch
          ? topY + 6
          : isQuarterInch
          ? topY + 11
          : topY + 16;

      canvas.drawLine(
        Offset(x, tickTop),
        Offset(x, bottomY),
        isInch
            ? majorPaint
            : isQuarterInch
            ? mediumPaint
            : minorPaint,
      );

      final inches = sixteenths ~/ 16;
      if (isInch && inches % labelEveryInches == 0) {
        _paintLabel(canvas, '$inches"', x, bottomY + 4, left, right);
      }
    }
  }

  int _niceFootInterval(double footPx, {required double minSpacingPx}) {
    const candidates = <int>[1, 2, 4, 5, 8, 10, 16, 20, 25, 50, 100];
    for (final candidate in candidates) {
      if (candidate * footPx >= minSpacingPx) return candidate;
    }
    return candidates.last;
  }

  int _niceSixteenthInterval(
    double sixteenthPx, {
    required double minSpacingPx,
  }) {
    const candidates = <int>[1, 2, 4, 8, 16, 32, 64];
    for (final candidate in candidates) {
      if (candidate * sixteenthPx >= minSpacingPx) return candidate;
    }
    return candidates.last;
  }

  int _niceInchInterval(double inchPx, {required double minSpacingPx}) {
    const candidates = <int>[1, 2, 4, 6, 12, 24, 48];
    for (final candidate in candidates) {
      if (candidate * inchPx >= minSpacingPx) return candidate;
    }
    return candidates.last;
  }

  void _paintLabel(
    Canvas canvas,
    String label,
    double centerX,
    double y,
    double left,
    double right,
  ) {
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: color.withValues(alpha: 0.96),
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final tx = (centerX - tp.width / 2)
        .clamp(left, right - tp.width)
        .toDouble();
    tp.paint(canvas, Offset(tx, y));
  }

  @override
  bool shouldRepaint(covariant _RulerTicksPainter old) =>
      old.scale != scale ||
      old.pxPerDrawingInch != pxPerDrawingInch ||
      old.color != color;
}
