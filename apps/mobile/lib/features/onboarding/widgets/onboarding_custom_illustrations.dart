import 'dart:math' as math;

import 'package:flutter/material.dart';

// ---------------------------------------------------------------------------
// MultiStopIllustration
// ---------------------------------------------------------------------------

/// A route with multiple destination pins — line-art style.
/// Represents batch/multi-destination delivery.
class MultiStopIllustration extends StatelessWidget {
  const MultiStopIllustration({
    super.key,
    this.size = 120,
    this.color = const Color(0xFF1A1A1A),
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _MultiStopPainter(color: color)),
    );
  }
}

class _MultiStopPainter extends CustomPainter {
  _MultiStopPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.013
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final dotPaint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;

    // Three stop positions
    final stop1 = Offset(s * 0.18, s * 0.65);
    final stop2 = Offset(s * 0.50, s * 0.30);
    final stop3 = Offset(s * 0.82, s * 0.55);

    // Dashed route path connecting stops
    final routePath = Path()
      ..moveTo(stop1.dx, stop1.dy)
      ..quadraticBezierTo(s * 0.30, s * 0.35, stop2.dx, stop2.dy)
      ..quadraticBezierTo(s * 0.70, s * 0.25, stop3.dx, stop3.dy);

    final dashPaint = Paint()
      ..color = color.withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.010
      ..strokeCap = StrokeCap.round;

    // Draw dashed route
    final metrics = routePath.computeMetrics();
    for (final metric in metrics) {
      final length = metric.length;
      final dashLen = s * 0.025;
      final gapLen = s * 0.018;
      var d = 0.0;
      while (d < length) {
        final end = math.min(d + dashLen, length);
        final segment = metric.extractPath(d, end);
        canvas.drawPath(segment, dashPaint);
        d += dashLen + gapLen;
      }
    }

    // Origin circle (shop) at stop1
    canvas.drawCircle(stop1, s * 0.04, paint);
    canvas.drawCircle(stop1, s * 0.016, dotPaint);

    // Numbered stop pins
    _drawPin(canvas, stop2, s, paint, dotPaint, '1');
    _drawPin(canvas, stop3, s, paint, dotPaint, '2');

    // Small "A" label at origin
    final labelStyle = TextStyle(
      fontFamily: 'Satoshi',
      fontSize: s * 0.06,
      fontWeight: FontWeight.w700,
      color: color.withValues(alpha: 0.5),
    );
    final tp = TextPainter(
      text: TextSpan(text: 'A', style: labelStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(stop1.dx - tp.width / 2, stop1.dy + s * 0.06));

    // Sparkle dots for character
    final sparklePaint = Paint()
      ..color = color.withValues(alpha: 0.2)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(Offset(s * 0.35, s * 0.18), s * 0.010, sparklePaint);
    canvas.drawCircle(Offset(s * 0.65, s * 0.15), s * 0.008, sparklePaint);
    canvas.drawCircle(Offset(s * 0.75, s * 0.35), s * 0.006, sparklePaint);
  }

  void _drawPin(Canvas canvas, Offset pos, double s, Paint paint,
      Paint dotPaint, String label) {
    final pinR = s * 0.045;
    final pinPath = Path();
    pinPath.moveTo(pos.dx, pos.dy + pinR * 0.3);
    pinPath.quadraticBezierTo(
      pos.dx - pinR * 0.8, pos.dy - pinR * 0.3,
      pos.dx - pinR * 0.6, pos.dy - pinR * 1.1,
    );
    pinPath.arcToPoint(
      Offset(pos.dx + pinR * 0.6, pos.dy - pinR * 1.1),
      radius: Radius.circular(pinR * 0.7),
      clockwise: true,
    );
    pinPath.quadraticBezierTo(
      pos.dx + pinR * 0.8, pos.dy - pinR * 0.3,
      pos.dx, pos.dy + pinR * 0.3,
    );
    canvas.drawPath(pinPath, paint);

    // Number inside pin
    final numStyle = TextStyle(
      fontFamily: 'Satoshi',
      fontSize: s * 0.05,
      fontWeight: FontWeight.w700,
      color: color,
    );
    final tp = TextPainter(
      text: TextSpan(text: label, style: numStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(pos.dx - tp.width / 2, pos.dy - pinR * 1.15));
  }

  @override
  bool shouldRepaint(_MultiStopPainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// NotificationBellIllustration
// ---------------------------------------------------------------------------

/// A notification bell with signal waves — line-art.
/// Used for the "enable notifications" onboarding page.
class NotificationBellIllustration extends StatelessWidget {
  const NotificationBellIllustration({
    super.key,
    this.size = 120,
    this.color = const Color(0xFF1A1A1A),
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _NotificationBellPainter(color: color)),
    );
  }
}

class _NotificationBellPainter extends CustomPainter {
  _NotificationBellPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.015
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final cx = size.width / 2;
    final cy = size.height / 2;

    // Bell body
    final bellPath = Path();
    final bellTop = cy - s * 0.22;
    final bellBottom = cy + s * 0.14;
    final bellW = s * 0.18;

    // Left side
    bellPath.moveTo(cx - s * 0.24, bellBottom);
    bellPath.lineTo(cx - bellW, bellBottom);
    bellPath.quadraticBezierTo(
      cx - bellW, bellTop + s * 0.04,
      cx - bellW * 0.5, bellTop,
    );

    // Top curve
    bellPath.quadraticBezierTo(cx, bellTop - s * 0.06, cx + bellW * 0.5, bellTop);

    // Right side
    bellPath.quadraticBezierTo(
      cx + bellW, bellTop + s * 0.04,
      cx + bellW, bellBottom,
    );
    bellPath.lineTo(cx + s * 0.24, bellBottom);

    canvas.drawPath(bellPath, paint);

    // Bell clapper (bottom arc)
    final clapperPath = Path();
    clapperPath.addArc(
      Rect.fromCenter(
        center: Offset(cx, bellBottom + s * 0.02),
        width: s * 0.10,
        height: s * 0.10,
      ),
      0,
      math.pi,
    );
    canvas.drawPath(clapperPath, Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.012
      ..strokeCap = StrokeCap.round);

    // Top nub (handle)
    canvas.drawCircle(Offset(cx, bellTop - s * 0.06), s * 0.025, paint);
    canvas.drawCircle(
      Offset(cx, bellTop - s * 0.06),
      s * 0.010,
      Paint()..color = color..style = PaintingStyle.fill,
    );

    // Signal waves (right side)
    for (var i = 1; i <= 3; i++) {
      final waveR = s * 0.06 * i;
      canvas.drawArc(
        Rect.fromCenter(
          center: Offset(cx + s * 0.26, cy - s * 0.08),
          width: waveR,
          height: waveR,
        ),
        -math.pi * 0.35,
        math.pi * 0.7,
        false,
        Paint()
          ..color = color.withValues(alpha: 0.35 - (i * 0.08))
          ..style = PaintingStyle.stroke
          ..strokeWidth = s * 0.008
          ..strokeCap = StrokeCap.round,
      );
    }

    // Notification dot (accent)
    canvas.drawCircle(
      Offset(cx + s * 0.18, bellTop - s * 0.02),
      s * 0.030,
      Paint()..color = color..style = PaintingStyle.fill,
    );
    canvas.drawCircle(
      Offset(cx + s * 0.18, bellTop - s * 0.02),
      s * 0.030,
      Paint()
        ..color = color.withValues(alpha: 0.15)
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.020,
    );
  }

  @override
  bool shouldRepaint(_NotificationBellPainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// GpsLocationIllustration
// ---------------------------------------------------------------------------

/// A GPS/compass with signal rings — line-art.
/// Used for the "enable location" onboarding page.
class GpsLocationIllustration extends StatelessWidget {
  const GpsLocationIllustration({
    super.key,
    this.size = 120,
    this.color = const Color(0xFF1A1A1A),
  });

  final double size;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(painter: _GpsLocationPainter(color: color)),
    );
  }
}

class _GpsLocationPainter extends CustomPainter {
  _GpsLocationPainter({required this.color});
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final s = size.shortestSide;
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.015
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final cx = size.width / 2;
    final cy = size.height / 2;
    final mainR = s * 0.22;

    // Outer circle
    canvas.drawCircle(Offset(cx, cy), mainR, paint);

    // Inner circle
    canvas.drawCircle(Offset(cx, cy), mainR * 0.45, paint);

    // Center dot
    canvas.drawCircle(
      Offset(cx, cy),
      s * 0.025,
      Paint()..color = color..style = PaintingStyle.fill,
    );

    // Crosshair lines
    final crossPaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.012
      ..strokeCap = StrokeCap.round;

    // Top
    canvas.drawLine(
      Offset(cx, cy - mainR - s * 0.06),
      Offset(cx, cy - mainR + s * 0.03),
      crossPaint,
    );
    // Bottom
    canvas.drawLine(
      Offset(cx, cy + mainR - s * 0.03),
      Offset(cx, cy + mainR + s * 0.06),
      crossPaint,
    );
    // Left
    canvas.drawLine(
      Offset(cx - mainR - s * 0.06, cy),
      Offset(cx - mainR + s * 0.03, cy),
      crossPaint,
    );
    // Right
    canvas.drawLine(
      Offset(cx + mainR - s * 0.03, cy),
      Offset(cx + mainR + s * 0.06, cy),
      crossPaint,
    );

    // Location pulse rings
    for (var i = 1; i <= 2; i++) {
      canvas.drawCircle(
        Offset(cx, cy),
        mainR + s * 0.08 * i,
        Paint()
          ..color = color.withValues(alpha: 0.12 / i)
          ..style = PaintingStyle.stroke
          ..strokeWidth = s * 0.006
          ..strokeCap = StrokeCap.round,
      );
    }

    // Compass arrow (north)
    final arrowPath = Path()
      ..moveTo(cx, cy - mainR * 0.45 + s * 0.02)
      ..lineTo(cx - s * 0.025, cy - mainR * 0.15)
      ..lineTo(cx + s * 0.025, cy - mainR * 0.15)
      ..close();
    canvas.drawPath(arrowPath, Paint()
      ..color = color.withValues(alpha: 0.4)
      ..style = PaintingStyle.fill);
  }

  @override
  bool shouldRepaint(_GpsLocationPainter old) => old.color != color;
}
