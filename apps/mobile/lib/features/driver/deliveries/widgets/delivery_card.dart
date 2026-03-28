import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/utils/formatters.dart';

/// Delivery card with horizontal layout matching the OrderCard pattern.
///
/// Left: 48px status-tinted icon
/// Center: Order ID + address summary, status dot + label + date
/// Right: delivery fee + chevron
/// Expandable accept/decline buttons for assigned status.
class DeliveryCard extends StatefulWidget {
  const DeliveryCard({
    super.key,
    required this.assignment,
    required this.order,
    this.address,
    this.onTap,
    this.onAccept,
    this.onDecline,
  });

  final DeliveryAssignment assignment;
  final Order order;
  final Address? address;
  final VoidCallback? onTap;
  final VoidCallback? onAccept;
  final VoidCallback? onDecline;

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

  _DeliveryVisual _visual(AppColorSet colors) {
    switch (widget.assignment.status) {
      case DeliveryStatus.assigned:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedNotification02,
          colors.warning.withValues(alpha: 0.1),
          colors.warning,
          'Assigned',
        );
      case DeliveryStatus.accepted:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedCheckmarkCircle02,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          'Accepted',
        );
      case DeliveryStatus.pickedUp:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedPackage,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          'Picked Up',
        );
      case DeliveryStatus.onTheWay:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedDeliveryTruck02,
          colors.info.withValues(alpha: 0.1),
          colors.info,
          'On the Way',
        );
      case DeliveryStatus.arrived:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedLocation01,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          'Arrived',
        );
      case DeliveryStatus.delivered:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedCheckmarkCircle02,
          colors.success.withValues(alpha: 0.1),
          colors.success,
          'Delivered',
        );
      case DeliveryStatus.declined:
        return _DeliveryVisual(
          HugeIcons.strokeRoundedCancelCircle,
          colors.error.withValues(alpha: 0.1),
          colors.error,
          'Declined',
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final visual = _visual(colors);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isAssigned = widget.assignment.status == DeliveryStatus.assigned;

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
          child: Column(
            children: [
              // Main horizontal row
              Padding(
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
                          // Order ID + address summary
                          Text(
                            widget.order.orderId,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                          if (widget.address != null) ...[
                            const SizedBox(height: 2),
                            Text(
                              widget.address!.fullAddress,
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
                                  '${visual.statusLabel} \u2022 ${formatDate(widget.assignment.createdAt)}',
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
                          formatCurrency(widget.order.deliveryFee),
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

              // Accept/Decline buttons for assigned status
              if (isAssigned) ...[
                Container(
                  height: 1,
                  margin:
                      const EdgeInsets.symmetric(horizontal: AppSpacing.md),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        colors.outline.withValues(alpha: 0.0),
                        colors.outline.withValues(alpha: 0.4),
                        colors.outline.withValues(alpha: 0.0),
                      ],
                    ),
                  ),
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
                          icon: HugeIcons.strokeRoundedCancelCircle,
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

class _DeliveryVisual {
  const _DeliveryVisual(
      this.icon, this.background, this.foreground, this.statusLabel);

  final dynamic icon;
  final Color background;
  final Color foreground;
  final String statusLabel;
}
