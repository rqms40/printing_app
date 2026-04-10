import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/features/onboarding/models/onboarding_page_data.dart';
import 'package:printing_app/features/onboarding/widgets/onboarding_custom_illustrations.dart';
import 'package:printing_app/shared/widgets/app_illustrations.dart';

/// Renders the correct [CustomPaint]-based illustration inside a soft
/// decorative circle background. Adapts stroke color to the current theme.
class OnboardingIllustrationWidget extends StatelessWidget {
  const OnboardingIllustrationWidget({
    super.key,
    required this.type,
    this.size = 200,
  });

  final OnboardingIllustration type;
  final double size;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final strokeColor = colors.onBackground;

    // Outer decorative circle size
    final outerSize = size * 1.35;

    return SizedBox(
      width: outerSize,
      height: outerSize,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Soft background circle
          Container(
            width: outerSize,
            height: outerSize,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: colors.surfaceVariant.withValues(alpha: 0.6),
            ),
          ),
          // Inner subtle ring
          Container(
            width: outerSize * 0.82,
            height: outerSize * 0.82,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: colors.outline.withValues(alpha: 0.3),
                width: 1,
              ),
            ),
          ),
          // The illustration itself
          _buildIllustration(strokeColor),
        ],
      ),
    );
  }

  Widget _buildIllustration(Color color) {
    switch (type) {
      case OnboardingIllustration.printer:
        return PrinterIllustration(size: size, color: color);
      case OnboardingIllustration.delivery:
        return DeliveryIllustration(size: size, color: color);
      case OnboardingIllustration.payment:
        return PaymentIllustration(size: size, color: color);
      case OnboardingIllustration.locationPin:
        return LocationPinIllustration(size: size, color: color);
      case OnboardingIllustration.cube3D:
        return ThreeDCubeIllustration(size: size, color: color);
      case OnboardingIllustration.multiStop:
        return MultiStopIllustration(size: size, color: color);
      case OnboardingIllustration.notification:
        return NotificationBellIllustration(size: size, color: color);
      case OnboardingIllustration.gpsLocation:
        return GpsLocationIllustration(size: size, color: color);
    }
  }
}
