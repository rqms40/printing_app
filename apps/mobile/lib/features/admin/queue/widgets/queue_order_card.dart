import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/utils/formatters.dart';

/// Order card for the admin queue with horizontal layout matching the
/// customer OrderCard pattern.
///
/// Left: 48px status-tinted icon
/// Center: Order ID + customer name, status dot + label + date
/// Right: price + chevron
class QueueOrderCard extends StatefulWidget {
  const QueueOrderCard({super.key, required this.order, this.onTap});

  final Order order;
  final VoidCallback? onTap;

  @override
  State<QueueOrderCard> createState() => _QueueOrderCardState();
}

class _QueueOrderCardState extends State<QueueOrderCard> {
  bool _pressed = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  _QueueVisual _visual(AppColorSet colors) {
    switch (widget.order.orderStatus) {
      case OrderStatus.orderPlaced:
      case OrderStatus.fileVerified:
        return _QueueVisual(
          HugeIcons.strokeRoundedFile02,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          'New',
        );
      case OrderStatus.printingInProgress:
      case OrderStatus.finishingMounting:
        return _QueueVisual(
          HugeIcons.strokeRoundedPrinter,
          colors.warning.withValues(alpha: 0.1),
          colors.warning,
          'In Production',
        );
      case OrderStatus.qualityChecked:
        return _QueueVisual(
          HugeIcons.strokeRoundedCheckmarkCircle02,
          colors.warning.withValues(alpha: 0.1),
          colors.warning,
          'Quality Checked',
        );
      case OrderStatus.readyForDispatch:
      case OrderStatus.riderAssigned:
        return _QueueVisual(
          HugeIcons.strokeRoundedPackage,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          'Ready',
        );
      case OrderStatus.pickedUp:
      case OrderStatus.onTheWay:
      case OrderStatus.arrivedAtDestination:
        return _QueueVisual(
          HugeIcons.strokeRoundedDeliveryTruck02,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          'In Delivery',
        );
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return _QueueVisual(
          HugeIcons.strokeRoundedCheckmarkCircle02,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          'Completed',
        );
      case OrderStatus.fileDeclined:
      case OrderStatus.cancelled:
        return _QueueVisual(
          HugeIcons.strokeRoundedCancelCircle,
          colors.error.withValues(alpha: 0.1),
          colors.error,
          widget.order.orderStatus == OrderStatus.cancelled
              ? 'Cancelled'
              : 'Declined',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final visual = _visual(colors);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final itemSummary = _itemSummary(widget.order);

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.98 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderMd,
            boxShadow: isDark ? null : AppShadows.subtle,
            border: Border.all(
              color: colors.outline.withValues(alpha: 0.5),
              width: 0.5,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                // Status icon with semantic background
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    color: visual.background,
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: Center(
                    child: HugeIcon(
                      icon: visual.icon,
                      size: 22,
                      color: visual.foreground,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),

                // Content
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Order ID + customer name
                      Text(
                        widget.order.orderId,
                        style: AppTypography.bodyBold.copyWith(
                          color: colors.onBackground,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Customer ${widget.order.userId}',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      if (itemSummary.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          itemSummary,
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      const SizedBox(height: 6),

                      // Status dot + label + date
                      Row(
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(
                              color: visual.foreground,
                              shape: BoxShape.circle,
                            ),
                          ),
                          const SizedBox(width: 6),
                          Flexible(
                            child: Text(
                              '${visual.statusLabel} \u2022 ${formatDate(widget.order.createdAt)}',
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // Price + chevron
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      formatCurrency(
                        widget.order.totalPrice + widget.order.deliveryFee,
                      ),
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    const SizedBox(height: 4),
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedArrowRight01,
                      size: 16,
                      color: colors.disabled,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  String _itemSummary(Order order) {
    final items = order.lineItems;
    final countLabel =
        '${items.length} ${items.length == 1 ? 'item' : 'items'}';
    return '${order.orderTypeShortLabel} · $countLabel · ${order.itemSummary}';
  }
}

class _QueueVisual {
  const _QueueVisual(
    this.icon,
    this.background,
    this.foreground,
    this.statusLabel,
  );

  final dynamic icon;
  final Color background;
  final Color foreground;
  final String statusLabel;
}
