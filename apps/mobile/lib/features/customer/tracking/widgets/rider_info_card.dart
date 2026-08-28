import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:url_launcher/url_launcher.dart';

/// Card displaying rider info, vehicle details, and call action.
class RiderInfoCard extends StatelessWidget {
  const RiderInfoCard({
    super.key,
    this.rider,
    this.eta = '~10 min',
    this.onChat,
  });

  final AssignedRiderContact? rider;
  final String eta;
  final VoidCallback? onChat;

  Future<void> _callRider() async {
    final phone = rider?.phoneNumber;
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  String _titleCase(String value) {
    return value
        .replaceAll('_', ' ')
        .split(' ')
        .where((part) => part.isNotEmpty)
        .map((part) => '${part[0].toUpperCase()}${part.substring(1)}')
        .join(' ');
  }

  String _vehicleLine(AssignedRiderContact rider) {
    final vehicle = rider.vehicleType == null || rider.vehicleType!.isEmpty
        ? 'Vehicle pending'
        : _titleCase(rider.vehicleType!);
    final plate = rider.plateNumber;
    if (plate == null || plate.isEmpty) return vehicle;
    return '$vehicle · $plate';
  }

  String _statusLabel(String status) {
    return switch (status) {
      'assigned' => 'Assigned',
      'accepted' => 'Accepted',
      'picked_up' => 'Picked up',
      'on_the_way' => 'On the way',
      'arrived' => 'Arrived',
      'delivered' => 'Delivered',
      _ => _titleCase(status),
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final rider = this.rider;

    if (rider == null) {
      return AppCard(
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedDeliveryTruck02,
                  size: 24,
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Rider pending',
                    style: AppTypography.h3.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Contact details will appear once a rider is assigned.',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    final phoneNumber = rider.phoneNumber;
    final hasPhone = phoneNumber != null && phoneNumber.isNotEmpty;
    final statusLabel = _statusLabel(rider.deliveryStatus);
    final isDelivered = rider.deliveryStatus == 'delivered';

    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              // Rider avatar
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    rider.displayName.isNotEmpty
                        ? rider.displayName[0].toUpperCase()
                        : 'R',
                    style: AppTypography.h3.copyWith(color: colors.accent),
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rider.displayName,
                      style: AppTypography.h3.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      _vehicleLine(rider),
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),
              // ETA badge
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  color: colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  statusLabel,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurface,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          if (!isDelivered) ...[
            const SizedBox(height: AppSpacing.md),
            // Phone number
            Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedCall,
                  size: 16,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  hasPhone ? phoneNumber : 'Phone unavailable',
                  style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            if (onChat != null) ...[
              AppButton(
                label: 'Message Rider',
                icon: HugeIcons.strokeRoundedMessage01,
                variant: AppButtonVariant.primary,
                isFullWidth: true,
                onTap: onChat,
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            if (hasPhone)
              AppButton(
                label: 'Call Rider',
                icon: HugeIcons.strokeRoundedCall,
                variant: AppButtonVariant.secondary,
                isFullWidth: true,
                onTap: _callRider,
              ),
          ],
        ],
      ),
    );
  }
}
