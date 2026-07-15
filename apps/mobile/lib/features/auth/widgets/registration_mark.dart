import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';

/// Signature progress indicator for the registration flow: a row of printer
/// registration marks (crosshair-in-circle targets). Completed steps "lock
/// in" as solid brand marks, the current step is an outlined ring, and
/// upcoming steps stay faint — evoking print-plate registration, the pun the
/// whole redesign is built on.
class RegistrationMarkRow extends StatelessWidget {
  const RegistrationMarkRow({
    super.key,
    required this.total,
    required this.completed,
    required this.current,
    this.size = 18,
    this.gap = 10,
  });

  final int total;
  final int completed;
  final int current;
  final double size;
  final double gap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Semantics(
      label: 'Step ${current + 1} of $total',
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < total; i++) ...[
            if (i > 0) SizedBox(width: gap),
            CustomPaint(
              size: Size.square(size),
              painter: _RegistrationMarkPainter(
                state: i < completed
                    ? _MarkState.locked
                    : i == current
                    ? _MarkState.active
                    : _MarkState.upcoming,
                brand: colors.brand,
                muted: colors.onSurfaceDim,
              ),
            ),
          ],
        ],
      ),
    );
  }
}

enum _MarkState { locked, active, upcoming }

class _RegistrationMarkPainter extends CustomPainter {
  _RegistrationMarkPainter({
    required this.state,
    required this.brand,
    required this.muted,
  });

  final _MarkState state;
  final Color brand;
  final Color muted;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2;
    final color = switch (state) {
      _MarkState.locked => brand,
      _MarkState.active => brand,
      _MarkState.upcoming => muted.withValues(alpha: 0.4),
    };

    if (state == _MarkState.locked) {
      // Locked: filled disc + dark crosshair punched through.
      canvas.drawCircle(center, radius, Paint()..color = color);
      final cross = Paint()
        ..color = const Color(0xFF141414)
        ..strokeWidth = 1.6;
      canvas.drawLine(
        Offset(center.dx, center.dy - radius),
        Offset(center.dx, center.dy + radius),
        cross,
      );
      canvas.drawLine(
        Offset(center.dx - radius, center.dy),
        Offset(center.dx + radius, center.dy),
        cross,
      );
      return;
    }

    // Active + upcoming: outlined ring with a crosshair, weight by state.
    final stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = state == _MarkState.active ? 2 : 1.2;
    canvas.drawCircle(center, radius - stroke.strokeWidth, stroke);
    final tick = radius * 0.55;
    canvas.drawLine(
      Offset(center.dx, center.dy - tick),
      Offset(center.dx, center.dy + tick),
      stroke,
    );
    canvas.drawLine(
      Offset(center.dx - tick, center.dy),
      Offset(center.dx + tick, center.dy),
      stroke,
    );
  }

  @override
  bool shouldRepaint(_RegistrationMarkPainter oldDelegate) =>
      oldDelegate.state != state ||
      oldDelegate.brand != brand ||
      oldDelegate.muted != muted;
}
