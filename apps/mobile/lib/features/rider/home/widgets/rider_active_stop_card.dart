import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_eta.dart';

/// Active stop card (cockpit bottom): avatar, customer, order summary, ref,
/// message + call actions. Theme-following.
class RiderActiveStopCard extends StatelessWidget {
  const RiderActiveStopCard({
    super.key,
    required this.view,
    this.onCall,
    this.onMessage,
    this.onTap,
  });

  final RiderAssignmentView view;
  final VoidCallback? onCall;
  final VoidCallback? onMessage;
  final VoidCallback? onTap;

  String get _orderSummary {
    final category = view.order.category;
    final qty = view.order.quantity;
    return '$category, $qty ${qty == 1 ? 'Copy' : 'Copies'}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final customerName = view.order.customerName ?? 'Customer';

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Active Stop',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              fontSize: 18,
              letterSpacing: 0,
            ),
          ),
          const SizedBox(height: 6),
          Material(
            color: colors.surface,
            borderRadius: BorderRadius.circular(8),
            child: InkWell(
              onTap: onTap,
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.fromLTRB(8, 8, 10, 8),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: colors.outline.withValues(alpha: 0.8)),
                ),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        color: colors.surfaceVariant,
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.onSurface, width: 3),
                      ),
                      child: Icon(
                        Icons.person_rounded,
                        color: colors.onSurface,
                        size: 31,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            customerName,
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.brand,
                              fontSize: 12,
                              letterSpacing: 0,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _orderSummary,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurface,
                              fontSize: 10,
                              height: 1.05,
                            ),
                          ),
                          Text(
                            '#${view.order.orderRef}',
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurface,
                              fontSize: 9,
                              fontWeight: FontWeight.w800,
                              height: 1.1,
                            ),
                          ),
                          if (view.planStop != null)
                            Text(
                              '${formatEtaMinutes(view.planStop!.legDurationSeconds)} · '
                              '${formatDistanceMeters(view.planStop!.legDistanceMeters)}',
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                                fontSize: 10,
                                height: 1.2,
                              ),
                            ),
                        ],
                      ),
                    ),
                    _ActionIcon(
                      key: const ValueKey('rider-stop-message'),
                      icon: HugeIcons.strokeRoundedMail01,
                      colors: colors,
                      onTap: onMessage,
                    ),
                    const SizedBox(width: 6),
                    _ActionIcon(
                      key: const ValueKey('rider-stop-call'),
                      icon: HugeIcons.strokeRoundedCall,
                      colors: colors,
                      onTap: onCall,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({
    super.key,
    required this.icon,
    required this.colors,
    this.onTap,
  });

  final dynamic icon;
  final AppColorSet colors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: colors.surfaceVariant,
      shape: const CircleBorder(),
      child: InkWell(
        customBorder: const CircleBorder(),
        onTap: onTap,
        child: SizedBox(
          width: 28,
          height: 28,
          child: Center(
            child: HugeIcon(icon: icon, color: colors.onSurface, size: 15),
          ),
        ),
      ),
    );
  }
}
