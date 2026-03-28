import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/driver/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/driver/deliveries/widgets/delivery_card.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/pill_tab_bar.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';

/// Screen displaying the driver's list of delivery assignments.
class DeliveriesScreen extends ConsumerStatefulWidget {
  const DeliveriesScreen({super.key});

  @override
  ConsumerState<DeliveriesScreen> createState() => _DeliveriesScreenState();
}

class _DeliveriesScreenState extends ConsumerState<DeliveriesScreen> {
  bool _isLoading = true;
  int _selectedTab = 0;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isLoading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final deliveriesState = ref.watch(deliveriesProvider);
    final notifier = ref.read(deliveriesProvider.notifier);
    final allAssignments = deliveriesState.assignments;

    // Split into active vs completed
    final activeAssignments = allAssignments
        .where((a) =>
            a.status != DeliveryStatus.delivered &&
            a.status != DeliveryStatus.declined)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    final completedAssignments = allAssignments
        .where((a) =>
            a.status == DeliveryStatus.delivered ||
            a.status == DeliveryStatus.declined)
        .toList()
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    final activeCount = activeAssignments.length;
    final completedCount = completedAssignments.length;

    final displayedAssignments =
        _selectedTab == 0 ? activeAssignments : completedAssignments;

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.only(
                left: AppSpacing.xl,
                right: AppSpacing.xl,
                top: AppSpacing.lg,
                bottom: AppSpacing.md,
              ),
              child: Text(
                'Deliveries',
                style:
                    AppTypography.h1.copyWith(color: colors.onBackground),
              ),
            )
                .animate()
                .fadeIn(duration: 350.ms, curve: Curves.easeOut)
                .slideY(
                    begin: 0.02, duration: 350.ms, curve: Curves.easeOut),

            // Pill tab selector
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: PillTabBar(
                tabs: [
                  PillTab(label: 'Active', count: activeCount),
                  PillTab(label: 'Completed', count: completedCount),
                ],
                selectedIndex: _selectedTab,
                onTabChanged: (i) => setState(() => _selectedTab = i),
              ),
            )
                .animate()
                .fadeIn(
                    duration: 350.ms,
                    delay: 60.ms,
                    curve: Curves.easeOut)
                .slideY(
                    begin: 0.02,
                    duration: 350.ms,
                    delay: 60.ms,
                    curve: Curves.easeOut),

            const SizedBox(height: AppSpacing.md),

            // Content
            Expanded(
              child: _isLoading
                  ? const OrderListSkeleton()
                  : AnimatedSwitcher(
                      duration: const Duration(milliseconds: 250),
                      switchInCurve: Curves.easeOut,
                      switchOutCurve: Curves.easeIn,
                      child: displayedAssignments.isEmpty
                          ? EmptyState(
                              key: ValueKey('empty_$_selectedTab'),
                              heading: _selectedTab == 0
                                  ? 'No active deliveries'
                                  : 'No completed deliveries',
                              body: _selectedTab == 0
                                  ? 'New delivery assignments will appear here when assigned by admin.'
                                  : 'Your finished deliveries will show here.',
                              icon: _selectedTab == 0
                                  ? HugeIcons.strokeRoundedDeliveryTruck02
                                  : HugeIcons
                                      .strokeRoundedCheckmarkCircle02,
                            )
                          : RefreshIndicator(
                              key: ValueKey('list_$_selectedTab'),
                              color: colors.accent,
                              onRefresh: () async {
                                notifier.reset();
                              },
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: AppSpacing.xl),
                                itemCount: displayedAssignments.length,
                                itemBuilder: (context, index) {
                                  final assignment =
                                      displayedAssignments[index];
                                  final order =
                                      MockData.orders.firstWhere(
                                    (o) => o.id == assignment.orderId,
                                    orElse: () => MockData.orders.first,
                                  );
                                  final address =
                                      order.deliveryAddressId != null
                                          ? MockData.addresses
                                              .cast<dynamic>()
                                              .firstWhere(
                                                (a) =>
                                                    a.id ==
                                                    order
                                                        .deliveryAddressId,
                                                orElse: () => null,
                                              )
                                          : null;

                                  return Padding(
                                    padding: EdgeInsets.only(
                                      bottom: index <
                                              displayedAssignments
                                                      .length -
                                                  1
                                          ? AppSpacing.sm
                                          : AppSpacing.xxl,
                                    ),
                                    child: DeliveryCard(
                                      assignment: assignment,
                                      order: order,
                                      address: address,
                                      onTap: () {
                                        context.push(
                                            '/driver/deliveries/${assignment.id}');
                                      },
                                      onAccept: () => notifier
                                          .acceptAssignment(
                                              assignment.id),
                                      onDecline: () => notifier
                                          .declineAssignment(
                                              assignment.id),
                                    )
                                        .animate()
                                        .fadeIn(
                                          duration: 350.ms,
                                          delay: (index * 50).ms,
                                          curve: Curves.easeOut,
                                        )
                                        .slideY(
                                          begin: 0.02,
                                          duration: 350.ms,
                                          delay: (index * 50).ms,
                                          curve: Curves.easeOut,
                                        ),
                                  );
                                },
                              ),
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
