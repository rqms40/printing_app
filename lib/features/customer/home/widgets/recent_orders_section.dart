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

/// Displays a snapping carousel of recent orders with dot indicators.
class RecentOrdersSection extends StatefulWidget {
  const RecentOrdersSection({super.key});

  @override
  State<RecentOrdersSection> createState() => _RecentOrdersSectionState();
}

class _RecentOrdersSectionState extends State<RecentOrdersSection> {
  int _currentIndex = 0;
  late final PageController _pageController;

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
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.85);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
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
        else ...[
          SizedBox(
            height: 160,
            child: PageView.builder(
              controller: _pageController,
              itemCount: recentOrders.length,
              onPageChanged: (index) {
                setState(() => _currentIndex = index);
              },
              itemBuilder: (context, index) {
                final order = recentOrders[index];
                return Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xs,
                  ),
                  child: _MiniOrderCard(
                    order: order,
                    colors: colors,
                    variant: _variantForStatus(order.orderStatus),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Dot indicators
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(
              recentOrders.length,
              (i) => AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _currentIndex ? 20 : 6,
                height: 6,
                decoration: BoxDecoration(
                  color:
                      i == _currentIndex ? colors.accent : colors.disabled,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
          ),
        ],
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

    return AppCard(
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
    );
  }
}
