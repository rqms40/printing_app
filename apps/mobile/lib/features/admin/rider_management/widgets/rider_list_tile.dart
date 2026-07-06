import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/rider_profile.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// ListTile showing a rider's info with availability dot and assign button.
class RiderListTile extends StatelessWidget {
  const RiderListTile({
    super.key,
    required this.rider,
    this.onAssign,
    this.showAssignButton = true,
  });

  final RiderProfile rider;
  final VoidCallback? onAssign;
  final bool showAssignButton;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  String _riderName() {
    // Look up user name from mock data
    final user = MockData.users.where((u) => u.id == rider.userId).firstOrNull;
    return user?.fullName ?? 'Rider ${rider.userId}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final showAction = showAssignButton && rider.isAvailable;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = showAction && constraints.maxWidth < 300;
          final info = Row(
            children: [
              // Availability dot
              Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: rider.isAvailable ? colors.success : colors.disabled,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.md),

              // Rider info
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _riderName(),
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      '${rider.vehicleType.displayName} \u00B7 ${rider.plateNumber ?? 'No plate'}',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          );

          final action = AppButton(
            label: 'Assign',
            variant: AppButtonVariant.secondary,
            onTap: onAssign,
          );

          if (compact) {
            return Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                info,
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: SizedBox(width: 112, child: action),
                ),
              ],
            );
          }

          return Row(
            children: [
              Expanded(child: info),
              if (showAction) ...[const SizedBox(width: AppSpacing.md), action],
            ],
          );
        },
      ),
    );
  }
}
