import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Conditional "resume active delivery" card. Mirrors the customer
/// resume-queue card. Render only when an active delivery exists.
class RiderResumeActiveCard extends StatelessWidget {
  const RiderResumeActiveCard({
    super.key,
    required this.orderRef,
    required this.stopCount,
    required this.onTap,
  });

  final String orderRef;
  final int stopCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final stopsLabel = stopCount == 1 ? 'stop' : 'stops';

    return Material(
      color: colors.surface,
      borderRadius: AppRadius.borderLg,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.borderLg,
        child: Container(
          decoration: BoxDecoration(
            borderRadius: AppRadius.borderLg,
            border: Border.all(color: colors.outline, width: 1),
          ),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: colors.brand,
                  borderRadius: AppRadius.borderMd,
                ),
                alignment: Alignment.center,
                child: const HugeIcon(
                  icon: HugeIcons.strokeRoundedDeliveryTruck02,
                  size: 18,
                  color: Colors.black,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Resume active delivery',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 13.5,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '$orderRef · $stopCount $stopsLabel on route',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontSize: 11.5,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Open',
                style: AppTypography.caption.copyWith(
                  color: colors.brand,
                  fontWeight: FontWeight.w700,
                  fontSize: 11.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
