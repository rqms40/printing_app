import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/screens/order_detail_screen.dart';
import 'package:printing_app/features/customer/orders/widgets/order_card.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

/// Customer orders screen with Active / Completed tabs.
class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          backgroundColor: colors.surface,
          title: Text(
            'My Orders',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          bottom: TabBar(
            labelColor: colors.onBackground,
            unselectedLabelColor: colors.onSurfaceDim,
            indicatorColor: colors.accent,
            labelStyle: AppTypography.bodyBold,
            unselectedLabelStyle: AppTypography.body,
            tabs: const [
              Tab(text: 'Active'),
              Tab(text: 'Completed'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            _OrdersTab(
              ordersSelector: (notifier) => notifier.activeOrders,
              emptyHeading: 'No active orders',
              emptyBody: 'Your in-progress orders will appear here.',
              emptyIcon: HugeIcons.strokeRoundedInvoice01,
            ),
            _OrdersTab(
              ordersSelector: (notifier) => notifier.completedOrders,
              emptyHeading: 'No completed orders',
              emptyBody: 'Your finished orders will appear here.',
              emptyIcon: HugeIcons.strokeRoundedCheckmarkCircle02,
            ),
          ],
        ).animate()
            .fadeIn(duration: 400.ms, curve: Curves.easeOut),
      ),
    );
  }
}

class _OrdersTab extends ConsumerWidget {
  const _OrdersTab({
    required this.ordersSelector,
    required this.emptyHeading,
    required this.emptyBody,
    required this.emptyIcon,
  });

  final List<Order> Function(OrdersNotifier notifier) ordersSelector;
  final String emptyHeading;
  final String emptyBody;
  final dynamic emptyIcon;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // Watch the provider so we rebuild when state changes.
    ref.watch(ordersProvider);
    final notifier = ref.read(ordersProvider.notifier);
    final orders = ordersSelector(notifier);

    if (orders.isEmpty) {
      return EmptyState(
        heading: emptyHeading,
        body: emptyBody,
        icon: emptyIcon,
      );
    }

    return RefreshIndicator(
      onRefresh: () async {
        // Simulate pull-to-refresh delay; mock data stays the same.
        await Future<void>.delayed(const Duration(milliseconds: 500));
      },
      child: ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.md),
        itemCount: orders.length,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
        itemBuilder: (context, index) {
          final order = orders[index];
          return OrderCard(
            order: order,
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => OrderDetailScreen(orderId: order.id),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
