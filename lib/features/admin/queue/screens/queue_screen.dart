import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/admin/queue/providers/queue_provider.dart';
import 'package:printing_app/features/admin/queue/widgets/queue_order_card.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';

/// Admin order queue screen with tabbed filtering and search.
class QueueScreen extends ConsumerStatefulWidget {
  const QueueScreen({super.key});

  @override
  ConsumerState<QueueScreen> createState() => _QueueScreenState();
}

class _QueueScreenState extends ConsumerState<QueueScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  final _searchController = TextEditingController();
  bool _isLoading = true;

  static const _tabs = [
    QueueTab.newOrders,
    QueueTab.inProduction,
    QueueTab.done,
    QueueTab.all,
  ];

  static const _tabLabels = ['New', 'In Production', 'Done', 'All'];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isLoading = false);
    });
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        ref.read(queueProvider.notifier).setTab(_tabs[_tabController.index]);
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final queueState = ref.watch(queueProvider);
    final filteredOrders = queueState.filteredOrders;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.background,
        body: const OrderListSkeleton(),
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          children: [
            // Page title
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.lg,
                AppSpacing.xl,
                0,
              ),
              child: Align(
                alignment: Alignment.centerLeft,
                child: Text(
                  'Order Queue',
                  style: AppTypography.h1.copyWith(color: colors.onBackground),
                ),
              ),
            ),
            // Search bar
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.lg,
              AppSpacing.xl,
              AppSpacing.sm,
            ),
            child: AppTextField(
              controller: _searchController,
              hintText: 'Search by order ID...',
              prefixIcon: HugeIcon(
                icon: HugeIcons.strokeRoundedSearch01,
                size: 20,
                color: colors.onSurfaceDim,
              ),
              onChanged: (query) {
                ref.read(queueProvider.notifier).searchByOrderId(query);
              },
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),

          // Tab bar
          TabBar(
            controller: _tabController,
            labelColor: colors.accent,
            unselectedLabelColor: colors.onSurfaceDim,
            labelStyle: AppTypography.bodyBold,
            unselectedLabelStyle: AppTypography.body,
            indicatorColor: colors.accent,
            indicatorWeight: 2,
            tabs: _tabLabels.map((l) => Tab(text: l)).toList(),
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),

          // Order list
          Expanded(
            child: RefreshIndicator(
              color: colors.accent,
              onRefresh: () async {
                await Future<void>.delayed(const Duration(milliseconds: 500));
              },
              child: filteredOrders.isEmpty
                  ? ListView(
                      children: [
                        SizedBox(
                          height: MediaQuery.of(context).size.height * 0.4,
                          child: EmptyState(
                            heading: 'No orders found',
                            body: _emptyMessage(queueState.activeTab),
                            icon: HugeIcons.strokeRoundedTaskRemove01,
                          ),
                        ),
                      ],
                    )
                  : ListView.separated(
                      padding: const EdgeInsets.all(AppSpacing.xl),
                      itemCount: filteredOrders.length,
                      separatorBuilder: (_, __) =>
                          const SizedBox(height: AppSpacing.md),
                      itemBuilder: (context, index) {
                        final order = filteredOrders[index];
                        return QueueOrderCard(
                          order: order,
                          onTap: () {
                            context.push('/admin/queue/${order.id}');
                          },
                        );
                      },
                    ),
            ).animate()
                .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
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
