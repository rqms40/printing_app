import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/widgets/order_card.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/pill_tab_bar.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';

/// Customer orders screen with pill-style tab selector.
class OrdersScreen extends ConsumerStatefulWidget {
  const OrdersScreen({super.key});

  @override
  ConsumerState<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends ConsumerState<OrdersScreen>
    with SingleTickerProviderStateMixin {
  bool _isLoading = true;
  int _selectedTab = 0;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) {
        setState(() => _isLoading = false);
        // Refresh orders from API every time screen opens
        ref.read(ordersProvider.notifier).refreshOrders();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    ref.watch(ordersProvider);
    final notifier = ref.read(ordersProvider.notifier);
    final activeOrders = notifier.activeOrders
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    final completedOrders = notifier.completedOrders
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));

    final activeCount = activeOrders.length;
    final completedCount = completedOrders.length;

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
                'My Orders',
                style: AppTypography.h1.copyWith(color: colors.onBackground),
              ),
            ).animate()
                .fadeIn(duration: 350.ms, curve: Curves.easeOut)
                .slideY(begin: 0.02, duration: 350.ms, curve: Curves.easeOut),

            // Pill tab selector
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: PillTabBar(
                tabs: [
                  PillTab(label: 'Active', count: activeCount),
                  PillTab(label: 'Completed', count: completedCount),
                ],
                selectedIndex: _selectedTab,
                onTabChanged: (i) => setState(() => _selectedTab = i),
              ),
            ).animate()
                .fadeIn(duration: 350.ms, delay: 60.ms, curve: Curves.easeOut)
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
                      child: _selectedTab == 0
                          ? _OrdersList(
                              key: const ValueKey('active'),
                              orders: activeOrders,
                              emptyHeading: 'No active orders',
                              emptyBody:
                                  'When you place an order, it will appear here.',
                              emptyIcon: HugeIcons.strokeRoundedFile02,
                              colors: colors,
                            )
                          : _OrdersList(
                              key: const ValueKey('completed'),
                              orders: completedOrders,
                              emptyHeading: 'No completed orders',
                              emptyBody: 'Your finished orders will show here.',
                              emptyIcon:
                                  HugeIcons.strokeRoundedCheckmarkCircle02,
                              colors: colors,
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The list of order items for a given tab.
class _OrdersList extends StatelessWidget {
  const _OrdersList({
    super.key,
    required this.orders,
    required this.emptyHeading,
    required this.emptyBody,
    required this.emptyIcon,
    required this.colors,
  });

  final List<Order> orders;
  final String emptyHeading;
  final String emptyBody;
  final dynamic emptyIcon;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) {
      return EmptyState(
        heading: emptyHeading,
        body: emptyBody,
        icon: emptyIcon,
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        return Padding(
          padding: EdgeInsets.only(
            bottom: index < orders.length - 1 ? AppSpacing.sm : AppSpacing.xxl,
          ),
          child: OrderCard(
            order: order,
            onTap: () => context.push('/customer/orders/${order.id}'),
          ).animate().fadeIn(
                duration: 350.ms,
                delay: (index * 50).ms,
                curve: Curves.easeOut,
              ).slideY(
                begin: 0.02,
                duration: 350.ms,
                delay: (index * 50).ms,
                curve: Curves.easeOut,
              ),
        );
      },
    );
  }
}
