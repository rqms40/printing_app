import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/section_header.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Displays a horizontal list of recent orders with mini order cards.
class RecentOrdersSection extends StatelessWidget {
  const RecentOrdersSection({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  StatusBadgeVariant _variantForStatus(OrderStatus status) {
    switch (status) {
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return StatusBadgeVariant.success;
      case OrderStatus.cancelled:
      case OrderStatus.fileDeclined:
        return StatusBadgeVariant.error;
      case OrderStatus.onTheWay:
      case OrderStatus.pickedUp:
      case OrderStatus.arrivedAtDestination:
        return StatusBadgeVariant.info;
      case OrderStatus.printingInProgress:
      case OrderStatus.finishingMounting:
      case OrderStatus.qualityChecked:
      case OrderStatus.readyForDispatch:
      case OrderStatus.driverAssigned:
        return StatusBadgeVariant.warning;
      case OrderStatus.orderPlaced:
      case OrderStatus.fileVerified:
        return StatusBadgeVariant.neutral;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final recentOrders = MockData.orders.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Recent Orders',
          actionLabel: 'See All',
          onAction: () {
            context.go('/customer/orders');
          },
        ),
        if (recentOrders.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
            child: Center(
              child: Text(
                'No orders yet',
                style: AppTypography.body.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
          )
        else
          SizedBox(
            height: 160,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              itemCount: recentOrders.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(width: AppSpacing.md),
              itemBuilder: (context, index) {
                final order = recentOrders[index];
                return _MiniOrderCard(
                  order: order,
                  colors: colors,
                  variant: _variantForStatus(order.orderStatus),
                );
              },
            ),
          ),
      ],
    );
  }
}

class _MiniOrderCard extends StatelessWidget {
  const _MiniOrderCard({
    required this.order,
    required this.colors,
    required this.variant,
  });

  final Order order;
  final AppColorSet colors;
  final StatusBadgeVariant variant;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d, y');

    return SizedBox(
      width: 200,
      child: AppCard(
        onTap: () {
          context.push('/customer/orders/${order.id}');
        },
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              order.orderId,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: Alignment.centerLeft,
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: StatusBadge(
                  label: order.orderStatus.displayName,
                  variant: variant,
                ),
              ),
            ),
            const Spacer(),
            Text(
              'P${order.totalPrice.toStringAsFixed(2)}',
              style: AppTypography.body.copyWith(
                color: colors.onSurface,
              ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              dateFormat.format(order.createdAt),
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
