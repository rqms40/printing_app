import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/utils/formatters.dart';

/// Professional order card with status-tinted icon, clean layout,
/// and a chevron indicating it's tappable.
class OrderCard extends StatefulWidget {
  const OrderCard({
    super.key,
    required this.order,
    this.onTap,
  });

  final Order order;
  final VoidCallback? onTap;

  @override
  State<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends State<OrderCard> {
  bool _pressed = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  _OrderVisual _visual(AppColorSet colors) {
    switch (widget.order.orderStatus) {
      case OrderStatus.delivered:
      case OrderStatus.completedPickup:
        return _OrderVisual(
          HugeIcons.strokeRoundedCheckmarkCircle02,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          'Completed',
        );
      case OrderStatus.cancelled:
        return _OrderVisual(
          HugeIcons.strokeRoundedCancelCircle,
          colors.error.withValues(alpha: 0.1),
          colors.error,
          'Cancelled',
        );
      case OrderStatus.fileDeclined:
        return _OrderVisual(
          HugeIcons.strokeRoundedCancel01,
          colors.error.withValues(alpha: 0.1),
          colors.error,
          'Declined',
        );
      case OrderStatus.onTheWay:
      case OrderStatus.pickedUp:
      case OrderStatus.arrivedAtDestination:
        return _OrderVisual(
          HugeIcons.strokeRoundedDeliveryTruck02,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          'In Delivery',
        );
      case OrderStatus.printingInProgress:
      case OrderStatus.finishingMounting:
      case OrderStatus.qualityChecked:
        return _OrderVisual(
          HugeIcons.strokeRoundedPrinter,
          colors.warning.withValues(alpha: 0.1),
          colors.warning,
          'In Production',
        );
      case OrderStatus.readyForDispatch:
      case OrderStatus.driverAssigned:
        return _OrderVisual(
          HugeIcons.strokeRoundedPackage,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          'Ready',
        );
      default:
        return _OrderVisual(
          HugeIcons.strokeRoundedClock01,
          colors.accent.withValues(alpha: 0.08),
          colors.accent,
          'Processing',
        );
    }
  }

  dynamic _categoryIcon() {
    switch (widget.order.category.toLowerCase()) {
      case 'paper':
      case 'document':
        return HugeIcons.strokeRoundedFile02;
      case '3d':
      case '3d print':
        return HugeIcons.strokeRoundedPackage;
      default:
        return HugeIcons.strokeRoundedPrinter;
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final visual = _visual(colors);
    final isDark = Theme.of(context).brightness == Brightness.dark;

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
                      // Order ID + category tag
                      Row(
                        children: [
                          Text(
                            widget.order.orderId,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: colors.surfaceVariant,
                              borderRadius: AppRadius.borderSm,
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                HugeIcon(
                                  icon: _categoryIcon(),
                                  size: 10,
                                  color: colors.onSurfaceDim,
                                ),
                                const SizedBox(width: 3),
                                Text(
                                  widget.order.category.toUpperCase(),
                                  style: AppTypography.caption.copyWith(
                                    color: colors.onSurfaceDim,
                                    fontSize: 10,
                                    fontWeight: FontWeight.w600,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 6),

                      // Status label + date
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
                          Text(
                            visual.statusLabel,
                            style: AppTypography.caption.copyWith(
                              color: visual.foreground,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            '\u2022',
                            style: TextStyle(
                              color: colors.disabled,
                              fontSize: 10,
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Text(
                            formatDate(widget.order.createdAt),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
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
                      formatCurrency(widget.order.totalPrice),
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
}

class _OrderVisual {
  const _OrderVisual(this.icon, this.background, this.foreground, this.statusLabel);

  final dynamic icon;
  final Color background;
  final Color foreground;
  final String statusLabel;
}
