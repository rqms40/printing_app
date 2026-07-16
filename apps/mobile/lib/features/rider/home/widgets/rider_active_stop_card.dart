import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
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

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Active Stop',
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Material(
          color: colors.surface,
          borderRadius: AppRadius.borderLg,
          child: InkWell(
            onTap: onTap,
            borderRadius: AppRadius.borderLg,
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.sm + 4),
              decoration: BoxDecoration(
                borderRadius: AppRadius.borderLg,
                border: Border.all(color: colors.outline, width: 0.5),
              ),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      shape: BoxShape.circle,
                    ),
                    alignment: Alignment.center,
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedUser,
                      color: colors.onSurface,
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm + 4),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          customerName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.brand,
                            fontSize: 14,
                            letterSpacing: 0,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          _orderSummary,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                            fontSize: 11,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              '#${view.order.orderRef}',
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurface,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            if (view.planStop != null) ...[
                              const SizedBox(width: AppSpacing.sm),
                              Flexible(
                                child: Text(
                                  '${formatEtaMinutes(view.planStop!.legDurationSeconds)} · '
                                  '${formatDistanceMeters(view.planStop!.legDistanceMeters)}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: AppTypography.caption.copyWith(
                                    color: colors.onSurfaceDim,
                                    fontSize: 11,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _ActionIcon(
                    key: const ValueKey('rider-stop-message'),
                    icon: HugeIcons.strokeRoundedMessage01,
                    label: 'Message customer',
                    colors: colors,
                    onTap: onMessage,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _ActionIcon(
                    key: const ValueKey('rider-stop-call'),
                    icon: HugeIcons.strokeRoundedCall,
                    label: 'Call customer',
                    colors: colors,
                    onTap: onCall,
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({
    super.key,
    required this.icon,
    required this.label,
    required this.colors,
    this.onTap,
  });

  final dynamic icon;
  final String label;
  final AppColorSet colors;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: label,
      child: Semantics(
        button: true,
        label: label,
        onTap: onTap,
        child: ExcludeSemantics(
          child: Material(
            color: colors.surfaceVariant,
            shape: const CircleBorder(),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: onTap,
              child: SizedBox(
                width: 38,
                height: 38,
                child: Center(
                  child: HugeIcon(icon: icon, color: colors.onSurface, size: 18),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
