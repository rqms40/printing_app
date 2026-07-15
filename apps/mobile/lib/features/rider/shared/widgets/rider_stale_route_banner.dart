import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Warning strip shown when the server marked the dispatch plan's routing
/// data stale (e.g. after a skipped stop). Rendered only while
/// `DeliveriesState.dataStale` is true; refreshing fetches a fresh plan.
class RiderStaleRouteBanner extends StatelessWidget {
  const RiderStaleRouteBanner({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('rider-stale-route-banner'),
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: AppSpacing.sm),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF3D2E00),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFFDE58), width: 1),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.warning_amber_rounded,
            color: Color(0xFFFFDE58),
            size: 18,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              'Route data may be outdated — pull to refresh',
              style: AppTypography.caption.copyWith(
                color: const Color(0xFFFFF3C4),
                fontSize: 12,
                height: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
