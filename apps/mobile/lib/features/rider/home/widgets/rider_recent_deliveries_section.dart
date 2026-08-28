import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/utils/formatters.dart';

/// Recently completed deliveries list. Mirrors the customer Recent Orders.
class RiderRecentDeliveriesSection extends StatelessWidget {
  const RiderRecentDeliveriesSection({
    super.key,
    required this.completed,
    required this.onTap,
  });

  final List<RiderAssignmentView> completed;
  final void Function(RiderAssignmentView) onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final items = completed.take(5).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Recent Deliveries',
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (items.isEmpty)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadius.borderLg,
              border: Border.all(color: colors.outline, width: 0.5),
            ),
            child: Center(
              child: Text(
                'No completed deliveries yet.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
          )
        else
          ...items.map((v) => _RecentRow(view: v, onTap: () => onTap(v))),
      ],
    );
  }
}

class _RecentRow extends StatelessWidget {
  const _RecentRow({required this.view, required this.onTap});

  final RiderAssignmentView view;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm + 2),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(color: colors.outline, width: 0.5),
          ),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: visual.tint.withValues(alpha: 0.16),
                  borderRadius: AppRadius.borderMd,
                ),
                alignment: Alignment.center,
                child: HugeIcon(icon: visual.icon, size: 18, color: visual.tint),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.customerName ?? order.orderRef,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${order.orderRef} · ${visual.label}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              Text(
                formatCurrency(order.deliveryFeePesos),
                style: AppTypography.bodyBold.copyWith(
                  color: colors.brand,
                  fontSize: 12,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
