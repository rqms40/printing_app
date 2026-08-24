import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/utils/formatters.dart';

/// Professional order card with status-tinted icon, clean layout,
/// and a chevron indicating it's tappable.
class OrderCard extends ConsumerStatefulWidget {
  const OrderCard({super.key, required this.order, this.onTap});

  final Order order;
  final VoidCallback? onTap;

  @override
  ConsumerState<OrderCard> createState() => _OrderCardState();
}

class _OrderCardState extends ConsumerState<OrderCard> {
  bool _pressed = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  /// Icon + semantic color for density; [statusLabel] always uses the
  /// human-readable [OrderStatus.displayName] (never color alone).
  _OrderVisual _visual(AppColorSet colors) {
    final label = widget.order.orderStatus.displayName;
    switch (widget.order.orderStatus) {
      case OrderStatus.delivered:
      case OrderStatus.collectedByCustomer:
      case OrderStatus.issueWindowOpen:
      case OrderStatus.completed:
        return _OrderVisual(
          HugeIcons.strokeRoundedCheckmarkCircle02,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          label,
        );
      case OrderStatus.cancelled:
      case OrderStatus.fileRejected:
      case OrderStatus.deliveryFailed:
        return _OrderVisual(
          HugeIcons.strokeRoundedCancelCircle,
          colors.error.withValues(alpha: 0.1),
          colors.error,
          label,
        );
      case OrderStatus.outForDelivery:
      case OrderStatus.pickedUp:
        return _OrderVisual(
          HugeIcons.strokeRoundedDeliveryTruck02,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          label,
        );
      case OrderStatus.production:
      case OrderStatus.supplierSelfQc:
      case OrderStatus.paymentAuthorized:
      case OrderStatus.awaitingPayment:
      case OrderStatus.supplierAssigned:
      case OrderStatus.supplierAccepted:
        return _OrderVisual(
          HugeIcons.strokeRoundedPrinter,
          colors.warning.withValues(alpha: 0.1),
          colors.warning,
          label,
        );
      case OrderStatus.readyForDispatch:
      case OrderStatus.riderAssigned:
        return _OrderVisual(
          HugeIcons.strokeRoundedPackage,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          label,
        );
      case OrderStatus.draft:
      case OrderStatus.submitted:
      case OrderStatus.needsQa:
      case OrderStatus.clientCorrection:
      case OrderStatus.proofApproval:
      case OrderStatus.approvedForMatching:
        return _OrderVisual(
          HugeIcons.strokeRoundedClock01,
          colors.accent.withValues(alpha: 0.08),
          colors.accent,
          label,
        );
    }
  }

  dynamic _categoryIcon() {
    if (widget.order.hasMixedItemTypes) {
      return HugeIcons.strokeRoundedShoppingBag01;
    }
    if (widget.order.isBatchOrder) {
      return HugeIcons.strokeRoundedShoppingBag01;
    }
    switch (widget.order.orderTypeShortLabel) {
      case 'Paper':
        return HugeIcons.strokeRoundedFile02;
      case '3D':
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
    final isBatch = widget.order.isBatchOrder;
    final typeLabel = widget.order.orderTypeShortLabel.toUpperCase();
    final settings =
        ref.watch(deliveryFeeSettingsProvider).asData?.value ??
        DeliveryFeeSettings.fallback;
    final displayTotal = settings.customerFacingTotalOf(widget.order);

    return Semantics(
      container: true,
      button: widget.onTap != null,
      label:
          'Order ${widget.order.orderId}. $typeLabel. '
          '${visual.statusLabel}. ${formatCurrency(displayTotal)}. '
          '${formatDate(widget.order.createdAt)}.',
      onTap: widget.onTap,
      child: ExcludeSemantics(
        child: GestureDetector(
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
                              Flexible(
                                child: Text(
                                  widget.order.orderId,
                                  style: AppTypography.bodyBold.copyWith(
                                    color: colors.onBackground,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
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
                                      typeLabel,
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

                          if (isBatch) ...[
                            Text(
                              '${widget.order.itemCount} ${widget.order.itemCount == 1 ? 'item' : 'items'} · ${widget.order.itemSummary}',
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 6),
                          ],

                          // Status label + date (+ delivery OTP when active)
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
                              if (widget.order.deliveryOtp != null &&
                                  widget.order.deliveryOtp!
                                      .trim()
                                      .isNotEmpty) ...[
                                const SizedBox(width: 8),
                                Text(
                                  'OTP ${widget.order.deliveryOtp!.trim()}',
                                  style: AppTypography.caption.copyWith(
                                    color: colors.brand,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
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
                          formatCurrency(displayTotal),
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
        ),
      ),
    );
  }
}

class _OrderVisual {
  const _OrderVisual(
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
