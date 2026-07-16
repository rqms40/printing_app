import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';

const double _mmPerInch = 25.4;
const double _bandHeight = 76;
const double _dialRadius = 30;
const double _controlsGap = 10;
const double _controlsHeight = 42;

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

/// Snaps [angle] (radians) to the nearest multiple of 45° when within
/// [toleranceDegrees] of it; otherwise returns [angle] unchanged.
double snapRulerAngle(double angle, {double toleranceDegrees = 2.5}) {
  const step = math.pi / 4;
  final nearest = (angle / step).roundToDouble() * step;
  final deltaDegrees = ((angle - nearest).abs() * 180 / math.pi);
  return deltaDegrees <= toleranceDegrees ? nearest : angle;
}

/// A full-span, draggable and rotatable architect scale overlay.
///
/// The translucent band always spans past the viewport edges (its length is
/// twice the viewport diagonal), so rotating it never leaves the screen
/// half-covered. Ticks are calibrated against the fitted document bounds and
/// radiate from the centre dial: park the dial on one edge of a feature and
/// read the distance at the other.
///
/// Interactions: drag the band to move it, drag the dial (one finger) or
/// twist with two fingers to rotate, double-tap to reset.
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
  bool _snapped = false;

  // The centre may roam the whole viewport; only a small nominal grab size
  // keeps it on-screen. The band itself always extends past the edges.
  static const Size _nominalGrabSize = Size(_dialRadius * 2, _dialRadius * 2);

  void _applyAngle(double rawAngle) {
    final snapped = snapRulerAngle(rawAngle);
    final isSnap = snapped != rawAngle;
    if (isSnap && !_snapped) HapticFeedback.selectionClick();
    _snapped = isSnap;
    _angle = snapped;
  }

  void _reset(Offset initialCenter, Size bounds) {
    setState(() {
      _angle = 0;
      _snapped = false;
      _center = clampRulerCenter(
        center: initialCenter,
        bounds: bounds,
        rulerSize: _nominalGrabSize,
      );
    });
  }

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

        // Long enough to cross the viewport at any rotation angle.
        final diagonal = math.sqrt(
          size.width * size.width + size.height * size.height,
        );
        final bandLength = math.max(240.0, diagonal * 2);

        // The rotated group is symmetric around the band centre so rotation
        // needs no origin correction: dead space above mirrors the controls
        // strip below and stays hit-transparent.
        const wing = _controlsGap + _controlsHeight;
        const groupHeight = _bandHeight + 2 * wing;

        final initialCenter = drawingRect.isEmpty
            ? size.center(Offset.zero)
            : drawingRect.center;
        _center = clampRulerCenter(
          center: _center ?? initialCenter,
          bounds: size,
          rulerSize: _nominalGrabSize,
        );
        final center = _center!;

        final angleDegrees = (_angle * 180 / math.pi).remainder(360.0);

        return Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              left: center.dx - bandLength / 2,
              top: center.dy - groupHeight / 2,
              width: bandLength,
              height: groupHeight,
              child: Transform.rotate(
                angle: _angle,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // ── Translucent measuring band ──────────────────────
                    Positioned(
                      left: 0,
                      right: 0,
                      top: wing,
                      height: _bandHeight,
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onScaleStart: (details) {
                          _angleStart = _angle;
                          _centerStart = center;
                          _focalPointStart = details.focalPoint;
                        },
                        onScaleUpdate: (details) {
                          setState(() {
                            _center = rulerCenterForGesture(
                              startCenter: _centerStart,
                              startFocalPoint: _focalPointStart,
                              currentFocalPoint: details.focalPoint,
                              bounds: size,
                              rulerSize: _nominalGrabSize,
                            );
                            _applyAngle(_angleStart + details.rotation);
                          });
                        },
                        onDoubleTap: () => _reset(initialCenter, size),
                        child: CustomPaint(
                          painter: _RulerTicksPainter(
                            scale: widget.scale,
                            pxPerDrawingInch: pxPerDrawingInch,
                            brand: brand,
                            dialClearance: _dialRadius + 14,
                          ),
                        ),
                      ),
                    ),

                    // ── Rotation dial (drag with one finger) ────────────
                    Positioned(
                      left: bandLength / 2 - _dialRadius,
                      top: groupHeight / 2 - _dialRadius,
                      width: _dialRadius * 2,
                      height: _dialRadius * 2,
                      child: _RotationDial(
                        brand: brand,
                        angle: _angle,
                        angleLabel: '${angleDegrees.toStringAsFixed(0)}°',
                        onRotateBy: (delta) {
                          setState(() => _applyAngle(_angle + delta));
                        },
                        onDoubleTap: () => _reset(initialCenter, size),
                      ),
                    ),

                    // ── Controls strip riding under the band ────────────
                    Positioned(
                      left: 0,
                      right: 0,
                      top: wing + _bandHeight + _controlsGap,
                      height: _controlsHeight,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _ResetPill(
                            brand: brand,
                            onReset: () => _reset(initialCenter, size),
                          ),
                          const SizedBox(width: 8),
                          _ScaleChip(
                            brand: brand,
                            scale: widget.scale,
                            onCycleScale: widget.onCycleScale,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _RotationDial extends StatelessWidget {
  const _RotationDial({
    required this.brand,
    required this.angle,
    required this.angleLabel,
    required this.onRotateBy,
    required this.onDoubleTap,
  });

  final Color brand;
  final double angle;
  final String angleLabel;
  final ValueChanged<double> onRotateBy;
  final VoidCallback onDoubleTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Rotate ruler',
      value: angleLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onDoubleTap: onDoubleTap,
        onPanUpdate: (details) {
          // Angular delta from the pan, computed in the dial's own (rotated)
          // frame: cross(r, d) / |r|² is invariant under the band's rotation.
          final local = details.localPosition;
          final r = local - const Offset(_dialRadius, _dialRadius);
          final r2 = r.distanceSquared;
          if (r2 < 16) return;
          final delta = (r.dx * details.delta.dy - r.dy * details.delta.dx) / r2;
          onRotateBy(delta);
        },
        child: CustomPaint(
          painter: _DialPainter(brand: brand, angle: angle),
          child: Center(
            child: Transform.rotate(
              // Keep the readout upright while the band rotates.
              angle: -angle,
              child: Text(
                angleLabel,
                style: AppTypography.caption.copyWith(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  height: 1,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _DialPainter extends CustomPainter {
  _DialPainter({required this.brand, required this.angle});

  final Color brand;
  final double angle;

  @override
  void paint(Canvas canvas, Size size) {
    final c = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;

    canvas.drawCircle(
      c,
      radius,
      Paint()..color = const Color(0xFF171717).withValues(alpha: 0.94),
    );
    canvas.drawCircle(
      c,
      radius - 0.75,
      Paint()
        ..color = brand
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.5,
    );

    // Protractor ring: minute marks that spin with the ruler so rotation is
    // visible even between the 1° readout steps.
    final tickPaint = Paint()
      ..color = brand.withValues(alpha: 0.85)
      ..strokeWidth = 1.2;
    for (var i = 0; i < 24; i++) {
      final a = angle * 0 + i * math.pi / 12; // marks live in dial frame
      final isCardinal = i % 6 == 0;
      final outer = radius - 3.5;
      final inner = outer - (isCardinal ? 6.5 : 3.5);
      canvas.drawLine(
        c + Offset(math.cos(a), math.sin(a)) * inner,
        c + Offset(math.cos(a), math.sin(a)) * outer,
        isCardinal ? tickPaint : (Paint()
          ..color = brand.withValues(alpha: 0.4)
          ..strokeWidth = 1),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _DialPainter old) =>
      old.brand != brand || old.angle != angle;
}

class _ResetPill extends StatelessWidget {
  const _ResetPill({required this.brand, required this.onReset});

  final Color brand;
  final VoidCallback onReset;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFF171717).withValues(alpha: 0.92),
      borderRadius: BorderRadius.circular(21),
      child: InkWell(
        onTap: onReset,
        borderRadius: BorderRadius.circular(21),
        child: Tooltip(
          message: 'Reset ruler',
          child: SizedBox(
            width: _controlsHeight,
            height: _controlsHeight,
            child: Icon(Icons.restart_alt_rounded, size: 19, color: brand),
          ),
        ),
      ),
    );
  }
}

class _ScaleChip extends StatelessWidget {
  const _ScaleChip({
    required this.brand,
    required this.scale,
    required this.onCycleScale,
  });

  final Color brand;
  final ArchitectScale scale;
  final VoidCallback? onCycleScale;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: brand,
      borderRadius: BorderRadius.circular(21),
      child: InkWell(
        onTap: onCycleScale,
        borderRadius: BorderRadius.circular(21),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                scale.label,
                maxLines: 1,
                style: AppTypography.caption.copyWith(
                  color: const Color(0xFF111111),
                  fontSize: 13,
                  fontWeight: FontWeight.w900,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 1),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Document-calibrated',
                    style: _chipCaptionStyle,
                  ),
                  Text(' · ', style: _chipCaptionStyle),
                  Text(
                    'Tap to change',
                    style: _chipCaptionStyle,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  static final TextStyle _chipCaptionStyle = AppTypography.caption.copyWith(
    color: const Color(0xFF111111).withValues(alpha: 0.72),
    fontSize: 8.5,
    fontWeight: FontWeight.w800,
    height: 1.0,
  );
}

class _RulerTicksPainter extends CustomPainter {
  _RulerTicksPainter({
    required this.scale,
    required this.pxPerDrawingInch,
    required this.brand,
    required this.dialClearance,
  });

  final ArchitectScale scale;
  final double pxPerDrawingInch;
  final Color brand;

  /// Half-width of the centre zone kept free of labels (dial sits there).
  final double dialClearance;

  @override
  void paint(Canvas canvas, Size size) {
    final bandFill = Paint()
      ..color = Colors.black.withValues(alpha: 0.55)
      ..style = PaintingStyle.fill;
    canvas.drawRect(Offset.zero & size, bandFill);

    final edgePaint = Paint()
      ..color = brand.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    canvas.drawLine(const Offset(0, 0.5), Offset(size.width, 0.5), edgePaint);
    canvas.drawLine(
      Offset(0, size.height - 0.5),
      Offset(size.width, size.height - 0.5),
      edgePaint,
    );

    if (pxPerDrawingInch <= 0 || scale.inchesPerFoot <= 0) return;

    if (scale.isFullSize) {
      _paintFullSizeTicks(canvas, size);
    } else {
      _paintFootTicks(canvas, size);
    }
  }

  static const double _majorTickLen = 17;
  static const double _mediumTickLen = 12;
  static const double _minorTickLen = 7;

  Paint get _majorPaint => Paint()
    ..color = Colors.white.withValues(alpha: 0.92)
    ..strokeWidth = 1.4;
  Paint get _mediumPaint => Paint()
    ..color = Colors.white.withValues(alpha: 0.62)
    ..strokeWidth = 1.0;
  Paint get _minorPaint => Paint()
    ..color = Colors.white.withValues(alpha: 0.32)
    ..strokeWidth = 0.8;

  /// Draws one tick mirrored on both band edges.
  void _tick(Canvas canvas, Size size, double x, double length, Paint paint) {
    canvas.drawLine(Offset(x, 0), Offset(x, length), paint);
    canvas.drawLine(
      Offset(x, size.height - length),
      Offset(x, size.height),
      paint,
    );
  }

  void _paintFootTicks(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final footPx = pixelsForRealFeet(
      scale: scale,
      realFeet: 1,
      pxPerDrawingInch: pxPerDrawingInch,
    );
    if (footPx <= 0) return;

    final tickEveryFeet = _niceFootInterval(footPx, minSpacingPx: 8);
    final labelEveryFeet = _niceFootInterval(footPx, minSpacingPx: 46);
    final inchPx = footPx / 12;
    final drawInchMinors = inchPx >= 4 && footPx >= 28;

    for (final direction in const [1, -1]) {
      for (var feet = 0; ; feet += tickEveryFeet) {
        final x = cx + direction * feet * footPx;
        if (x < 0 || x > size.width) break;
        if (direction == -1 && feet == 0) continue;

        final isLabelTick = feet % labelEveryFeet == 0;
        _tick(
          canvas,
          size,
          x,
          isLabelTick ? _majorTickLen : _mediumTickLen,
          isLabelTick ? _majorPaint : _mediumPaint,
        );
        if (isLabelTick && (x - cx).abs() > dialClearance) {
          _paintLabel(canvas, size, '$feet\'', x);
        }

        if (drawInchMinors) {
          for (var inch = 1; inch < 12 * tickEveryFeet; inch++) {
            final ix = x + direction * inch * inchPx;
            if (ix < 0 || ix > size.width) break;
            final isHalfFoot = inch % 6 == 0;
            _tick(
              canvas,
              size,
              ix,
              isHalfFoot ? _mediumTickLen : _minorTickLen,
              isHalfFoot ? _mediumPaint : _minorPaint,
            );
          }
        }
      }
    }
  }

  void _paintFullSizeTicks(Canvas canvas, Size size) {
    final cx = size.width / 2;
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
      minSpacingPx: 46,
    );

    for (final direction in const [1, -1]) {
      for (var sixteenths = 0; ; sixteenths += tickEverySixteenths) {
        final x = cx + direction * sixteenths * sixteenthPx;
        if (x < 0 || x > size.width) break;
        if (direction == -1 && sixteenths == 0) continue;

        final isInch = sixteenths % 16 == 0;
        final isHalfInch = sixteenths % 8 == 0;
        final isQuarterInch = sixteenths % 4 == 0;
        _tick(
          canvas,
          size,
          x,
          isInch
              ? _majorTickLen
              : isHalfInch
              ? _mediumTickLen
              : _minorTickLen,
          isInch
              ? _majorPaint
              : isQuarterInch
              ? _mediumPaint
              : _minorPaint,
        );

        final inches = sixteenths ~/ 16;
        if (isInch &&
            inches % labelEveryInches == 0 &&
            (x - cx).abs() > dialClearance) {
          _paintLabel(canvas, size, '$inches"', x);
        }
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

  void _paintLabel(Canvas canvas, Size size, String label, double centerX) {
    final tp = TextPainter(
      text: TextSpan(
        text: label,
        style: TextStyle(
          color: brand.withValues(alpha: 0.96),
          fontSize: 11,
          fontWeight: FontWeight.w800,
        ),
      ),
      textDirection: TextDirection.ltr,
    )..layout();
    final tx = (centerX - tp.width / 2).clamp(0.0, size.width - tp.width);
    tp.paint(canvas, Offset(tx, (size.height - tp.height) / 2));
  }

  @override
  bool shouldRepaint(covariant _RulerTicksPainter old) =>
      old.scale != scale ||
      old.pxPerDrawingInch != pxPerDrawingInch ||
      old.brand != brand ||
      old.dialClearance != dialClearance;
}
