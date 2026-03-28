import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_motion.dart';

/// Semi-transparent overlay with a centered loading indicator.
///
/// Wrap any widget and toggle [isLoading] to show/hide the overlay.
class LoadingOverlay extends StatelessWidget {
  const LoadingOverlay({
    super.key,
    required this.child,
    this.isLoading = false,
  });

  final Widget child;
  final bool isLoading;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Stack(
      children: [
        child,
        if (isLoading)
          Positioned.fill(
            child: AnimatedOpacity(
              duration: AppMotion.fast,
              opacity: 1.0,
              child: ColoredBox(
                color: Colors.black.withValues(alpha: AppColors.overlayOpacity),
                child: Center(
                  child: CircularProgressIndicator(
                    color: colors.accent,
                    strokeWidth: 3,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
