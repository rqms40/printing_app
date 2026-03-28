import 'dart:math' as math;

import 'package:flutter/material.dart';

// ---------------------------------------------------------------------------
// PrinterIllustration
// ---------------------------------------------------------------------------

/// A stylized printer with paper emerging — editorial line-art style.
/// Used in hero banners and empty states.
class PrinterIllustration extends StatelessWidget {
  const PrinterIllustration({
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
      child: CustomPaint(painter: _PrinterPainter(color: color)),
    );
  }
}

class _PrinterPainter extends CustomPainter {
  _PrinterPainter({required this.color});
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

    // Center offsets
    final cx = size.width / 2;
    final cy = size.height / 2;

    // -- Printer body: rounded rectangle --
    final bodyW = s * 0.58;
    final bodyH = s * 0.28;
    final bodyRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx, cy + s * 0.08),
        width: bodyW,
        height: bodyH,
      ),
      Radius.circular(s * 0.04),
    );
    canvas.drawRRect(bodyRect, paint);

    // -- Paper tray (bottom) --
    final trayW = s * 0.44;
    final trayH = s * 0.10;
    final trayRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx, cy + s * 0.28),
        width: trayW,
        height: trayH,
      ),
      Radius.circular(s * 0.025),
    );
    canvas.drawRRect(trayRect, paint);

    // -- Paper emerging from top, slightly tilted --
    final paperPath = Path();
    final paperLeft = cx - s * 0.18;
    final paperRight = cx + s * 0.16;
    final paperTop = cy - s * 0.34;
    final paperBottom = cy - s * 0.06;

    // Slight tilt via transform
    canvas.save();
    canvas.translate(cx, paperBottom);
    canvas.rotate(-0.04); // subtle tilt
    canvas.translate(-cx, -paperBottom);

    paperPath.moveTo(paperLeft, paperBottom);
    paperPath.lineTo(paperLeft, paperTop + s * 0.03);
    // Subtle curl at top-left corner
    paperPath.quadraticBezierTo(
      paperLeft + s * 0.01,
      paperTop,
      paperLeft + s * 0.04,
      paperTop,
    );
    paperPath.lineTo(paperRight - s * 0.04, paperTop);
    paperPath.quadraticBezierTo(
      paperRight - s * 0.01,
      paperTop,
      paperRight,
      paperTop + s * 0.03,
    );
    paperPath.lineTo(paperRight, paperBottom);
    canvas.drawPath(paperPath, paint);

    // -- Printed content lines on paper --
    final linePaint = Paint()
      ..color = color.withValues(alpha: 0.45)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.008
      ..strokeCap = StrokeCap.round;

    for (var i = 0; i < 4; i++) {
      final ly = paperTop + s * 0.08 + i * s * 0.05;
      final lx1 = paperLeft + s * 0.05;
      final lx2 = paperRight - s * 0.05 - (i == 2 ? s * 0.08 : 0);
      canvas.drawLine(Offset(lx1, ly), Offset(lx2, ly), linePaint);
    }

    canvas.restore();

    // -- Decorative dot at printer front --
    canvas.drawCircle(
      Offset(cx + s * 0.20, cy + s * 0.04),
      s * 0.018,
      dotPaint,
    );

    // -- Small status indicator dot --
    canvas.drawCircle(
      Offset(cx + s * 0.15, cy + s * 0.04),
      s * 0.010,
      Paint()
        ..color = color.withValues(alpha: 0.35)
        ..style = PaintingStyle.fill,
    );
  }

  @override
  bool shouldRepaint(_PrinterPainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// ThreeDCubeIllustration
// ---------------------------------------------------------------------------

/// A wireframe isometric 3D cube — editorial line-art.
/// Used in 3D printing category cards and empty states.
class ThreeDCubeIllustration extends StatelessWidget {
  const ThreeDCubeIllustration({
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
      child: CustomPaint(painter: _ThreeDCubePainter(color: color)),
    );
  }
}

class _ThreeDCubePainter extends CustomPainter {
  _ThreeDCubePainter({required this.color});
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

    final cx = size.width / 2;
    final cy = size.height / 2;
    final edge = s * 0.32;

    // Isometric angles
    const angle = math.pi / 6; // 30 degrees
    final dx = edge * math.cos(angle);
    final dy = edge * math.sin(angle);

    // 8 vertices of an isometric cube
    // Top face
    final top = Offset(cx, cy - edge * 0.6);
    final topRight = Offset(cx + dx, cy - edge * 0.6 + dy);
    final topLeft = Offset(cx - dx, cy - edge * 0.6 + dy);
    final topCenter = Offset(cx, cy - edge * 0.6 + 2 * dy);

    // Bottom face (shifted down by edge)
    final botTop = Offset(cx, cy + edge * 0.4 - 2 * dy);
    final botRight = Offset(cx + dx, cy + edge * 0.4 - dy);
    final botLeft = Offset(cx - dx, cy + edge * 0.4 - dy);
    final bottom = Offset(cx, cy + edge * 0.4);

    // Top face
    canvas.drawLine(top, topRight, paint);
    canvas.drawLine(top, topLeft, paint);
    canvas.drawLine(topRight, topCenter, paint);
    canvas.drawLine(topLeft, topCenter, paint);

    // Vertical edges
    canvas.drawLine(top, botTop, paint);
    canvas.drawLine(topRight, botRight, paint);
    canvas.drawLine(topLeft, botLeft, paint);
    canvas.drawLine(topCenter, bottom, paint);

    // Bottom face
    canvas.drawLine(botTop, botRight, paint);
    canvas.drawLine(botTop, botLeft, paint);
    canvas.drawLine(botRight, bottom, paint);
    canvas.drawLine(botLeft, bottom, paint);

    // Vertex dots
    final dotR = s * 0.018;
    for (final p in [
      top,
      topRight,
      topLeft,
      topCenter,
      botTop,
      botRight,
      botLeft,
      bottom,
    ]) {
      canvas.drawCircle(p, dotR, dotPaint);
    }

    // Construction lines (subtle diagonals)
    final conPaint = Paint()
      ..color = color.withValues(alpha: 0.15)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.006
      ..strokeCap = StrokeCap.round;

    canvas.drawLine(top, bottom, conPaint);
    canvas.drawLine(topLeft, botRight, conPaint);
    canvas.drawLine(topRight, botLeft, conPaint);
  }

  @override
  bool shouldRepaint(_ThreeDCubePainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// DeliveryIllustration
// ---------------------------------------------------------------------------

/// A stylized delivery route with dotted path, origin, and destination.
/// Used in driver screens and tracking empty states.
class DeliveryIllustration extends StatelessWidget {
  const DeliveryIllustration({
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
      child: CustomPaint(painter: _DeliveryPainter(color: color)),
    );
  }
}

class _DeliveryPainter extends CustomPainter {
  _DeliveryPainter({required this.color});
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

    // Route: curved dotted line from left to right
    final routeStart = Offset(s * 0.15, s * 0.55);
    final routeEnd = Offset(s * 0.85, s * 0.45);
    final cp1 = Offset(s * 0.35, s * 0.25);
    final cp2 = Offset(s * 0.65, s * 0.75);

    // Draw dotted route
    final routePath = Path()
      ..moveTo(routeStart.dx, routeStart.dy)
      ..cubicTo(cp1.dx, cp1.dy, cp2.dx, cp2.dy, routeEnd.dx, routeEnd.dy);

    final dashPaint = Paint()
      ..color = color.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.010
      ..strokeCap = StrokeCap.round;

    // Manually dash the route
    final metrics = routePath.computeMetrics();
    for (final metric in metrics) {
      final length = metric.length;
      final dashLen = s * 0.025;
      final gapLen = s * 0.020;
      var d = 0.0;
      while (d < length) {
        final end = math.min(d + dashLen, length);
        final segment = metric.extractPath(d, end);
        canvas.drawPath(segment, dashPaint);
        d += dashLen + gapLen;
      }
    }

    // Origin circle (shop)
    canvas.drawCircle(routeStart, s * 0.035, paint);
    canvas.drawCircle(routeStart, s * 0.015, dotPaint);

    // Destination pin
    final pinTip = routeEnd;
    final pinPath = Path();
    final pinR = s * 0.05;
    pinPath.moveTo(pinTip.dx, pinTip.dy + pinR * 0.3);
    pinPath.quadraticBezierTo(
      pinTip.dx - pinR * 0.8,
      pinTip.dy - pinR * 0.3,
      pinTip.dx - pinR * 0.6,
      pinTip.dy - pinR * 1.1,
    );
    pinPath.arcToPoint(
      Offset(pinTip.dx + pinR * 0.6, pinTip.dy - pinR * 1.1),
      radius: Radius.circular(pinR * 0.7),
      clockwise: true,
    );
    pinPath.quadraticBezierTo(
      pinTip.dx + pinR * 0.8,
      pinTip.dy - pinR * 0.3,
      pinTip.dx,
      pinTip.dy + pinR * 0.3,
    );
    canvas.drawPath(pinPath, paint);
    canvas.drawCircle(
      Offset(pinTip.dx, pinTip.dy - pinR * 0.65),
      s * 0.015,
      dotPaint,
    );

    // Tiny package icon along the route (at ~40% of path)
    for (final metric in routePath.computeMetrics()) {
      final pos = metric.getTangentForOffset(metric.length * 0.4);
      if (pos != null) {
        final pkgCenter = pos.position;
        final pkgSize = s * 0.05;
        final pkgRect = RRect.fromRectAndRadius(
          Rect.fromCenter(center: pkgCenter, width: pkgSize, height: pkgSize * 0.75),
          Radius.circular(s * 0.008),
        );
        canvas.drawRRect(pkgRect, paint);
        // Tape line across package
        canvas.drawLine(
          Offset(pkgCenter.dx, pkgCenter.dy - pkgSize * 0.375),
          Offset(pkgCenter.dx, pkgCenter.dy + pkgSize * 0.375),
          Paint()
            ..color = color.withValues(alpha: 0.35)
            ..style = PaintingStyle.stroke
            ..strokeWidth = s * 0.006
            ..strokeCap = StrokeCap.round,
        );
      }
    }

    // Shadow line beneath pin
    canvas.drawLine(
      Offset(pinTip.dx - s * 0.03, pinTip.dy + pinR * 0.5),
      Offset(pinTip.dx + s * 0.03, pinTip.dy + pinR * 0.5),
      Paint()
        ..color = color.withValues(alpha: 0.2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.008
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_DeliveryPainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// EmptyBoxIllustration
// ---------------------------------------------------------------------------

/// An open, empty box in perspective — thin strokes, no fill.
/// Used as the default generic empty state illustration.
class EmptyBoxIllustration extends StatelessWidget {
  const EmptyBoxIllustration({
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
      child: CustomPaint(painter: _EmptyBoxPainter(color: color)),
    );
  }
}

class _EmptyBoxPainter extends CustomPainter {
  _EmptyBoxPainter({required this.color});
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

    final cx = size.width / 2;
    final cy = size.height / 2;

    // Isometric box body
    final top = Offset(cx, cy - s * 0.05);
    final right = Offset(cx + s * 0.28, cy + s * 0.08);
    final bottom = Offset(cx, cy + s * 0.32);
    final left = Offset(cx - s * 0.28, cy + s * 0.08);

    // Box body (bottom portion)
    final bodyPath = Path()
      ..moveTo(top.dx, top.dy)
      ..lineTo(right.dx, right.dy)
      ..lineTo(bottom.dx, bottom.dy)
      ..lineTo(left.dx, left.dy)
      ..close();
    canvas.drawPath(bodyPath, paint);

    // Center vertical line
    canvas.drawLine(top, bottom, Paint()
      ..color = color.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.008
      ..strokeCap = StrokeCap.round);

    // Open flaps
    final flapHeight = s * 0.16;

    // Left flap (open, tilted outward)
    final leftFlap = Path()
      ..moveTo(left.dx, left.dy)
      ..lineTo(top.dx, top.dy)
      ..lineTo(cx - s * 0.06, top.dy - flapHeight)
      ..lineTo(left.dx - s * 0.22, left.dy - flapHeight * 0.6);
    canvas.drawPath(leftFlap, paint);

    // Right flap (open, tilted outward)
    final rightFlap = Path()
      ..moveTo(right.dx, right.dy)
      ..lineTo(top.dx, top.dy)
      ..lineTo(cx + s * 0.06, top.dy - flapHeight)
      ..lineTo(right.dx + s * 0.22, right.dy - flapHeight * 0.6);
    canvas.drawPath(rightFlap, paint);

    // Sparkle dots for character
    final sparklePaint = Paint()
      ..color = color.withValues(alpha: 0.3)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(cx + s * 0.15, cy - s * 0.22), s * 0.012, sparklePaint);
    canvas.drawCircle(Offset(cx - s * 0.20, cy - s * 0.15), s * 0.008, sparklePaint);
    canvas.drawCircle(Offset(cx + s * 0.05, cy - s * 0.32), s * 0.010, sparklePaint);

    // Tiny sparkle lines
    final sparkleLine = Paint()
      ..color = color.withValues(alpha: 0.25)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.007
      ..strokeCap = StrokeCap.round;

    // Small cross sparkle
    final sc = Offset(cx - s * 0.12, cy - s * 0.28);
    canvas.drawLine(
      Offset(sc.dx - s * 0.02, sc.dy),
      Offset(sc.dx + s * 0.02, sc.dy),
      sparkleLine,
    );
    canvas.drawLine(
      Offset(sc.dx, sc.dy - s * 0.02),
      Offset(sc.dx, sc.dy + s * 0.02),
      sparkleLine,
    );
  }

  @override
  bool shouldRepaint(_EmptyBoxPainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// PaymentIllustration
// ---------------------------------------------------------------------------

/// A stylized wallet with card and peso sign.
/// Used on the payment screen.
class PaymentIllustration extends StatelessWidget {
  const PaymentIllustration({
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
      child: CustomPaint(painter: _PaymentPainter(color: color)),
    );
  }
}

class _PaymentPainter extends CustomPainter {
  _PaymentPainter({required this.color});
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

    final cx = size.width / 2;
    final cy = size.height / 2;

    // Wallet body
    final walletW = s * 0.56;
    final walletH = s * 0.38;
    final walletRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx, cy + s * 0.02),
        width: walletW,
        height: walletH,
      ),
      Radius.circular(s * 0.04),
    );
    canvas.drawRRect(walletRect, paint);

    // Wallet flap (top fold)
    final flapPath = Path()
      ..moveTo(cx - walletW / 2, cy - walletH / 2 + s * 0.02)
      ..quadraticBezierTo(
        cx - walletW / 2 - s * 0.02,
        cy - walletH / 2 - s * 0.06,
        cx - walletW / 2 + s * 0.06,
        cy - walletH / 2 - s * 0.08,
      )
      ..lineTo(cx + walletW / 2 - s * 0.06, cy - walletH / 2 - s * 0.08)
      ..quadraticBezierTo(
        cx + walletW / 2 + s * 0.02,
        cy - walletH / 2 - s * 0.06,
        cx + walletW / 2,
        cy - walletH / 2 + s * 0.02,
      );
    canvas.drawPath(flapPath, paint);

    // Card peeking out (tilted slightly)
    canvas.save();
    canvas.translate(cx + s * 0.08, cy - s * 0.02);
    canvas.rotate(0.12);
    canvas.translate(-(cx + s * 0.08), -(cy - s * 0.02));

    final cardW = s * 0.34;
    final cardH = s * 0.22;
    final cardRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx + s * 0.08, cy - s * 0.08),
        width: cardW,
        height: cardH,
      ),
      Radius.circular(s * 0.025),
    );
    canvas.drawRRect(cardRect, Paint()
      ..color = color.withValues(alpha: 0.5)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.010
      ..strokeCap = StrokeCap.round);

    // Card chip
    final chipRect = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(cx - s * 0.01, cy - s * 0.10),
        width: s * 0.06,
        height: s * 0.04,
      ),
      Radius.circular(s * 0.008),
    );
    canvas.drawRRect(chipRect, Paint()
      ..color = color.withValues(alpha: 0.4)
      ..style = PaintingStyle.stroke
      ..strokeWidth = s * 0.007
      ..strokeCap = StrokeCap.round);

    canvas.restore();

    // Peso sign (₱)
    final pesoStyle = TextStyle(
      fontFamily: 'Satoshi',
      fontSize: s * 0.14,
      fontWeight: FontWeight.w300,
      color: color.withValues(alpha: 0.35),
      letterSpacing: 0,
    );
    final tp = TextPainter(
      text: TextSpan(text: '\u20B1', style: pesoStyle),
      textDirection: TextDirection.ltr,
    )..layout();
    tp.paint(canvas, Offset(cx - tp.width / 2 - s * 0.14, cy + s * 0.04));

    // Clasp/button on right side
    canvas.drawCircle(
      Offset(cx + walletW / 2 - s * 0.01, cy + s * 0.02),
      s * 0.022,
      paint,
    );
    canvas.drawCircle(
      Offset(cx + walletW / 2 - s * 0.01, cy + s * 0.02),
      s * 0.008,
      Paint()..color = color..style = PaintingStyle.fill,
    );
  }

  @override
  bool shouldRepaint(_PaymentPainter old) => old.color != color;
}

// ---------------------------------------------------------------------------
// LocationPinIllustration
// ---------------------------------------------------------------------------

/// An elegant teardrop location pin — outline only with inner dot.
/// Used on address and delivery tracking screens.
class LocationPinIllustration extends StatelessWidget {
  const LocationPinIllustration({
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
      child: CustomPaint(painter: _LocationPinPainter(color: color)),
    );
  }
}

class _LocationPinPainter extends CustomPainter {
  _LocationPinPainter({required this.color});
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

    // Pin body (teardrop)
    final pinR = s * 0.18;
    final pinTip = Offset(cx, cy + s * 0.28);

    final pinPath = Path()
      ..moveTo(pinTip.dx, pinTip.dy)
      ..quadraticBezierTo(
        cx - pinR * 1.4,
        cy + s * 0.02,
        cx - pinR,
        cy - s * 0.08,
      )
      ..arcToPoint(
        Offset(cx + pinR, cy - s * 0.08),
        radius: Radius.circular(pinR),
        clockwise: true,
      )
      ..quadraticBezierTo(
        cx + pinR * 1.4,
        cy + s * 0.02,
        pinTip.dx,
        pinTip.dy,
      );

    canvas.drawPath(pinPath, paint);

    // Inner circle
    canvas.drawCircle(
      Offset(cx, cy - s * 0.06),
      s * 0.07,
      paint,
    );

    // Center dot
    canvas.drawCircle(
      Offset(cx, cy - s * 0.06),
      s * 0.025,
      Paint()..color = color..style = PaintingStyle.fill,
    );

    // Shadow line beneath
    canvas.drawLine(
      Offset(cx - s * 0.10, pinTip.dy + s * 0.05),
      Offset(cx + s * 0.10, pinTip.dy + s * 0.05),
      Paint()
        ..color = color.withValues(alpha: 0.18)
        ..style = PaintingStyle.stroke
        ..strokeWidth = s * 0.012
        ..strokeCap = StrokeCap.round,
    );

    // Decorative ripple circles
    for (var i = 1; i <= 2; i++) {
      canvas.drawCircle(
        Offset(cx, pinTip.dy + s * 0.05),
        s * 0.04 * i,
        Paint()
          ..color = color.withValues(alpha: 0.08 / i)
          ..style = PaintingStyle.stroke
          ..strokeWidth = s * 0.006
          ..strokeCap = StrokeCap.round,
      );
    }
  }

  @override
  bool shouldRepaint(_LocationPinPainter old) => old.color != color;
}
