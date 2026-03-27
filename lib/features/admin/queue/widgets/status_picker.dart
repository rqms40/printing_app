import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';

/// Dropdown popup menu for selecting an [OrderStatus].
class StatusPicker extends StatelessWidget {
  const StatusPicker({
    super.key,
    required this.currentStatus,
    required this.onStatusSelected,
  });

  final OrderStatus currentStatus;
  final ValueChanged<OrderStatus> onStatusSelected;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  dynamic _iconForStatus(OrderStatus status) {
    switch (status) {
      case OrderStatus.orderPlaced:
        return HugeIcons.strokeRoundedInvoice01;
      case OrderStatus.fileVerified:
        return HugeIcons.strokeRoundedCheckmarkCircle02;
      case OrderStatus.fileDeclined:
        return HugeIcons.strokeRoundedCancelCircle;
      case OrderStatus.printingInProgress:
        return HugeIcons.strokeRoundedPrinter;
      case OrderStatus.finishingMounting:
        return HugeIcons.strokeRoundedSettings01;
      case OrderStatus.qualityChecked:
        return HugeIcons.strokeRoundedCheckmarkBadge01;
      case OrderStatus.readyForDispatch:
        return HugeIcons.strokeRoundedPackageDelivered;
      case OrderStatus.driverAssigned:
        return HugeIcons.strokeRoundedUserAccount;
      case OrderStatus.pickedUp:
        return HugeIcons.strokeRoundedDeliveryTruck02;
      case OrderStatus.onTheWay:
        return HugeIcons.strokeRoundedDeliveryTruck01;
      case OrderStatus.arrivedAtDestination:
        return HugeIcons.strokeRoundedLocation01;
      case OrderStatus.delivered:
        return HugeIcons.strokeRoundedTickDouble01;
      case OrderStatus.completedPickup:
        return HugeIcons.strokeRoundedStore02;
      case OrderStatus.cancelled:
        return HugeIcons.strokeRoundedCancel02;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return PopupMenuButton<OrderStatus>(
      initialValue: currentStatus,
      onSelected: onStatusSelected,
      shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
      color: colors.surface,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          border: Border.all(color: colors.outline),
          borderRadius: AppRadius.borderSm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              currentStatus.displayName,
              style: AppTypography.caption.copyWith(color: colors.onSurface),
            ),
            const SizedBox(width: AppSpacing.xs),
            HugeIcon(icon: HugeIcons.strokeRoundedArrowDown01, size: 16, color: colors.onSurfaceDim),
          ],
        ),
      ),
      itemBuilder: (context) => OrderStatus.values.map((status) {
        final isSelected = status == currentStatus;
        return PopupMenuItem<OrderStatus>(
          value: status,
          child: Row(
            children: [
              HugeIcon(
                icon: _iconForStatus(status),
                size: 18,
                color: isSelected ? colors.accent : colors.onSurfaceDim,
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                status.displayName,
                style: AppTypography.body.copyWith(
                  color: isSelected ? colors.accent : colors.onSurface,
                  fontWeight: isSelected ? FontWeight.w700 : FontWeight.w400,
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }
}
