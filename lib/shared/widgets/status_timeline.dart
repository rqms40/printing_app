import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// A single step in [StatusTimeline].
class TimelineStep {
  const TimelineStep({
    required this.label,
    this.timestamp,
  });

  final String label;
  final String? timestamp;
}

/// Vertical stepper timeline showing order status progression.
///
/// - **Completed** steps: solid accent circle with a checkmark.
/// - **Current** step: outlined accent circle with a subtle pulse animation.
/// - **Future** steps: faint dotted circle in disabled color.
class StatusTimeline extends StatelessWidget {
  const StatusTimeline({
    super.key,
    required this.steps,
    required this.currentIndex,
  });

  /// Ordered list of status steps.
  final List<TimelineStep> steps;

  /// Zero-based index of the currently active step.
  final int currentIndex;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(steps.length, (index) {
        final step = steps[index];
        final isCompleted = index < currentIndex;
        final isCurrent = index == currentIndex;
        final isLast = index == steps.length - 1;

        return IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Circle + connecting line column
              SizedBox(
                width: 32,
                child: Column(
                  children: [
                    _buildCircle(
                      isCompleted: isCompleted,
                      isCurrent: isCurrent,
                      colors: colors,
                    ),
                    if (!isLast)
                      Expanded(
                        child: Container(
                          width: 2,
                          color: isCompleted
                              ? colors.accent
                              : colors.disabled.withValues(alpha: 0.4),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              // Label + timestamp
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    bottom: isLast ? 0 : AppSpacing.lg,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        step.label,
                        style: AppTypography.body.copyWith(
                          color: isCompleted || isCurrent
                              ? colors.onBackground
                              : colors.disabled,
                          fontWeight: isCurrent
                              ? FontWeight.w600
                              : FontWeight.w400,
                        ),
                      ),
                      if (step.timestamp != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          step.timestamp!,
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

  Widget _buildCircle({
    required bool isCompleted,
    required bool isCurrent,
    required AppColorSet colors,
  }) {
    const double size = 24;

    if (isCompleted) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: colors.accent,
        ),
        child: Icon(
          Icons.check_rounded,
          size: 14,
          color: colors.accentOnColor,
        ),
      );
    }

    if (isCurrent) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: colors.accent, width: 2),
        ),
      ).animate(onPlay: (c) => c.repeat(reverse: true)).fade(
            begin: 0.6,
            end: 1.0,
            duration: const Duration(milliseconds: 1200),
          );
    }

    // Future -- dotted circle via a thin dashed border approximation.
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(
          color: colors.disabled,
          width: 1,
          strokeAlign: BorderSide.strokeAlignInside,
        ),
      ),
    );
  }
}
