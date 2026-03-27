import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Card displaying a delivery assignment with order info, address, and action buttons.
class DeliveryCard extends StatelessWidget {
  const DeliveryCard({
    super.key,
    required this.assignment,
    required this.order,
    this.address,
    this.onTap,
    this.onAccept,
    this.onDecline,
  });

  final DeliveryAssignment assignment;
  final Order order;
  final Address? address;
  final VoidCallback? onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  StatusBadgeVariant _badgeVariant(DeliveryStatus status) {
    switch (status) {
      case DeliveryStatus.assigned:
        return StatusBadgeVariant.warning;
      case DeliveryStatus.accepted:
      case DeliveryStatus.pickedUp:
        return StatusBadgeVariant.info;
      case DeliveryStatus.onTheWay:
      case DeliveryStatus.arrived:
        return StatusBadgeVariant.info;
      case DeliveryStatus.delivered:
        return StatusBadgeVariant.success;
      case DeliveryStatus.declined:
        return StatusBadgeVariant.error;
    }
  }

  Color? _accentColor(BuildContext context) {
    final colors = _colors(context);
    switch (assignment.status) {
      case DeliveryStatus.assigned:
        return colors.warning;
      case DeliveryStatus.onTheWay:
      case DeliveryStatus.arrived:
        return colors.info;
      case DeliveryStatus.delivered:
        return colors.success;
      default:
        return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return AppCard(
      onTap: onTap,
      accentColor: _accentColor(context),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Order ID + Status badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                order.orderId,
                style: AppTypography.bodyBold
                    .copyWith(color: colors.onBackground),
              ),
              StatusBadge(
                label: assignment.status.displayName,
                variant: _badgeVariant(assignment.status),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Category
          Text(
            order.category,
            style:
                AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.sm),

          // Address
          if (address != null) ...[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(HugeIcons.strokeRoundedLocation01, size: 16, color: colors.onSurfaceDim),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    address!.fullAddress,
                    style: AppTypography.body
                        .copyWith(color: colors.onSurface),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if (address!.landmark != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Padding(
                padding: const EdgeInsets.only(left: 20),
                child: Text(
                  address!.landmark!,
                  style: AppTypography.caption
                      .copyWith(color: colors.onSurfaceDim),
                ),
              ),
            ],
          ],

          // Action buttons for 'assigned' status
          if (assignment.status == DeliveryStatus.assigned) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: AppButton(
                    label: 'Decline',
                    variant: AppButtonVariant.ghost,
                    onTap: onDecline,
                    icon: HugeIcons.strokeRoundedCancelCircle,
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AppButton(
                    label: 'Accept',
                    variant: AppButtonVariant.primary,
                    onTap: onAccept,
                    icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                  ),
                ),
              ],
            ),
          ],

          // Current checkpoint for active statuses
          if (assignment.status != DeliveryStatus.assigned &&
              assignment.status != DeliveryStatus.declined &&
              assignment.status != DeliveryStatus.delivered) ...[
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                Icon(HugeIcons.strokeRoundedDeliveryTruck02, size: 16, color: colors.info),
                const SizedBox(width: AppSpacing.xs),
                Text(
                  assignment.status.displayName,
                  style:
                      AppTypography.caption.copyWith(color: colors.info),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
