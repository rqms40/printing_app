import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/history/providers/earnings_provider.dart';
import 'package:printing_app/features/rider/home/widgets/rider_bento_tiles.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';
import 'package:printing_app/features/rider/home/widgets/rider_recent_deliveries_section.dart';
import 'package:printing_app/features/rider/home/widgets/rider_resume_active_card.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_map_tile.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';

/// Rider home — mirrors the customer home layout with rider content.
class RiderHomeScreen extends ConsumerWidget {
  const RiderHomeScreen({super.key});

  Future<void> _openChat(
    BuildContext context,
    WidgetRef ref,
    RiderAssignmentView view,
  ) async {
    final order = view.order;
    final apiOrderRef = int.tryParse(order.orderInternalId) == null
        ? order.orderRef
        : order.orderInternalId;
    final conv =
        await ref.read(chatProvider.notifier).openOrderConversation(apiOrderRef);
    if (!context.mounted || conv == null) return;
    context.push(
      '/rider/chat/${conv.id}?type=${conv.type.name}&orderRef=${order.orderRef}',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final auth = ref.watch(authProvider);
    final state = ref.watch(deliveriesProvider);
    final earnings = ref.watch(earningsProvider);
    final firstName = (auth.user?.fullName ?? 'Rider').split(' ').first;
    final active = state.activeDelivery;
    final routeStops = state.routeStops;

    return Stack(
      children: [
        ColoredBox(
          color: colors.background,
          child: SafeArea(
            child: RefreshIndicator(
              color: colors.brand,
              backgroundColor: colors.surface,
              onRefresh:
                  ref.read(deliveriesProvider.notifier).refreshAssignments,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                clipBehavior: Clip.none,
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.lg),
                    RiderHomeHeader(firstName: firstName),
                    const SizedBox(height: AppSpacing.lg),

                    if (active != null) ...[
                      RiderResumeActiveCard(
                        orderRef: active.order.orderRef,
                        stopCount: routeStops.length,
                        onTap: () => context.push(
                          '/rider/deliveries/${active.id}/active',
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],

                    const HeroBanner(),
                    const SizedBox(height: AppSpacing.sm + 2),

                    SizedBox(
                      height: 290,
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(
                            child: RiderRouteMapTile(
                              stops: routeStops,
                              activeStop: active,
                              onTap: () {
                                if (active != null) {
                                  context.push(
                                    '/rider/deliveries/${active.id}/active',
                                  );
                                } else {
                                  context.go('/rider/deliveries');
                                }
                              },
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  flex: 2,
                                  child: RiderActiveStopTile(
                                    customerName: active?.order.customerName,
                                    orderRef: active?.order.orderRef,
                                    onTap: () {
                                      if (active != null) {
                                        context.push(
                                          '/rider/deliveries/${active.id}/active',
                                        );
                                      } else {
                                        context.go('/rider/deliveries');
                                      }
                                    },
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xs + 2),
                                Expanded(
                                  flex: 2,
                                  child: RiderDeliveriesCountTile(
                                    count: state.inProgressAssignments.length +
                                        state.newAssignments.length,
                                    onTap: () =>
                                        context.go('/rider/deliveries'),
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.xs + 2),
                                Expanded(
                                  flex: 3,
                                  child: RiderEarningsTile(
                                    todayAmount: earnings.today,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: AppSpacing.lg),
                    RiderTodayRouteSection(
                      stops: routeStops,
                      onTapStop: (v) =>
                          context.push('/rider/deliveries/${v.id}'),
                    ),

                    const SizedBox(height: AppSpacing.lg),
                    RiderRecentDeliveriesSection(
                      completed: state.completedAssignments,
                      onTap: (v) =>
                          context.push('/rider/deliveries/${v.id}'),
                    ),

                    const SizedBox(height: AppSpacing.xxl),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (active != null)
          Positioned(
            right: AppSpacing.xl,
            bottom: 90,
            child: Material(
              color: colors.accent,
              elevation: 6,
              shape: const CircleBorder(),
              clipBehavior: Clip.antiAlias,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => _openChat(context, ref, active),
                child: SizedBox(
                  width: 52,
                  height: 52,
                  child: Center(
                    child: HugeIcon(
                      icon: HugeIcons.strokeRoundedMessage01,
                      size: 22,
                      color: colors.accentOnColor,
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
