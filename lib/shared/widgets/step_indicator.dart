import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';

/// Horizontal step indicator for multi-step order flows.
///
/// Displays a row of dots connected by thin lines:
/// - **Completed** steps are solid accent circles.
/// - **Current** step is an outlined accent circle, slightly larger.
/// - **Future** steps are surfaceDim circles.
class StepIndicator extends StatelessWidget {
  const StepIndicator({
    super.key,
    required this.totalSteps,
    required this.currentStep,
  });

  /// Total number of steps (1-based count).
  final int totalSteps;

  /// Zero-based index of the current step.
  final int currentStep;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(totalSteps * 2 - 1, (i) {
        // Even indices are dots, odd indices are connecting lines.
        if (i.isOdd) {
          final stepBefore = i ~/ 2;
          return Expanded(
            child: Container(
              height: 2,
              color: stepBefore < currentStep
                  ? colors.accent
                  : colors.surfaceDim,
            ),
          );
        }

        final stepIndex = i ~/ 2;
        final isCompleted = stepIndex < currentStep;
        final isCurrent = stepIndex == currentStep;

        return _Dot(
          isCompleted: isCompleted,
          isCurrent: isCurrent,
          colors: colors,
        );
      }),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({
    required this.isCompleted,
    required this.isCurrent,
    required this.colors,
  });

  final bool isCompleted;
  final bool isCurrent;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final double size = isCurrent ? 14 : 10;

    if (isCompleted) {
      return Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: colors.accent,
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
      );
    }

    // Future
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.surfaceDim,
      ),
    );
  }
}
