import 'package:flutter/material.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';

/// Vertical stop timeline from rider-UI.png (right edge of map).
class RiderStopTimeline extends StatelessWidget {
  const RiderStopTimeline({
    super.key,
    required this.totalStops,
    required this.completedCount,
    required this.currentStopIndex,
    this.onCollapse,
  });

  final int totalStops;
  final int completedCount;
  final int currentStopIndex;
  final VoidCallback? onCollapse;

  @override
  Widget build(BuildContext context) {
    final stops = totalStops.clamp(1, 5).toInt();

    return SizedBox(
      width: 44,
      child: Column(
        children: [
          _TimelineNode(
            key: const ValueKey('rider-stop-timeline-check'),
            label: '✓',
            isComplete: completedCount > 0,
            isActive: false,
            isCheck: true,
          ),
          Expanded(
            child: CustomPaint(
              painter: _TimelineLinePainter(),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: List.generate(stops, (index) {
                  final stopNumber = index + 1;
                  final isDone = stopNumber <= completedCount;
                  final isCurrent = stopNumber == currentStopIndex;
                  return _TimelineNode(
                    key: ValueKey('rider-stop-node-$stopNumber'),
                    label: '$stopNumber',
                    isComplete: isDone,
                    isActive: isCurrent,
                  );
                }),
              ),
            ),
          ),
          GestureDetector(
            onTap: onCollapse,
            child: Container(
              key: const ValueKey('rider-stop-timeline-chevron'),
              width: 36,
              height: 28,
              decoration: BoxDecoration(
                color: RiderTheme.yellow,
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Center(
                child: Icon(
                  Icons.keyboard_double_arrow_left_rounded,
                  color: Colors.black,
                  size: 22,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TimelineNode extends StatelessWidget {
  const _TimelineNode({
    super.key,
    required this.label,
    required this.isComplete,
    required this.isActive,
    this.isCheck = false,
  });

  final String label;
  final bool isComplete;
  final bool isActive;
  final bool isCheck;

  @override
  Widget build(BuildContext context) {
    if (isCheck) {
      return Container(
        width: 28,
        height: 28,
        decoration: const BoxDecoration(
          color: Color(0xFF75D35B),
          shape: BoxShape.circle,
        ),
        child: const Icon(Icons.check_rounded, size: 19, color: Colors.black),
      );
    }

    const bg = RiderTheme.surface;
    final fg = isActive || isComplete
        ? RiderTheme.textPrimary
        : RiderTheme.textMuted;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 27,
          height: 27,
          decoration: BoxDecoration(
            color: bg,
            shape: BoxShape.circle,
            border: Border.all(
              color: RiderTheme.yellow,
              width: isActive ? 2 : 1.4,
            ),
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'STOP',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 4.5,
                    fontWeight: FontWeight.w900,
                    height: 1,
                  ),
                ),
                Text(
                  label,
                  style: TextStyle(
                    color: fg,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _TimelineLinePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = RiderTheme.yellow
      ..strokeWidth = 2.4
      ..strokeCap = StrokeCap.round;
    canvas.drawLine(
      Offset(size.width / 2, 0),
      Offset(size.width / 2, size.height),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
