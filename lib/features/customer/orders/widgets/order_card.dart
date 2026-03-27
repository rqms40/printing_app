import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

/// Card displaying a summary of an order in the orders list.
class OrderCard extends StatelessWidget {
  const OrderCard({
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

  Color _accentColor(AppColorSet colors) {
    switch (order.orderStatus) {
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return colors.success;
      case OrderStatus.cancelled:
      case OrderStatus.fileDeclined:
        return colors.error;
      default:
        return colors.info;
    }
  }

  StatusBadgeVariant _badgeVariant() {
    switch (order.orderStatus) {
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return StatusBadgeVariant.success;
      case OrderStatus.cancelled:
      case OrderStatus.fileDeclined:
        return StatusBadgeVariant.error;
      default:
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
        return HugeIcons.strokeRoundedNote;
      case 'banner':
        return HugeIcons.strokeRoundedImage01;
      case '3d print':
        return HugeIcons.strokeRoundedPackage;
      default:
        return HugeIcons.strokeRoundedPrinter;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return AppCard(
      accentColor: _accentColor(colors),
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: orderId + status badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                order.orderId,
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                  fontFamily: 'monospace',
                ),
              ),
              StatusBadge(
                label: order.orderStatus.displayName,
                variant: _badgeVariant(),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Category + quantity x price
          Row(
            children: [
              Icon(
                _categoryIcon(),
                size: 16,
                color: colors.onSurfaceDim,
              ),
              const SizedBox(width: AppSpacing.xs),
              Text(
                order.category,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
              const Spacer(),
              Text(
                '${order.quantity} \u00d7 ${formatCurrency(order.totalPrice)}',
                style: AppTypography.body.copyWith(
                  color: colors.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          // Bottom: created date
          Text(
            formatDate(order.createdAt),
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
        ],
      ),
    );
  }
}
