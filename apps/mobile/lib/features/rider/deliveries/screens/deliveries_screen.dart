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
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/deliveries/widgets/delivery_card.dart';
import 'package:printing_app/features/rider/deliveries/widgets/rider_active_banner.dart';
import 'package:printing_app/features/rider/history/providers/earnings_provider.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_page_header.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/pill_tab_bar.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';
import 'package:printing_app/utils/formatters.dart';

/// Rider delivery queue — new, in-progress, and completed assignments.
class DeliveriesScreen extends ConsumerStatefulWidget {
  const DeliveriesScreen({super.key});

  @override
  ConsumerState<DeliveriesScreen> createState() => _DeliveriesScreenState();
}

class _DeliveriesScreenState extends ConsumerState<DeliveriesScreen> {
  int _selectedTab = 0;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  List<RiderAssignmentView> _tabViews(DeliveriesState state) {
    return switch (_selectedTab) {
      0 => state.newAssignments,
      1 => state.inProgressAssignments,
      _ => state.completedAssignments,
    };
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(deliveriesProvider);
    final notifier = ref.read(deliveriesProvider.notifier);
    final profile = ref.watch(riderProfileProvider);
    final earnings = ref.watch(earningsProvider);
    final active = state.activeDelivery;
    final tabViews = _tabViews(state);

    return ColoredBox(
      color: RiderTheme.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RiderPageHeader(
              title: 'Orders',
              subtitle: profile.isAvailable
                  ? 'You are online and ready for routes'
                  : 'Go online to receive new assignments',
              trailing: IconButton(
                onPressed: state.isRefreshing
                    ? null
                    : () => notifier.refreshAssignments(),
                icon: state.isRefreshing
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: colors.accent,
                        ),
                      )
                    : HugeIcon(
                        icon: HugeIcons.strokeRoundedRefresh,
                        color: colors.onBackground,
                        size: 22,
                      ),
              ),
            ).animate().fadeIn(duration: 350.ms).slideY(begin: 0.02, duration: 350.ms),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: Row(
                children: [
                  _StatChip(
                    label: 'New',
                    value: '${state.newAssignments.length}',
                    colors: colors,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _StatChip(
                    label: 'Active',
                    value: '${state.inProgressAssignments.length}',
                    colors: colors,
                    highlight: state.inProgressAssignments.isNotEmpty,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  _StatChip(
                    label: 'Today',
                    value: formatCurrency(earnings.today),
                    colors: colors,
                  ),
                ],
              ),
            ).animate().fadeIn(duration: 350.ms, delay: 40.ms),

            if (active != null) ...[
              const SizedBox(height: AppSpacing.md),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: RiderActiveBanner(
                  view: active,
                  onTap: () => context.push(
                    '/rider/deliveries/${active.id}/active',
                  ),
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 80.ms),
            ],

            const SizedBox(height: AppSpacing.md),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: PillTabBar(
                tabs: [
                  PillTab(
                    label: 'New',
                    count: state.newAssignments.length,
                  ),
                  PillTab(
                    label: 'In Progress',
                    count: state.inProgressAssignments.length,
                  ),
                  PillTab(
                    label: 'Done',
                    count: state.completedAssignments.length,
                  ),
                ],
                selectedIndex: _selectedTab,
                onTabChanged: (i) => setState(() => _selectedTab = i),
              ),
            ),

            if (state.errorMessage != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Text(
                  state.errorMessage!,
                  style: AppTypography.caption.copyWith(color: colors.warning),
                ),
              ),
            ],

            const SizedBox(height: AppSpacing.md),

            Expanded(
              child: state.isLoading
                  ? const OrderListSkeleton()
                  : RefreshIndicator(
                      color: colors.accent,
                      onRefresh: notifier.refreshAssignments,
                      child: tabViews.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                EmptyState(
                                  heading: switch (_selectedTab) {
                                    0 => 'No new assignments',
                                    1 => 'No deliveries in progress',
                                    _ => 'No completed deliveries',
                                  },
                                  body: switch (_selectedTab) {
                                    0 =>
                                      'New jobs from dispatch will appear here when you are online.',
                                    1 =>
                                      'Accept an assignment to start your route.',
                                    _ =>
                                      'Finished deliveries and earnings will show up here.',
                                  },
                                  icon: switch (_selectedTab) {
                                    0 => HugeIcons.strokeRoundedNotification02,
                                    1 => HugeIcons.strokeRoundedDeliveryTruck02,
                                    _ => HugeIcons.strokeRoundedCheckmarkCircle02,
                                  },
                                ),
                              ],
                            )
                          : ListView.builder(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(
                                AppSpacing.xl,
                                0,
                                AppSpacing.xl,
                                AppSpacing.xxl,
                              ),
                              itemCount: tabViews.length,
                              itemBuilder: (context, index) {
                                final view = tabViews[index];
                                return Padding(
                                  padding: EdgeInsets.only(
                                    bottom: index < tabViews.length - 1
                                        ? AppSpacing.sm
                                        : 0,
                                  ),
                                  child: DeliveryCard(
                                    view: view,
                                    onTap: () {
                                      final path = view.isInProgress
                                          ? '/rider/deliveries/${view.id}/active'
                                          : '/rider/deliveries/${view.id}';
                                      context.push(path);
                                    },
                                    onAccept: () =>
                                        notifier.acceptAssignment(view.id),
                                    onDecline: () =>
                                        notifier.declineAssignment(view.id),
                                  )
                                      .animate()
                                      .fadeIn(
                                        duration: 350.ms,
                                        delay: (index * 40).ms,
                                      )
                                      .slideY(
                                        begin: 0.02,
                                        duration: 350.ms,
                                        delay: (index * 40).ms,
                                      ),
                                );
                              },
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  const _StatChip({
    required this.label,
    required this.value,
    required this.colors,
    this.highlight = false,
  });

  final String label;
  final String value;
  final AppColorSet colors;
  final bool highlight;

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: highlight
              ? colors.brand.withValues(alpha: 0.12)
              : colors.surface,
          borderRadius: AppRadius.borderMd,
          border: Border.all(
            color: highlight
                ? colors.brand.withValues(alpha: 0.3)
                : colors.outline.withValues(alpha: 0.5),
          ),
        ),
        child: Column(
          children: [
            Text(
              value,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
      ),
    );
  }
}