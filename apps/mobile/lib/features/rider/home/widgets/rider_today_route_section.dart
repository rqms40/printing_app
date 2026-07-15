import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_eta.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';

/// Horizontal carousel of today's stops. Mirrors the customer Daily Grid.
class RiderTodayRouteSection extends StatelessWidget {
  const RiderTodayRouteSection({
    super.key,
    required this.stops,
    required this.onTapStop,
  });

  final List<RiderAssignmentView> stops;
  final void Function(RiderAssignmentView) onTapStop;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          "Today's Route",
          style: AppTypography.h2.copyWith(
            color: colors.onBackground,
            fontSize: 18,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        if (stops.isEmpty)
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
                'No stops on your route yet.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
          )
        else
          SizedBox(
            height: 116,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              clipBehavior: Clip.none,
              itemCount: stops.length,
              separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
              itemBuilder: (context, i) => _StopCard(
                view: stops[i],
                onTap: () => onTapStop(stops[i]),
              ),
            ),
          ),
      ],
    );
  }
}

class _StopCard extends StatelessWidget {
  const _StopCard({required this.view, required this.onTap});

  final RiderAssignmentView view;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final visual = riderDeliveryVisual(view.status, colors);
    final order = view.order;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 200,
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderLg,
          border: Border.all(color: colors.outline, width: 0.5),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                if (view.routePosition != null)
                  Text(
                    'STOP ${view.routePosition}',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 10,
                      letterSpacing: 1.5,
                    ),
                  ),
                const Spacer(),
                Flexible(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: visual.tint.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      visual.label,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.overline.copyWith(
                        color: visual.tint,
                        fontSize: 8,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              order.customerName ?? 'Customer',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              order.destination?.shortLabel ?? order.orderRef,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 11,
              ),
            ),
            const Spacer(),
            Row(
              children: [
                Text(
                  order.orderRef,
                  style: AppTypography.caption.copyWith(
                    color: colors.brand,
                    fontWeight: FontWeight.w700,
                    fontSize: 11,
                  ),
                ),
                const Spacer(),
                if (view.planStop != null)
                  Text(
                    formatEtaMinutes(view.planStop!.legDurationSeconds),
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
