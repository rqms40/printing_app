import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/history/providers/earnings_provider.dart';
import 'package:printing_app/features/rider/shared/rider_delivery_status.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_page_header.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';
import 'package:printing_app/utils/formatters.dart';

/// Delivery history with earnings dashboard.
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
    final deliveriesState = ref.watch(deliveriesProvider);
    final earnings = ref.watch(earningsProvider);

    final completed =
        deliveriesState.views
            .where((v) => v.status == DeliveryStatus.delivered)
            .toList()
          ..sort(
            (a, b) => (b.assignment.deliveredAt ?? b.assignment.updatedAt)
                .compareTo(a.assignment.deliveredAt ?? a.assignment.updatedAt),
          );

    if (deliveriesState.isLoading && completed.isEmpty) {
      return ColoredBox(
        color: colors.background,
        child: const SafeArea(child: OrderListSkeleton()),
      );
    }

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: RefreshIndicator(
          color: colors.accent,
          onRefresh: () async {
            await ref.read(deliveriesProvider.notifier).refreshAssignments();
            await ref.read(earningsProvider.notifier).refreshEarnings();
          },
          child: completed.isEmpty
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  children: const [
                    RiderPageHeader(
                      title: 'History',
                      subtitle: 'Track earnings and completed routes',
                    ),
                    EmptyState(
                      heading: 'No delivery history yet',
                      body:
                          'Completed deliveries and fees will appear here after your first drop-off.',
                      icon: HugeIcons.strokeRoundedClock01,
                    ),
                  ],
                )
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
                  children: [
                    RiderPageHeader(
                      title: 'History',
                      subtitle:
                          '${earnings.deliveries} deliveries · ${formatCurrency(earnings.total)} total',
                    ).animate().fadeIn(duration: 350.ms),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xl,
                      ),
                      child: _EarningsHeroCard(
                        earnings: earnings,
                        colors: colors,
                      ),
                    ).animate().fadeIn(duration: 400.ms, delay: 60.ms),
                    const SizedBox(height: AppSpacing.lg),
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xl,
                      ),
                      child: Text(
                        'COMPLETED DELIVERIES',
                        style: AppTypography.overline.copyWith(
                          color: colors.onSurfaceDim,
                          letterSpacing: 1.5,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    ...completed.asMap().entries.map((entry) {
                      final view = entry.value;
                      final visual = riderDeliveryVisual(view.status, colors);
                      return Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.xl,
                          0,
                          AppSpacing.xl,
                          AppSpacing.sm,
                        ),
                        child:
                            AppCard(
                              onTap: () =>
                                  context.push('/rider/deliveries/${view.id}'),
                              child: Row(
                                children: [
                                  Container(
                                    width: 44,
                                    height: 44,
                                    decoration: BoxDecoration(
                                      color: visual.tint.withValues(
                                        alpha: 0.12,
                                      ),
                                      borderRadius: AppRadius.borderMd,
                                    ),
                                    child: Center(
                                      child: HugeIcon(
                                        icon: visual.icon,
                                        color: visual.tint,
                                        size: 20,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: AppSpacing.md),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          view.order.orderRef,
                                          style: AppTypography.bodyBold
                                              .copyWith(
                                                color: colors.onBackground,
                                              ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          view.assignment.deliveredAt != null
                                              ? formatDate(
                                                  view.assignment.deliveredAt!,
                                                )
                                              : 'Completed',
                                          style: AppTypography.caption.copyWith(
                                            color: colors.onSurfaceDim,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  Column(
                                    crossAxisAlignment: CrossAxisAlignment.end,
                                    children: [
                                      Text(
                                        formatCurrency(view.order.deliveryFee),
                                        style: AppTypography.bodyBold.copyWith(
                                          color: colors.onBackground,
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      StatusBadge(
                                        label: visual.label,
                                        variant: visual.badgeVariant,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ).animate().fadeIn(
                              duration: 350.ms,
                              delay: (entry.key * 40).ms,
                            ),
                      );
                    }),
                  ],
                ),
        ),
      ),
    );
  }
}

class _EarningsHeroCard extends StatelessWidget {
  const _EarningsHeroCard({required this.earnings, required this.colors});

  final EarningsData earnings;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outline.withValues(alpha: 0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: AppColors.brandLogo,
                  borderRadius: AppRadius.borderFull,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'EARNINGS',
                style: AppTypography.overline.copyWith(
                  color: colors.onSurfaceDim,
                  letterSpacing: 1.5,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            formatCurrency(earnings.total),
            style: AppTypography.h1.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            '${earnings.deliveries} completed deliveries',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.lg),
          Row(
            children: [
              _EarningsTile(
                label: 'Today',
                amount: earnings.today,
                colors: colors,
              ),
              _EarningsTile(
                label: 'This week',
                amount: earnings.thisWeek,
                colors: colors,
              ),
              _EarningsTile(
                label: 'This month',
                amount: earnings.thisMonth,
                colors: colors,
              ),
            ],
          ),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            formatCurrency(amount),
            style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }
}
