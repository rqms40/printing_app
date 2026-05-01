import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';

/// Yellow-to-amber gradient hero block with a repeating-dot grid overlay
/// and a centred printer icon. ~220 px tall.
class BetaHeroIllustration extends StatelessWidget {
  const BetaHeroIllustration({super.key});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 220,
      width: double.infinity,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Gradient background
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFFFDE58), // bright brand yellow
                  Color(0xFFD4A017), // deep amber
                ],
              ),
            ),
          ),

          // Repeating-dot grid overlay
          CustomPaint(painter: _DotGridPainter()),

          // Centred printer icon
          const Center(
            child: HugeIcon(
              icon: HugeIcons.strokeRoundedPrinter,
              size: 56,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

class _DotGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withValues(alpha: 0.18)
      ..style = PaintingStyle.fill;

    const spacing = 20.0;
    const radius = 1.5;

    final cols = (size.width / spacing).ceil() + 1;
    final rows = (size.height / spacing).ceil() + 1;

    for (var row = 0; row < rows; row++) {
      for (var col = 0; col < cols; col++) {
        canvas.drawCircle(
          Offset(col * spacing, row * spacing),
          radius,
          paint,
        );
      }
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

