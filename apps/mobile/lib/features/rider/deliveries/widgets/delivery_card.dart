import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

/// Delivery assignment card for the rider queue.
class DeliveryCard extends StatefulWidget {
  const DeliveryCard({
    super.key,
    required this.view,
    this.onTap,
    this.onAccept,
    this.onDecline,
    this.showRoutePosition = true,
  });

  final RiderAssignmentView view;
  final VoidCallback? onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;
  final bool showRoutePosition;

  @override
  State<DeliveryCard> createState() => _DeliveryCardState();
}

class _DeliveryCardState extends State<DeliveryCard> {
  bool _pressed = false;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final visual = riderDeliveryVisual(widget.view.status, colors);
    final order = widget.view.order;
    final destination = order.destination;
    final isAssigned = widget.view.status == DeliveryStatus.assigned;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.985 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOut,
        child: Container(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderMd,
            boxShadow: isDark ? null : AppShadows.subtle,
            border: Border.all(
              color: isAssigned
                  ? colors.brand.withValues(alpha: 0.35)
                  : colors.outline.withValues(alpha: 0.5),
              width: isAssigned ? 1 : 0.5,
            ),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: visual.tint.withValues(alpha: 0.12),
                        borderRadius: AppRadius.borderMd,
                      ),
                      child: Center(
                        child: HugeIcon(
                          icon: visual.icon,
                          size: 24,
                          color: visual.tint,
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  order.orderRef,
                                  style: AppTypography.bodyBold.copyWith(
                                    color: colors.onBackground,
                                  ),
                                ),
                              ),
                              if (widget.showRoutePosition &&
                                  widget.view.routePosition != null &&
                                  widget.view.isInProgress)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 8,
                                    vertical: 2,
                                  ),
                                  decoration: BoxDecoration(
                                    color: colors.surfaceVariant,
                                    borderRadius: AppRadius.borderFull,
                                  ),
                                  child: Text(
                                    '#${widget.view.routePosition}',
                                    style: AppTypography.caption.copyWith(
                                      color: colors.onSurfaceDim,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                            ],
                          ),
                          if (destination?.fullAddress != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              destination!.fullAddress!,
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                              ),
                            ),
                          ],
                          const SizedBox(height: AppSpacing.sm),
                          Row(
                            children: [
                              StatusBadge(
                                label: visual.label,
                                variant: visual.badgeVariant,
                              ),
                              const Spacer(),
                              Text(
                                formatCurrency(order.deliveryFee),
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedArrowRight01,
                      size: 18,
                      color: colors.disabled,
                    ),
                  ],
                ),
              ),
              if (isAssigned) ...[
                Divider(
                  height: 1,
                  color: colors.outline.withValues(alpha: 0.4),
                  indent: AppSpacing.md,
                  endIndent: AppSpacing.md,
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.md,
                    AppSpacing.sm,
                    AppSpacing.md,
                    AppSpacing.md,
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          label: 'Decline',
                          variant: AppButtonVariant.ghost,
                          onTap: widget.onDecline,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: AppButton(
                          label: 'Accept',
                          variant: AppButtonVariant.primary,
                          onTap: widget.onAccept,
                          icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}