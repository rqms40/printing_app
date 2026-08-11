import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Drawn signature pad — same JSON format as rider proof sheets.
class SignaturePad extends StatefulWidget {
  const SignaturePad({
    super.key,
    required this.onChanged,
    this.enabled = true,
    this.height = 160,
    this.hint = 'Draw your signature to confirm this quality check.',
  });

  final ValueChanged<String?> onChanged;
  final bool enabled;
  final double height;
  final String hint;

  @override
  State<SignaturePad> createState() => SignaturePadState();
}

class SignaturePadState extends State<SignaturePad> {
  final _points = <Offset?>[];

  bool get hasInk => _points.whereType<Offset>().length >= 2;

  void clear() {
    setState(() => _points.clear());
    widget.onChanged(null);
  }

  void _emit() {
    if (!hasInk) {
      widget.onChanged(null);
      return;
    }
    final payload = {
      'format': 'gridgo-signature-v1',
      'points': _points
          .map((p) => p == null ? null : [p.dx, p.dy])
          .toList(growable: false),
    };
    widget.onChanged(jsonEncode(payload));
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                'Digital sign-off',
                style: AppTypography.caption.copyWith(
                  color: colors.onBackground,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            TextButton(
              onPressed: widget.enabled && hasInk ? clear : null,
              child: Text(
                'Clear',
                style: AppTypography.caption.copyWith(color: colors.accent),
              ),
            ),
          ],
        ),
        Text(
          widget.hint,
          style: AppTypography.caption.copyWith(
            color: colors.onSurfaceDim,
            fontSize: 12,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        AbsorbPointer(
          absorbing: !widget.enabled,
          child: Container(
            height: widget.height,
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
              border: Border.all(color: colors.outline),
            ),
            child: GestureDetector(
              onPanStart: (details) {
                setState(() => _points.add(details.localPosition));
              },
              onPanUpdate: (details) {
                setState(() => _points.add(details.localPosition));
              },
              onPanEnd: (_) {
                setState(() => _points.add(null));
                _emit();
              },
              child: CustomPaint(
                painter: _SignaturePainter(
                  points: List<Offset?>.of(_points),
                  color: colors.onBackground,
                ),
                child: Center(
                  child: hasInk
                      ? null
                      : Text(
                          'Sign here',
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
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

class _SignaturePainter extends CustomPainter {
  _SignaturePainter({required this.points, required this.color});

  final List<Offset?> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..style = PaintingStyle.stroke;

    for (var i = 0; i < points.length - 1; i++) {
      final a = points[i];
      final b = points[i + 1];
      if (a != null && b != null) {
        canvas.drawLine(a, b, paint);
      }
    }
  }

  @override
  bool shouldRepaint(covariant _SignaturePainter oldDelegate) =>
      oldDelegate.points != points || oldDelegate.color != color;
}
