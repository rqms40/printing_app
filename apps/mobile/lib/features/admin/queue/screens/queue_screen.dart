import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/admin/queue/providers/queue_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/features/admin/queue/widgets/queue_order_card.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/pill_tab_bar.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';

/// Admin order queue screen with pill-style tab selector and search.
class QueueScreen extends ConsumerStatefulWidget {
  const QueueScreen({super.key});

  @override
  ConsumerState<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends ConsumerState<QueueScreen> {
  final _searchController = TextEditingController();
  bool _isLoading = true;
  int _selectedTab = 0;

  static const _tabs = [
    QueueTab.newOrders,
    QueueTab.inProduction,
    QueueTab.done,
    QueueTab.all,
  ];

  static const _tabLabels = ['New', 'Production', 'Done', 'All'];

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() => _isLoading = false);
        // Refresh orders from API every time queue screen opens
        ref.read(queueProvider.notifier).refreshOrders();
      }
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  /// Compute counts for each tab from the full order list.
  List<int> _tabCounts(QueueState queueState) {
    final orders = queueState.orders;
    final newCount = orders
        .where((o) =>
            o.orderStatus == OrderStatus.orderPlaced ||
            o.orderStatus == OrderStatus.fileVerified)
        .length;
    final prodCount = orders
        .where((o) =>
            o.orderStatus == OrderStatus.printingInProgress ||
            o.orderStatus == OrderStatus.finishingMounting ||
            o.orderStatus == OrderStatus.qualityChecked)
        .length;
    final doneCount = orders
        .where((o) =>
            o.orderStatus == OrderStatus.delivered ||
            o.orderStatus == OrderStatus.completedPickup)
        .length;
    return [newCount, prodCount, doneCount, orders.length];
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final queueState = ref.watch(queueProvider);
    final filteredOrders = queueState.filteredOrders;
    final counts = _tabCounts(queueState);

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
                'Order Queue',
                style:
                    AppTypography.h1.copyWith(color: colors.onBackground),
              ),
            )
                .animate()
                .fadeIn(duration: 350.ms, curve: Curves.easeOut),

            // Pill tab selector
            Padding(
              padding:
                  const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: PillTabBar(
                tabs: List.generate(
                  _tabLabels.length,
                  (i) =>
                      PillTab(label: _tabLabels[i], count: counts[i]),
                ),
                selectedIndex: _selectedTab,
                onTabChanged: (i) {
                  setState(() => _selectedTab = i);
                  ref.read(queueProvider.notifier).setTab(_tabs[i]);
                },
              ),
            )
                .animate()
                .fadeIn(
                    duration: 350.ms,
                    delay: 60.ms,
                    curve: Curves.easeOut),

            // Search bar
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.md,
                AppSpacing.xl,
                AppSpacing.sm,
              ),
              child: TextField(
                controller: _searchController,
                style: AppTypography.body
                    .copyWith(color: colors.onBackground),
                cursorColor: colors.accent,
                onChanged: (query) {
                  ref.read(queueProvider.notifier).searchByOrderId(query);
                },
                decoration: InputDecoration(
                  hintText: 'Search by order ID...',
                  hintStyle: AppTypography.body
                      .copyWith(color: colors.onSurfaceDim),
                  prefixIcon: Padding(
                    padding: const EdgeInsets.only(left: 14, right: 10),
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedSearch01,
                      size: 18,
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  prefixIconConstraints: const BoxConstraints(
                    minHeight: 20,
                    minWidth: 20,
                  ),
                  filled: true,
                  fillColor: colors.surfaceVariant,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                    vertical: AppSpacing.sm + 2,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: AppRadius.borderFull,
                    borderSide: BorderSide.none,
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: AppRadius.borderFull,
                    borderSide: BorderSide.none,
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: AppRadius.borderFull,
                    borderSide:
                        BorderSide(color: colors.accent, width: 1.5),
                  ),
                ),
              ),
            )
                .animate()
                .fadeIn(
                    duration: 350.ms,
                    delay: 120.ms,
                    curve: Curves.easeOut),

            const SizedBox(height: AppSpacing.sm),

            // Order list
            Expanded(
              child: _isLoading
                  ? const OrderListSkeleton()
                  : RefreshIndicator(
                      color: colors.accent,
                      onRefresh: () async {
                        await Future<void>.delayed(
                            const Duration(milliseconds: 500));
                      },
                      child: filteredOrders.isEmpty
                          ? ListView(
                              children: [
                                SizedBox(
                                  height:
                                      MediaQuery.of(context).size.height *
                                          0.4,
                                  child: EmptyState(
                                    heading: 'No orders found',
                                    body: _emptyMessage(
                                        queueState.activeTab),
                                    icon:
                                        HugeIcons.strokeRoundedTaskRemove01,
                                  ),
                                ),
                              ],
                            )
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: AppSpacing.xl),
                              itemCount: filteredOrders.length,
                              itemBuilder: (context, index) {
                                final order = filteredOrders[index];
                                return Padding(
                                  padding: EdgeInsets.only(
                                    bottom: index <
                                            filteredOrders.length - 1
                                        ? AppSpacing.sm
                                        : AppSpacing.xxl,
                                  ),
                                  child: QueueOrderCard(
                                    order: order,
                                    onTap: () {
                                      context.push(
                                          '/admin/queue/${order.id}');
                                    },
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
          ],
        ),
      ),
    );
  }

  String _emptyMessage(QueueTab tab) {
    switch (tab) {
      case QueueTab.newOrders:
        return 'No new orders at the moment.';
      case QueueTab.inProduction:
        return 'No orders currently in production.';
      case QueueTab.done:
        return 'No completed orders yet.';
      case QueueTab.all:
        return 'No orders match your search.';
    }
  }
}
