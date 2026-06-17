import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

/// Rider alerts tab — new assignments and status updates.
class RiderAlertsScreen extends ConsumerWidget {
  const RiderAlertsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(deliveriesProvider);
    final newJobs = state.newAssignments;

    return ColoredBox(
      color: RiderTheme.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
              child: Text(
                'Alerts',
                style: AppTypography.h1.copyWith(color: RiderTheme.textPrimary),
              ),
            ),
            Expanded(
              child: newJobs.isEmpty
                  ? const EmptyState(
                      heading: 'No new alerts',
                      body: 'Assignment notifications will appear here.',
                      icon: HugeIcons.strokeRoundedNotification02,
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(horizontal: 20),
                      itemCount: newJobs.length,
                      itemBuilder: (context, index) {
                        final view = newJobs[index];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 10),
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: RiderTheme.surfaceElevated,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: RiderTheme.mapLine),
                          ),
                          child: Row(
                            children: [
                              const HugeIcon(
                                icon: HugeIcons.strokeRoundedDeliveryTruck02,
                                color: RiderTheme.yellow,
                                size: 22,
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'New assignment',
                                      style: AppTypography.bodyBold.copyWith(
                                        color: RiderTheme.textPrimary,
                                      ),
                                    ),
                                    Text(
                                      '#${view.order.orderRef}',
                                      style: AppTypography.caption.copyWith(
                                        color: RiderTheme.textSecondary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}