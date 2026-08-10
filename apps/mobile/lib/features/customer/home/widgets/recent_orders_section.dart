import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart'
    show recentOrdersProvider;
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/section_header.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Vertical list of the 5 most-recently-updated orders.
/// Automatically rebuilds when any order status changes via WS or API.
class RecentOrdersSection extends ConsumerWidget {
  const RecentOrdersSection({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  StatusBadgeVariant _variantForStatus(OrderStatus status) {
    switch (status) {
      case OrderStatus.delivered:
      case OrderStatus.collectedByCustomer:
      case OrderStatus.issueWindowOpen:
      case OrderStatus.completed:
        return StatusBadgeVariant.success;
      case OrderStatus.cancelled:
      case OrderStatus.fileRejected:
      case OrderStatus.deliveryFailed:
        return StatusBadgeVariant.error;
      case OrderStatus.outForDelivery:
      case OrderStatus.pickedUp:
        return StatusBadgeVariant.info;
      case OrderStatus.production:
      case OrderStatus.supplierSelfQc:
      case OrderStatus.readyForDispatch:
      case OrderStatus.riderAssigned:
      case OrderStatus.paymentAuthorized:
      case OrderStatus.awaitingPayment:
      case OrderStatus.supplierAssigned:
      case OrderStatus.supplierAccepted:
        return StatusBadgeVariant.warning;
      case OrderStatus.draft:
      case OrderStatus.submitted:
      case OrderStatus.needsQa:
      case OrderStatus.clientCorrection:
      case OrderStatus.proofApproval:
      case OrderStatus.approvedForMatching:
        return StatusBadgeVariant.neutral;
    }
  }

  IconData _iconForCategory(String category) {
    switch (category.toLowerCase()) {
      case '3d print':
        return Icons.view_in_ar_rounded;
      case 'banner':
        return Icons.panorama_rounded;
      case 'poster':
        return Icons.image_rounded;
      default:
        return Icons.description_rounded;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final recentOrders = ref.watch(recentOrdersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Recent Orders',
          actionLabel: 'See All',
          onAction: () => context.go('/customer/orders'),
        ),
        if (recentOrders.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
            child: Center(
              child: Text(
                'No orders yet',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
            ),
          )
        else
          Column(
            children: [
              for (int i = 0; i < recentOrders.length; i++) ...[
                _OrderListItem(
                  order: recentOrders[i],
                  colors: colors,
                  variant: _variantForStatus(recentOrders[i].orderStatus),
                  icon: _iconForCategory(recentOrders[i].category),
                ),
                if (i < recentOrders.length - 1)
                  Divider(
                    height: 1,
                    thickness: 0.5,
                    color: colors.outline.withValues(alpha: 0.5),
                    indent: 56,
                  ),
              ],
            ],
          ),
      ],
    );
  }
}

class _OrderListItem extends StatefulWidget {
  const _OrderListItem({
    required this.order,
    required this.colors,
    required this.variant,
    required this.icon,
  });

  final Order order;
  final AppColorSet colors;
  final StatusBadgeVariant variant;
  final IconData icon;

  @override
  State<_OrderListItem> createState() => _OrderListItemState();
}

class _OrderListItemState extends State<_OrderListItem> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final dateFormat = DateFormat('MMM d');

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        context.push('/customer/orders/${widget.order.id}');
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 100),
        color: _pressed
            ? widget.colors.surfaceVariant.withValues(alpha: 0.6)
            : Colors.transparent,
        padding: const EdgeInsets.symmetric(
          vertical: AppSpacing.sm + 2,
        ),
        child: Row(
          children: [
            // Icon
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: widget.colors.surfaceVariant,
                borderRadius: AppRadius.borderMd,
              ),
              child: Icon(
                widget.icon,
                color: widget.colors.onSurfaceDim,
                size: 20,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),

            // Order details
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        widget.order.orderId,
                        style: AppTypography.bodyBold.copyWith(
                          color: widget.colors.onBackground,
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: widget.colors.surfaceVariant,
                          borderRadius: AppRadius.borderFull,
                        ),
                        child: Text(
                          widget.order.category,
                          style: AppTypography.overline.copyWith(
                            color: widget.colors.onSurfaceDim,
                            fontSize: 9,
                            letterSpacing: 0.3,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      Flexible(
                        child: StatusBadge(
                          label: widget.order.orderStatus.displayName,
                          variant: widget.variant,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        dateFormat.format(widget.order.createdAt),
                        style: AppTypography.caption.copyWith(
                          color: widget.colors.onSurfaceDim,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(width: AppSpacing.sm),

            // Price + chevron
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(
                  '₱${widget.order.totalPrice.toStringAsFixed(0)}',
                  style: AppTypography.bodyBold.copyWith(
                    color: widget.colors.onBackground,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 2),
                Icon(
                  Icons.chevron_right_rounded,
                  color: widget.colors.disabled,
                  size: 18,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
