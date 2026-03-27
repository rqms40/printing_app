import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/tracking/widgets/delivery_map.dart';
import 'package:printing_app/features/customer/tracking/widgets/driver_info_card.dart';

class DeliveryTrackingScreen extends StatelessWidget {
  const DeliveryTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Track Delivery',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: Column(
        children: [
          // Map placeholder
          const Expanded(
            child: Padding(
              padding: EdgeInsets.all(AppSpacing.md),
              child: DeliveryMap(),
            ),
          ).animate()
            .fadeIn(duration: 400.ms, curve: Curves.easeOut)
            .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          // Driver info card at bottom
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.md,
            ),
            child: DriverInfoCard(),
          ).animate()
            .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
            .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
        ],
      ),
    );
  }
}
