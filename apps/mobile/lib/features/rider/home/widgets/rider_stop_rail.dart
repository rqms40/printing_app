import 'package:flutter/material.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/config/theme/app_colors.dart';

/// Vertical numbered stop rail overlaid on the cockpit map's right edge.
/// Theme-following; scrolls when there are many stops; the chevron collapses
/// the rail to a small handle to give the map full width.
class RiderStopRail extends StatefulWidget {
  const RiderStopRail({
    super.key,
    required this.totalStops,
    required this.completedCount,
    this.stopStatuses,
    required this.currentStopIndex,
  });

  final int totalStops;
  final int completedCount;

  /// Per-stop plan statuses (1-indexed). When provided, done-shading follows
  /// each stop's own status instead of a completed count.
  final List<RiderDispatchStopStatus>? stopStatuses;
  final int currentStopIndex;

  @override
  State<RiderStopRail> createState() => _RiderStopRailState();
}

class _RiderStopRailState extends State<RiderStopRail> {
  bool _collapsed = false;

  void _toggle() => setState(() => _collapsed = !_collapsed);

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (_collapsed) {
      return SizedBox(
        width: 34,
        child: Align(
          alignment: Alignment.topCenter,
          child: _handle(colors, expand: true),
        ),
      );
    }

    final stops = widget.totalStops < 0 ? 0 : widget.totalStops;

    return SizedBox(
      width: 44,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.32),
          borderRadius: BorderRadius.circular(22),
        ),
        child: Column(
          children: [
            _CheckNode(colors: colors, complete: widget.completedCount > 0),
            Expanded(
              child: SingleChildScrollView(
                child: Column(
                  children: [
                    for (var i = 1; i <= stops; i++) ...[
                      Container(width: 2.4, height: 12, color: colors.brand),
                      _StopNode(
                        colors: colors,
                        number: i,
                        done:
                            widget.stopStatuses != null &&
                                i <= widget.stopStatuses!.length
                            ? widget.stopStatuses![i - 1] ==
                                  RiderDispatchStopStatus.completed
                            : i <= widget.completedCount,
                        current: i == widget.currentStopIndex,
                      ),
                    ],
                  ],
                ),
              ),
            ),
            const SizedBox(height: 6),
            _handle(colors, expand: false),
          ],
        ),
      ),
    );
  }

  Widget _handle(AppColorSet colors, {required bool expand}) {
    return GestureDetector(
      key: const ValueKey('rider-rail-toggle'),
      onTap: _toggle,
      child: Container(
        width: 30,
        height: 30,
        decoration: BoxDecoration(
          color: colors.brand,
          shape: BoxShape.circle,
          boxShadow: const [
            BoxShadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 2)),
          ],
        ),
        child: Center(
          child: Icon(
            expand
                ? Icons.keyboard_double_arrow_right_rounded
                : Icons.keyboard_double_arrow_left_rounded,
            color: Colors.black,
            size: 20,
          ),
        ),
      ),
    );
  }
}

class _CheckNode extends StatelessWidget {
  const _CheckNode({required this.colors, required this.complete});
  final AppColorSet colors;
  final bool complete;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 28,
      height: 28,
      decoration: BoxDecoration(
        color: complete ? const Color(0xFF75D35B) : colors.surfaceVariant,
        shape: BoxShape.circle,
        border: complete ? null : Border.all(color: colors.outline, width: 1.4),
      ),
      child: Icon(
        Icons.check_rounded,
        size: 18,
        color: complete ? Colors.black : colors.onSurfaceDim,
      ),
    );
  }
}

class _StopNode extends StatelessWidget {
  const _StopNode({
    required this.colors,
    required this.number,
    required this.done,
    required this.current,
  });

  final AppColorSet colors;
  final int number;
  final bool done;
  final bool current;

  @override
  Widget build(BuildContext context) {
    final fg = current || done ? colors.onSurface : colors.onSurfaceDim;
    return Container(
      width: 27,
      height: 27,
      decoration: BoxDecoration(
        color: colors.surface,
        shape: BoxShape.circle,
        border: Border.all(color: colors.brand, width: current ? 2.4 : 1.4),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              '$number',
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
    );
  }
}
