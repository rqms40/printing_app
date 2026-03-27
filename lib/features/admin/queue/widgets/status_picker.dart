import 'package:flutter/material.dart';
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

  IconData _iconForStatus(OrderStatus status) {
    switch (status) {
      case OrderStatus.orderPlaced:
        return Icons.receipt_long_outlined;
      case OrderStatus.fileVerified:
        return Icons.check_circle_outline;
      case OrderStatus.fileDeclined:
        return Icons.cancel_outlined;
      case OrderStatus.printingInProgress:
        return Icons.print_outlined;
      case OrderStatus.finishingMounting:
        return Icons.construction_outlined;
      case OrderStatus.qualityChecked:
        return Icons.verified_outlined;
      case OrderStatus.readyForDispatch:
        return Icons.inventory_2_outlined;
      case OrderStatus.driverAssigned:
        return Icons.person_pin_outlined;
      case OrderStatus.pickedUp:
        return Icons.local_shipping_outlined;
      case OrderStatus.onTheWay:
        return Icons.delivery_dining_outlined;
      case OrderStatus.arrivedAtDestination:
        return Icons.location_on_outlined;
      case OrderStatus.delivered:
        return Icons.done_all;
      case OrderStatus.completedPickup:
        return Icons.storefront_outlined;
      case OrderStatus.cancelled:
        return Icons.block_outlined;
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
            Icon(Icons.arrow_drop_down, size: 16, color: colors.onSurfaceDim),
          ],
        ),
      ),
      itemBuilder: (context) => OrderStatus.values.map((status) {
        final isSelected = status == currentStatus;
        return PopupMenuItem<OrderStatus>(
          value: status,
          child: Row(
            children: [
              Icon(
                _iconForStatus(status),
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
