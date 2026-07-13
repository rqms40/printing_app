import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/home/widgets/rider_active_stop_card.dart';
import 'package:printing_app/features/rider/home/widgets/rider_cockpit_map.dart';
import 'package:printing_app/features/rider/home/widgets/rider_home_header.dart';
import 'package:printing_app/features/rider/home/widgets/rider_recent_deliveries_section.dart';
import 'package:printing_app/features/rider/home/widgets/rider_today_route_section.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:url_launcher/url_launcher.dart';

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
    final conv = await ref
        .read(chatProvider.notifier)
        .openOrderConversation(apiOrderRef);
    if (!context.mounted || conv == null) return;
    context.push(
      '/rider/chat/${conv.id}?type=${conv.type.name}&orderRef=${order.orderRef}',
    );
  }

  Future<void> _call(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) await launchUrl(uri);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final auth = ref.watch(authProvider);
    final state = ref.watch(deliveriesProvider);
    final firstName = (auth.user?.fullName ?? 'Rider').split(' ').first;
    final active = state.activeDelivery;
    final routeStops = state.routeStops;
    final mapStops = state.plannedRoute.isNotEmpty
        ? state.plannedRoute
        : routeStops;
    final completedCount = mapStops
        .where(
          (view) => view.planStop?.status == RiderDispatchStopStatus.completed,
        )
        .length;
    final currentStopIndex = active?.planSequence ?? 0;

    return Stack(
      children: [
        ColoredBox(
          color: colors.background,
          child: SafeArea(
            child: RefreshIndicator(
              color: colors.brand,
              backgroundColor: colors.surface,
              onRefresh: ref
                  .read(deliveriesProvider.notifier)
                  .refreshAssignments,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                clipBehavior: Clip.none,
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: AppSpacing.lg),
                    RiderHomeHeader(
                      firstName: firstName,
                    ).animate().fadeIn(duration: 400.ms, curve: Curves.easeOut),
                    const SizedBox(height: AppSpacing.lg),

                    const HeroBanner(),
                    const SizedBox(height: AppSpacing.sm + 2),

                    SizedBox(
                      height: 380,
                      child: RiderCockpitMap(
                        mapStops: mapStops,
                        activeStop: active,
                        completedCount: completedCount,
                        currentStopIndex: currentStopIndex,
                        onMapTap: () {
                          if (active != null) {
                            context.push(
                              '/rider/deliveries/${active.id}/active',
                            );
                          } else {
                            context.go('/rider/deliveries');
                          }
                        },
                      ),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 100.ms,
                      curve: Curves.easeOut,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    if (active != null)
                      RiderActiveStopCard(
                        view: active,
                        onTap: () => context.push(
                          '/rider/deliveries/${active.id}/active',
                        ),
                        onMessage: () => _openChat(context, ref, active),
                        onCall: () => _call(active.order.customerPhone),
                      )
                    else
                      Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.xs,
                          vertical: AppSpacing.sm,
                        ),
                        child: Text(
                          'No active stop — check Orders for assignments.',
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ),

                    const SizedBox(height: AppSpacing.lg),
                    RiderTodayRouteSection(
                      stops: routeStops,
                      onTapStop: (v) =>
                          context.push('/rider/deliveries/${v.id}'),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 200.ms,
                      curve: Curves.easeOut,
                    ),

                    const SizedBox(height: AppSpacing.lg),
                    RiderRecentDeliveriesSection(
                      completed: state.completedAssignments,
                      onTap: (v) => context.push('/rider/deliveries/${v.id}'),
                    ).animate().fadeIn(
                      duration: 400.ms,
                      delay: 300.ms,
                      curve: Curves.easeOut,
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
