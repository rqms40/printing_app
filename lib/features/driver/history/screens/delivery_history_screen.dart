import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/driver/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/driver/history/providers/earnings_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

/// Screen showing delivery history and earnings summary.
class DeliveryHistoryScreen extends ConsumerWidget {
  const DeliveryHistoryScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final earnings = ref.watch(earningsProvider);
    final deliveriesState = ref.watch(deliveriesProvider);

    final completedDeliveries = deliveriesState.assignments
        .where((a) => a.status == DeliveryStatus.delivered)
        .toList();

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'History',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        elevation: 0,
      ),
      body: completedDeliveries.isEmpty
          ? const EmptyState(
              heading: 'No delivery history',
              body: 'Completed deliveries will appear here.',
              icon: Iconsax.clock,
            )
          : ListView(
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                // Earnings summary card
                AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'EARNINGS',
                        style: AppTypography.overline
                            .copyWith(color: colors.onSurfaceDim),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Row(
                        children: [
                          _EarningsTile(
                            label: 'Today',
                            amount: earnings.today,
                            colors: colors,
                          ),
                          _EarningsTile(
                            label: 'This Week',
                            amount: earnings.thisWeek,
                            colors: colors,
                          ),
                          _EarningsTile(
                            label: 'This Month',
                            amount: earnings.thisMonth,
                            colors: colors,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),

                // Completed deliveries list
                Text(
                  'COMPLETED DELIVERIES',
                  style: AppTypography.overline
                      .copyWith(color: colors.onSurfaceDim),
                ),
                const SizedBox(height: AppSpacing.sm),

                ...completedDeliveries.map((assignment) {
                  final order = MockData.orders.firstWhere(
                    (o) => o.id == assignment.orderId,
                    orElse: () => MockData.orders.first,
                  );

                  return Padding(
                    padding:
                        const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: AppCard(
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment:
                                  CrossAxisAlignment.start,
                              children: [
                                Text(
                                  order.orderId,
                                  style: AppTypography.bodyBold.copyWith(
                                      color: colors.onBackground),
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                Text(
                                  assignment.deliveredAt != null
                                      ? formatDate(
                                          assignment.deliveredAt!)
                                      : 'Completed',
                                  style: AppTypography.caption.copyWith(
                                      color: colors.onSurfaceDim),
                                ),
                              ],
                            ),
                          ),
                          Column(
                            crossAxisAlignment:
                                CrossAxisAlignment.end,
                            children: [
                              Text(
                                formatCurrency(order.deliveryFee),
                                style: AppTypography.bodyBold.copyWith(
                                    color: colors.onBackground),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              const StatusBadge(
                                label: 'Completed',
                                variant: StatusBadgeVariant.success,
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ],
            ),
    );
  }
}

class _EarningsTile extends StatelessWidget {
  const _EarningsTile({
    required this.label,
    required this.amount,
    required this.colors,
  });

  final String label;
  final double amount;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Column(
        children: [
          Text(
            formatCurrency(amount),
            style:
                AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            label,
            style: AppTypography.caption
                .copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }
}
