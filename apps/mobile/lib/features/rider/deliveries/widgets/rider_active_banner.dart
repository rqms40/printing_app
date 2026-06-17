import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';

/// Prominent CTA to continue an in-progress delivery.
class RiderActiveBanner extends StatelessWidget {
  const RiderActiveBanner({
    super.key,
    required this.view,
    required this.onTap,
  });

  final RiderAssignmentView view;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final visual = riderDeliveryVisual(view.status, colors);

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderMd,
        child: Ink(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                colors.accent,
                colors.accentSoft,
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: AppRadius.borderMd,
          ),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.accentOnColor.withValues(alpha: 0.15),
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: Center(
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedNavigation03,
                      color: colors.accentOnColor,
                      size: 22,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Continue delivery',
                        style: AppTypography.bodyBold.copyWith(
                          color: colors.accentOnColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${view.order.orderRef} · ${visual.label}',
                        style: AppTypography.caption.copyWith(
                          color: colors.accentOnColor.withValues(alpha: 0.8),
                        ),
                      ),
                    ],
                  ),
                ),
                HugeIcon(
                  icon: HugeIcons.strokeRoundedArrowRight01,
                  color: colors.accentOnColor,
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}