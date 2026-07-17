import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/features/customer/tracking/widgets/delivery_map.dart';
import 'package:printing_app/features/customer/tracking/widgets/rider_info_card.dart';
import 'package:printing_app/shared/widgets/delivery_journey_bar.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

Order? _findOrderByRouteId(List<Order> orders, String routeId) {
  for (final order in orders) {
    if (order.id == routeId ||
        order.orderId == routeId ||
        order.batchId == routeId ||
        order.batchOrderId == routeId) {
      return order;
    }
  }
  return null;
}

@visibleForTesting
Order? selectDeliveryTrackingOrder(List<Order> orders, String? routeId) {
  if (routeId != null) return _findOrderByRouteId(orders, routeId);

  for (final order in orders) {
    if (order.orderStatus == OrderStatus.onTheWay &&
        order.canTrackDelivery &&
        order.deliveryAssignmentId != null &&
        (order.assignedRider != null ||
            order.assignedRiderId != null ||
            order.deliveryAssignmentId != null)) {
      return order;
    }
  }

  return null;
}

class DeliveryTrackingScreen extends ConsumerStatefulWidget {
  const DeliveryTrackingScreen({super.key, this.orderId});

  final String? orderId;

  @override
  ConsumerState<DeliveryTrackingScreen> createState() =>
      _DeliveryTrackingScreenState();
}

class _DeliveryTrackingScreenState
    extends ConsumerState<DeliveryTrackingScreen> {
  final _mapKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _maybeShowTrackingTutorial(),
    );
  }

  void _maybeShowTrackingTutorial() {
    if (!mounted) return;
    final pipelineSeen = ref.read(tutorialSeenProvider(TutorialKey.pipeline));
    if (!pipelineSeen) return;
    final seen = ref.read(tutorialSeenProvider(TutorialKey.tracking));
    if (seen) return;

    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _mapKey,
          icon: HugeIcons.strokeRoundedLocation01,
          title: 'Live Rider Tracking',
          body:
              "Your rider's GPS updates in real time. The ETA badge top-right refreshes live.",
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.tracking),
    );
  }

  Future<void> _openOrderChat(Order order) async {
    final orderRef = int.tryParse(order.id) == null ? order.orderId : order.id;

    final conv = await ref
        .read(chatProvider.notifier)
        .openRiderOrderConversation(
          orderRef,
          hasAssignedRider: order.assignedRiderId != null,
        );
    if (!mounted) return;
    if (conv == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            ref.read(chatProvider).createError ??
                'Could not open rider chat. Please try again.',
          ),
        ),
      );
      return;
    }

    final uri = Uri(
      path: '/customer/chat/${conv.id}',
      queryParameters: {
        'type': conv.type.name,
        'orderRef': order.orderId,
        'orderStatus': order.orderStatus.displayName,
      },
    );
    context.push(uri.toString());
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final order = selectDeliveryTrackingOrder(
      ref.watch(ordersProvider),
      widget.orderId,
    );
    final canTrack =
        order?.canTrackDelivery == true &&
        order?.deliveryAssignmentId?.isNotEmpty == true;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Track Delivery',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: !canTrack
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xl),
                child: Text(
                  'Live tracking is not available for this delivery yet.',
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ),
            )
          : Column(
        children: [
          // Map placeholder
          Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: DeliveryMap(tutorialKey: _mapKey),
                ),
              )
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          // Journey progress: store → vehicle → home, Grab-style.
          const Padding(
            padding: EdgeInsets.fromLTRB(
              AppSpacing.md,
              0,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            child: _JourneyProgressSection(),
          ),
          // Rider info card at bottom
          Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  0,
                  AppSpacing.md,
                  AppSpacing.md,
                ),
                child: RiderInfoCard(
                  rider: order?.assignedRider,
                  onChat: order?.assignedRiderId == null
                      ? null
                      : () => _openOrderChat(order!),
                ),
              )
              .animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(
                begin: 0.03,
                duration: 400.ms,
                delay: 60.ms,
                curve: Curves.easeOut,
              ),
        ],
      ),
    );
  }
}

/// Store → vehicle → home strip fed by the live WS rider fix; distance and
/// ETA shrink Google-Maps-style as the rider closes in on the door.
class _JourneyProgressSection extends ConsumerWidget {
  const _JourneyProgressSection();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final state = ref.watch(liveDeliveryMapProvider).asData?.value;
    final locationUpdate = ref.watch(liveRiderLocationProvider);
    if (state == null ||
        !state.canTrackDelivery ||
        state.routePoints.length < 2) {
      return const SizedBox.shrink();
    }
    final matching =
        locationUpdate != null &&
            locationUpdate.deliveryAssignmentId == state.deliveryAssignmentId &&
            locationUpdate.planVersion == state.planVersion
        ? locationUpdate
        : null;
    final riderPoint = matching == null
        ? null
        : LatLng(matching.latitude, matching.longitude);
    final progress = riderPoint == null
        ? 0.0
        : routeProgressRatioForPoint(riderPoint, state.routePoints);
    String? remaining;
    if (riderPoint != null) {
      final meters = remainingRouteDistanceMeters(
        riderPoint,
        state.routePoints,
      );
      final minutes = estimateRouteEtaMinutes(riderPoint, state.routePoints);
      final distance = meters >= 950
          ? '${(meters / 1000).toStringAsFixed(1)} km'
          : '${meters.round()} m';
      remaining = '$distance · ~$minutes min away';
    }
    return DeliveryJourneyBar(
      colors: colors,
      progress: progress,
      remainingLabel: remaining ?? 'Waiting for the rider to start moving',
    );
  }
}
