import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/queue/providers/queue_provider.dart';
import 'package:printing_app/features/admin/queue/widgets/status_picker.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

/// Order card used in the admin queue list.
class QueueOrderCard extends ConsumerWidget {
  const QueueOrderCard({
    super.key,
    required this.order,
    this.onTap,
  });

  final Order order;
  final VoidCallback? onTap;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  Color _statusColor(AppColorSet colors) {
    switch (order.orderStatus) {
      case OrderStatus.orderPlaced:
      case OrderStatus.fileVerified:
        return colors.info;
      case OrderStatus.printingInProgress:
      case OrderStatus.finishingMounting:
        return colors.warning;
      case OrderStatus.qualityChecked:
      case OrderStatus.readyForDispatch:
        return colors.success;
      case OrderStatus.fileDeclined:
      case OrderStatus.cancelled:
        return colors.error;
      case OrderStatus.driverAssigned:
      case OrderStatus.pickedUp:
      case OrderStatus.onTheWay:
      case OrderStatus.arrivedAtDestination:
        return colors.info;
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return colors.success;
    }
  }

  StatusBadgeVariant _badgeVariant() {
    switch (order.orderStatus) {
      case OrderStatus.orderPlaced:
      case OrderStatus.fileVerified:
        return StatusBadgeVariant.info;
      case OrderStatus.printingInProgress:
      case OrderStatus.finishingMounting:
        return StatusBadgeVariant.warning;
      case OrderStatus.qualityChecked:
      case OrderStatus.readyForDispatch:
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return StatusBadgeVariant.success;
      case OrderStatus.fileDeclined:
      case OrderStatus.cancelled:
        return StatusBadgeVariant.error;
      case OrderStatus.driverAssigned:
      case OrderStatus.pickedUp:
      case OrderStatus.onTheWay:
      case OrderStatus.arrivedAtDestination:
        return StatusBadgeVariant.info;
    }
  }

  IconData _categoryIcon() {
    switch (order.category.toLowerCase()) {
      case 'poster':
        return HugeIcons.strokeRoundedImage01;
      case 'document':
        return HugeIcons.strokeRoundedFile02;
      case 'report':
        return HugeIcons.strokeRoundedClipboard;
      case 'banner':
        return HugeIcons.strokeRoundedFlag01;
      case '3d print':
        return HugeIcons.strokeRoundedPackageDelivered;
      default:
        return HugeIcons.strokeRoundedFile01;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);

    return AppCard(
      accentColor: _statusColor(colors),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: order ID, status badge, category icon
          Row(
            children: [
              Expanded(
                child: Text(
                  order.orderId,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
              StatusBadge(
                label: order.orderStatus.displayName,
                variant: _badgeVariant(),
              ),
              const SizedBox(width: AppSpacing.sm),
              Icon(_categoryIcon(), size: 18, color: colors.onSurfaceDim),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Customer name and pricing
          Row(
            children: [
              Expanded(
                child: Text(
                  'Customer ${order.userId}',
                  style:
                      AppTypography.body.copyWith(color: colors.onSurfaceDim),
                ),
              ),
              Text(
                '${order.quantity}x \u00B7 ${formatCurrency(order.totalPrice)}',
                style: AppTypography.body.copyWith(color: colors.onSurface),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),

          // Bottom row: status picker + file link
          Row(
            children: [
              StatusPicker(
                currentStatus: order.orderStatus,
                onStatusSelected: (newStatus) {
                  ref
                      .read(queueProvider.notifier)
                      .updateOrderStatus(order.id, newStatus);
                },
              ),
              const Spacer(),
              if (order.fileUrl != null)
                IconButton(
                  icon: Icon(
                    HugeIcons.strokeRoundedFileDownload,
                    size: 20,
                    color: colors.onSurfaceDim,
                  ),
                  onPressed: () {
                    // In production, open file URL
                  },
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
