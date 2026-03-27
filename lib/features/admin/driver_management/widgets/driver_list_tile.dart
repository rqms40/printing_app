import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/driver_profile.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// ListTile showing a driver's info with availability dot and assign button.
class DriverListTile extends StatelessWidget {
  const DriverListTile({
    super.key,
    required this.driver,
    this.onAssign,
    this.showAssignButton = true,
  });

  final DriverProfile driver;
  final VoidCallback? onAssign;
  final bool showAssignButton;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  String _driverName() {
    // Look up user name from mock data
    final user = MockData.users.where((u) => u.id == driver.userId).firstOrNull;
    return user?.fullName ?? 'Driver ${driver.userId}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          // Availability dot
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              color: driver.isAvailable ? colors.success : colors.disabled,
              shape: BoxShape.circle,
            ),
          ),
          const SizedBox(width: AppSpacing.md),

          // Driver info
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _driverName(),
                  style: AppTypography.bodyBold
                      .copyWith(color: colors.onBackground),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '${driver.vehicleType.displayName} \u00B7 ${driver.plateNumber ?? 'No plate'}',
                  style: AppTypography.caption
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ],
            ),
          ),

          // Assign button
          if (showAssignButton && driver.isAvailable)
            AppButton(
              label: 'Assign',
              variant: AppButtonVariant.secondary,
              onTap: onAssign,
            ),
        ],
      ),
    );
  }
}
