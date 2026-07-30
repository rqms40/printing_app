import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_dialog.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/shared/widgets/delivery_journey_bar.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// The customer's own booked delivery slot, taken from the most recently
/// updated active (non-terminal) order that carries one.
class BookedSlotInfo {
  const BookedSlotInfo({required this.slot, required this.orderId});

  final AssignedDeliverySlot slot;
  final String orderId;
}

final bookedDeliverySlotProvider = Provider.autoDispose<BookedSlotInfo?>((
  ref,
) {
  final orders = ref.watch(activeOrdersProvider);
  for (final order in orders) {
    final slot = order.assignedSlot;
    if (slot != null) {
      return BookedSlotInfo(slot: slot, orderId: order.orderId);
    }
  }
  return null;
});

/// A booked slot resolved for display: the window comes from the order's
/// booking, the live fill numbers from that day's slot availability (when
/// loaded).
class _BookedSlotView {
  const _BookedSlotView({
    required this.slot,
    required this.fill,
    required this.isToday,
  });

  final AssignedDeliverySlot slot;
  final DeliverySlot? fill;
  final bool isToday;
}

int? _readStrictPlanVersion(dynamic value) {
  final parsed = value is int
      ? value
      : value is num && value.isFinite && value == value.roundToDouble()
      ? value.toInt()
      : value is String
      ? int.tryParse(value)
      : null;
  return parsed != null && parsed > 0 ? parsed : null;
}

class MapTrackingTile extends ConsumerStatefulWidget {
  const MapTrackingTile({super.key});

  @override
  ConsumerState<MapTrackingTile> createState() => _MapTrackingTileState();
}

class _MapTrackingTileState extends ConsumerState<MapTrackingTile> {
  String? _subscribedAssignmentId;
  int? _subscribedPlanVersion;
  String? _desiredAssignmentId;
  int? _desiredPlanVersion;
  bool _isConnecting = false;
  late final WebSocketService _ws;
  Timer? _healthRefreshTimer;

  @override
  void initState() {
    super.initState();
    _ws = ref.read(webSocketServiceProvider);
    _ws.listenForLocationHealth(_handleLocationHealth);
    _healthRefreshTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _ws.removeLocationUpdateListener(_handleLocationUpdate);
    _ws.removeLocationHealthListener(_handleLocationHealth);
    _healthRefreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _ensureLocationSubscription(
    String assignmentId,
    int planVersion,
  ) async {
    _desiredAssignmentId = assignmentId;
    _desiredPlanVersion = planVersion;
    if (_subscribedAssignmentId == assignmentId &&
        _subscribedPlanVersion == planVersion) {
      return;
    }
    if (_isConnecting) return;
    _isConnecting = true;
    try {
      await _ws.connectLocation(onLocationUpdate: _handleLocationUpdate);
      if (!mounted) return;
      final desiredAssignmentId = _desiredAssignmentId;
      final desiredPlanVersion = _desiredPlanVersion;
      if (desiredAssignmentId == null || desiredPlanVersion == null) return;
      _ws.subscribeToDeliveryPlan(desiredAssignmentId, desiredPlanVersion);
      _subscribedAssignmentId = desiredAssignmentId;
      _subscribedPlanVersion = desiredPlanVersion;
    } finally {
      _isConnecting = false;
    }
  }

  void _handleLocationHealth(LocationSocketHealth health) {
    scheduleMicrotask(() {
      if (!mounted) return;
      ref.read(liveLocationSocketHealthProvider.notifier).state = health;
    });
  }

  void _handleLocationUpdate(dynamic data) {
    if (!mounted || data is! Map) return;
    final payload = Map<String, dynamic>.from(data);
    final lat = (payload['latitude'] as num?)?.toDouble();
    final lng = (payload['longitude'] as num?)?.toDouble();
    final assignmentId = payload['assignmentId']?.toString();
    final planVersion = _readStrictPlanVersion(payload['planVersion']);
    final mapState = ref.read(liveDeliveryMapProvider).asData?.value;
    if (lat == null ||
        lng == null ||
        assignmentId == null ||
        planVersion == null ||
        assignmentId != _subscribedAssignmentId ||
        mapState?.planVersion == null ||
        planVersion != mapState!.planVersion) {
      return;
    }
    final timestamp = _parsePayloadTimestamp(payload['timestamp']);
    if (timestamp == null) return;

    ref.read(liveRiderLocationProvider.notifier).state = LocationUpdate(
      id: 'home-live',
      deliveryAssignmentId: assignmentId,
      planVersion: planVersion,
      latitude: lat,
      longitude: lng,
      timestamp: timestamp,
    );
  }

  DateTime? _parsePayloadTimestamp(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final mapAsync = ref.watch(liveDeliveryMapProvider);
    // Only the empty/idle copy depends on whether any order is in flight, so
    // select the boolean to avoid rebuilding the tile on every order mutation.
    final hasActiveOrder = ref.watch(
      activeOrdersProvider.select((orders) => orders.isNotEmpty),
    );
    // Watched directly here so location updates only rebuild markers,
    // not the entire FutureProvider async cycle.
    final locationUpdate = ref.watch(liveRiderLocationProvider);
    final socketHealth = ref.watch(liveLocationSocketHealthProvider);
    final today = _today();
    final slots = ref.watch(deliverySlotProvider(today));
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    // Resolves an order's booked slot into a displayable view: window from
    // the booking itself, live fill from that day's availability feed.
    _BookedSlotView? slotViewFor(AssignedDeliverySlot? assigned) {
      if (assigned == null) return null;
      final dayState = assigned.date == today
          ? slots
          : ref.watch(deliverySlotProvider(assigned.date));
      final fill = dayState.slots
          .where((s) => s.templateId == assigned.slotTemplateId)
          .firstOrNull;
      return _BookedSlotView(
        slot: assigned,
        fill: fill,
        isToday: assigned.date == today,
      );
    }

    final booked = ref.watch(bookedDeliverySlotProvider);
    final bookedView = slotViewFor(booked?.slot);
    // The next-batch rollover only matters when nothing is booked and today
    // offers no batches at all; watching it conditionally avoids fetching
    // tomorrow's slots on every home visit.
    final nextBatch = booked == null && !slots.isLoading && slots.slots.isEmpty
        ? ref.watch(nextBatchInfoProvider)
        : null;

    return mapAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => _DeliveryStatusAndMapLayout(
        colors: colors,
        brightness: brightness,
        slots: slots.slots,
        isLoading: true,
        bookedSlot: bookedView,
        hasActiveOrder: hasActiveOrder,
      ),
      error: (e, st) => _DeliveryStatusAndMapLayout(
        colors: colors,
        brightness: brightness,
        slots: slots.slots,
        isLoading: slots.isLoading,
        bookedSlot: bookedView,
        nextBatch: nextBatch,
        hasActiveOrder: hasActiveOrder,
      ),
      data: (state) {
        if (state.status == LiveMapStatus.loading) {
          return _DeliveryStatusAndMapLayout(
            colors: colors,
            brightness: brightness,
            slots: slots.slots,
            isLoading: true,
            bookedSlot: bookedView,
            hasActiveOrder: hasActiveOrder,
          );
        }

        final liveSlotView = slotViewFor(state.assignedSlot) ?? bookedView;

        final canShowLiveMap =
            state.status == LiveMapStatus.active &&
            (state.orderStatus == OrderStatus.onTheWay ||
                state.orderStatus == OrderStatus.arrivedAtDestination) &&
            state.canTrackDelivery &&
            state.deliveryAssignmentId != null &&
            state.planVersion != null;

        final deliveryAssignmentId = state.deliveryAssignmentId;
        if (canShowLiveMap &&
            deliveryAssignmentId != null &&
            deliveryAssignmentId.isNotEmpty) {
          final planVersion = state.planVersion!;
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            unawaited(
              _ensureLocationSubscription(deliveryAssignmentId, planVersion),
            );
          });
        }

        if (canShowLiveMap) {
          final hasMatchingLocation =
              locationUpdate != null &&
              locationUpdate.deliveryAssignmentId ==
                  state.deliveryAssignmentId &&
              locationUpdate.planVersion == state.planVersion;
          final liveRiderPoint = hasMatchingLocation
              ? LatLng(locationUpdate.latitude, locationUpdate.longitude)
              : null;
          final locationHealth = hasMatchingLocation
              ? classifyLocationHealth(
                  updatedAt: locationUpdate.timestamp,
                  now: ref.read(deliveryTrackingNowProvider)(),
                  connected: socketHealth == LocationSocketHealth.connected,
                )
              : LocationHealth.offline;

          return _DeliveryStatusAndMapLayout(
            colors: colors,
            brightness: brightness,
            slots: slots.slots,
            isLoading: slots.isLoading,
            liveState: state,
            liveRiderPoint: liveRiderPoint,
            locationHealth: locationHealth,
            bookedSlot: liveSlotView,
            hasActiveOrder: true,
            onMapTap: () => context.push('/customer/tracking'),
          );
        }

        if (state.status == LiveMapStatus.active) {
          return _DeliveryStatusAndMapLayout(
            colors: colors,
            brightness: brightness,
            slots: slots.slots,
            isLoading: slots.isLoading,
            liveState: state,
            bookedSlot: liveSlotView,
            hasActiveOrder: true,
          );
        }

        return _DeliveryStatusAndMapLayout(
          colors: colors,
          brightness: brightness,
          slots: slots.slots,
          isLoading: slots.isLoading,
          bookedSlot: bookedView,
          nextBatch: nextBatch,
          hasActiveOrder: hasActiveOrder,
        );
      },
    );
  }

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}


class _DeliveryStatusAndMapLayout extends StatelessWidget {
  const _DeliveryStatusAndMapLayout({
    required this.colors,
    required this.brightness,
    required this.slots,
    required this.isLoading,
    this.liveState,
    this.liveRiderPoint,
    this.locationHealth = LocationHealth.offline,
    this.bookedSlot,
    this.nextBatch,
    this.hasActiveOrder = false,
    this.onMapTap,
  });

  final AppColorSet colors;
  final Brightness brightness;
  final List<DeliverySlot> slots;
  final bool isLoading;
  final bool hasActiveOrder;
  final LiveDeliveryMapState? liveState;
  final LatLng? liveRiderPoint;
  final LocationHealth locationHealth;
  final _BookedSlotView? bookedSlot;
  final NextBatchInfo? nextBatch;
  final VoidCallback? onMapTap;

  static const _maxInlineSlots = 3;
  static const _panelGap = AppSpacing.sm;
  static const _minMapHeight = 96.0;

  bool get _hasActiveDelivery =>
      liveState?.status == LiveMapStatus.active &&
      (liveState?.orderStatus == OrderStatus.onTheWay ||
          liveState?.orderStatus == OrderStatus.arrivedAtDestination);

  bool get _isQueued =>
      _hasActiveDelivery && liveState?.canTrackDelivery == false;

  bool get _queuedShowsSlotBar => bookedSlot != null;

  bool get _shouldShowMapPanel =>
      !_hasActiveDelivery || liveRiderPoint != null || _isQueued;

  /// Today's availability, minus the row that duplicates the customer's own
  /// booked slot (that one is pinned above the list instead).
  List<DeliverySlot> get _sortedSlots {
    final booked = bookedSlot;
    final sorted = [
      for (final s in slots)
        if (booked == null ||
            !booked.isToday ||
            s.templateId != booked.slot.slotTemplateId)
          s,
    ]..sort((a, b) => a.startTime.compareTo(b.startTime));
    return sorted;
  }

  bool get _showsNextBatch =>
      bookedSlot == null &&
      slots.isEmpty &&
      nextBatch != null &&
      nextBatch!.nextSlotStart != null &&
      nextBatch!.nextSlotEnd != null;

  double _statusHeight({required double maxHeight}) {
    final maxStatusHeight = (maxHeight - _panelGap - _minMapHeight)
        .clamp(0.0, maxHeight)
        .toDouble();
    if (maxStatusHeight <= 0) return maxHeight;

    final desiredHeight = _isQueued
        // The queued tile needs enough height for its slot bar, dispatched
        // line, and the stop-position badge; the compressed active ratio
        // clips the badge below the visible area (and off the a11y tree).
        // Without a matching slot bar the card shrinks so the freed space
        // goes to the map panel instead of trailing as an empty gap.
        ? (_queuedShowsSlotBar ? 196.0 : 152.0)
        : ((((maxHeight - (_panelGap * 2)) / 7) * 4) + _panelGap);

    return desiredHeight.clamp(0.0, maxStatusHeight).toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final sortedSlots = _sortedSlots;
    // Three rows fill the aligned card exactly; when more exist, the
    // "View more" line takes the third row's slot so nothing scrolls.
    final visibleSlots = sortedSlots.length <= _maxInlineSlots
        ? sortedSlots
        : sortedSlots.take(_maxInlineSlots - 1).toList();
    final hiddenSlotCount = sortedSlots.length - visibleSlots.length;
    final showMapPanel = _shouldShowMapPanel;
    final queuePosition = liveState?.queuePosition;
    final idleMapMessage = _isQueued
        ? (queuePosition != null && queuePosition > 1
              ? 'Live map starts after Stop ${queuePosition - 1}!'
              : 'Live map starts when you are next!')
        : _hasActiveDelivery
        ? 'Waiting for rider location...'
        : _showsNextBatch
        ? 'Live map starts on your delivery day.'
        : visibleSlots.isEmpty && bookedSlot == null
        ? 'No batches scheduled today'
        : hasActiveOrder
        ? 'Live map starts after rider dispatch.'
        : 'No delivery in progress — track your rider here once you order.';
    final statusPanel =
        _hasActiveDelivery && liveState?.canTrackDelivery == false
        ? _QueuedDeliveryStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            liveState: liveState!,
            bookedSlot: bookedSlot,
          )
        : _hasActiveDelivery
        ? _LiveDeliveryStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            liveState: liveState!,
            liveRiderPoint: liveRiderPoint,
            hasLiveRiderPoint: liveRiderPoint != null,
            locationHealth: locationHealth,
            bookedSlot: bookedSlot,
          )
        : _BatchStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            slots: visibleSlots,
            allSlots: sortedSlots,
            hiddenSlotCount: hiddenSlotCount,
            isLoading: isLoading,
            bookedSlot: bookedSlot,
            nextBatch: _showsNextBatch ? nextBatch : null,
          );
    final mapPanel = showMapPanel
        ? _DeliveryMapPanel(
            key: const Key('delivery-map-panel'),
            colors: colors,
            brightness: brightness,
            message: isLoading ? 'Loading delivery status...' : idleMapMessage,
            liveState: liveState,
            liveRiderPoint: liveRiderPoint,
            locationHealth: locationHealth,
            onMapTap: onMapTap,
          )
        : null;

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxHeight = constraints.hasBoundedHeight
            ? constraints.maxHeight
            : 290.0;
        if (mapPanel == null) {
          return SizedBox(height: maxHeight, child: statusPanel);
        }

        if (!_hasActiveDelivery) {
          final maxStatusHeight = (maxHeight - _panelGap - _minMapHeight)
              .clamp(0.0, maxHeight)
              .toDouble();
          // The right bento column stacks Start Printing (5) + Data Grid (5)
          // + Feed (9) with sm gaps. Spanning 10/19 of the flex space plus
          // the inner gap puts this card's bottom edge exactly on The Data
          // Grid's bottom edge; the rows distribute inside (spaceBetween in
          // the card) so none of that height pools as a blank strip.
          final alignedHeight =
              (((maxHeight - (_panelGap * 2)) / 19) * 10 + _panelGap)
                  .clamp(0.0, maxStatusHeight)
                  .toDouble();
          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(height: alignedHeight, child: statusPanel),
              const SizedBox(height: _panelGap),
              Expanded(child: mapPanel),
            ],
          );
        }

        final statusHeight = _statusHeight(maxHeight: maxHeight);
        final mapHeight = (maxHeight - statusHeight - _panelGap)
            .clamp(0.0, double.infinity)
            .toDouble();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: statusHeight, child: statusPanel),
            const SizedBox(height: _panelGap),
            SizedBox(height: mapHeight, child: mapPanel),
          ],
        );
      },
    );
  }
}

// ── Idle ─────────────────────────────────────────────────────────────────────

class _BatchStatusTile extends StatelessWidget {
  const _BatchStatusTile({
    super.key,
    required this.colors,
    required this.slots,
    required this.allSlots,
    required this.hiddenSlotCount,
    required this.isLoading,
    this.bookedSlot,
    this.nextBatch,
  });

  final AppColorSet colors;
  final List<DeliverySlot> slots;
  final List<DeliverySlot> allSlots;
  final int hiddenSlotCount;
  final bool isLoading;
  final _BookedSlotView? bookedSlot;
  final NextBatchInfo? nextBatch;

  bool get _hasHiddenSlots => hiddenSlotCount > 0;

  @override
  Widget build(BuildContext context) {
    final rowsChildren = <Widget>[
      if (bookedSlot != null)
        _PinnedSlotBlock(
          key: const Key('booked-slot-block'),
          colors: colors,
          view: bookedSlot!,
        ),
      if (nextBatch != null && bookedSlot == null)
        _NextBatchBlock(
          key: const Key('next-batch-block'),
          colors: colors,
          info: nextBatch!,
        )
      else if (isLoading && slots.isEmpty && bookedSlot == null)
        SizedBox(
          height: 44,
          child: Center(
            child: SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.accent,
              ),
            ),
          ),
        )
      else if (slots.isEmpty && bookedSlot == null)
        Padding(
          padding: const EdgeInsets.only(top: AppSpacing.xs),
          child: Text(
            'No active delivery',
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        )
      else if (slots.isNotEmpty) ...[
        for (final slot in slots) _BatchSlotRow(slot: slot, colors: colors),
        if (_hasHiddenSlots)
          Align(
            alignment: Alignment.centerRight,
            child: TextButton(
              key: const Key('delivery-slots-view-more'),
              onPressed: () =>
                  _showDeliverySlotsSheet(context, colors, allSlots),
              style: TextButton.styleFrom(
                foregroundColor: colors.brand,
                minimumSize: Size.zero,
                padding: const EdgeInsets.symmetric(
                  horizontal: 2,
                  vertical: 0,
                ),
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
              ),
              child: Text(
                'View more',
                style: AppTypography.caption.copyWith(
                  color: colors.brand,
                  fontSize: 10,
                  fontWeight: FontWeight.w900,
                  height: 1,
                ),
              ),
            ),
          ),
      ],
    ];

    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(color: colors.surface),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              alignment: Alignment.centerLeft,
              child: Text(
                'Delivery Status',
                maxLines: 1,
                style: AppTypography.h3.copyWith(
                  color: colors.onSurface,
                  fontSize: 20,
                  height: 1.0,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              nextBatch != null ? 'NEXT DELIVERY BATCH' : "TODAY'S BATCHES",
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 8,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.1,
                height: 1.25,
              ),
            ),
            const SizedBox(height: 10),
            // The rows own the rest of the card: spare height distributes
            // between them (no blank strip at the bottom), and oversized
            // content — pinned block + rows, or large text scales — scrolls
            // instead of hard-overflowing the bento cell.
            Expanded(
              child: LayoutBuilder(
                builder: (context, rowConstraints) => SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minHeight: rowConstraints.maxHeight,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      spacing: AppSpacing.sm,
                      children: rowsChildren,
                    ),
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

Future<void> _showDeliverySlotsSheet(
  BuildContext context,
  AppColorSet colors,
  List<DeliverySlot> slots,
) {
  return showModalBottomSheet<void>(
    context: context,
    backgroundColor: colors.surface,
    barrierColor: Colors.black.withValues(alpha: 0.55),
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (sheetContext) {
      final sheetColors = Theme.of(sheetContext).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;
      return _DeliverySlotsSheet(colors: sheetColors, slots: slots);
    },
  );
}

class _DeliverySlotsSheet extends StatelessWidget {
  const _DeliverySlotsSheet({required this.colors, required this.slots});

  final AppColorSet colors;
  final List<DeliverySlot> slots;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg,
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.lg,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    "Today's delivery slots",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.h3.copyWith(
                      color: colors.onSurface,
                      fontSize: 20,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  onPressed: () => Navigator.of(context).pop(),
                  icon: Icon(Icons.close_rounded, color: colors.onSurface),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Flexible(
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: slots.length,
                separatorBuilder: (_, _) =>
                    Divider(color: colors.outline.withValues(alpha: 0.45)),
                itemBuilder: (_, index) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                  child: _BatchSlotRow(slot: slots[index], colors: colors),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _DeliveryMapPanel extends StatelessWidget {
  const _DeliveryMapPanel({
    super.key,
    required this.colors,
    required this.brightness,
    required this.message,
    this.liveState,
    this.liveRiderPoint,
    this.locationHealth = LocationHealth.offline,
    this.onMapTap,
  });

  final AppColorSet colors;
  final Brightness brightness;
  final String message;
  final LiveDeliveryMapState? liveState;
  final LatLng? liveRiderPoint;
  final LocationHealth locationHealth;
  final VoidCallback? onMapTap;

  bool get _hasLiveMap => liveState != null && liveRiderPoint != null;

  @override
  Widget build(BuildContext context) {
    final child = _hasLiveMap
        ? _ActiveTile(
            state: liveState!,
            brightness: brightness,
            riderPoint: liveRiderPoint!,
            locationHealth: locationHealth,
          )
        : _MapPlaceholder(
            colors: colors,
            brightness: brightness,
            message: message,
          );

    final content = onMapTap == null
        ? child
        : GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onMapTap,
            child: child,
          );

    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: ColoredBox(color: colors.surface, child: content),
    );
  }
}

/// The customer's own booked window, pinned above the availability list:
/// eyebrow, window + fill line, and fill bar when the day's counts are known.
class _PinnedSlotBlock extends StatelessWidget {
  const _PinnedSlotBlock({super.key, required this.colors, required this.view});

  final AppColorSet colors;
  final _BookedSlotView view;

  @override
  Widget build(BuildContext context) {
    final fill = view.fill;
    final dayLabel = view.isToday
        ? 'TODAY'
        : _shortDateLabel(view.slot.date).toUpperCase();
    return _SlotWindowBar(
      colors: colors,
      eyebrow: 'YOUR BATCH · $dayLabel',
      window: _formatRawRange(view.slot.startTime, view.slot.endTime),
      bookedCount: fill?.bookedCount,
      capacity: fill?.capacity,
    );
  }
}

/// Shown when nothing is booked and today has no batches: the closest
/// upcoming window, so the tile always points somewhere actionable.
class _NextBatchBlock extends StatelessWidget {
  const _NextBatchBlock({super.key, required this.colors, required this.info});

  final AppColorSet colors;
  final NextBatchInfo info;

  @override
  Widget build(BuildContext context) {
    final first = info.upcoming.isNotEmpty ? info.upcoming.first : null;
    final dayLabel = info.relevantIsToday
        ? 'TODAY'
        : _shortDateLabel(info.relevantDate).toUpperCase();
    return _SlotWindowBar(
      colors: colors,
      eyebrow: 'NEXT BATCH · $dayLabel',
      window: _formatRawRange(info.nextSlotStart!, info.nextSlotEnd!),
      bookedCount: first?.bookedCount,
      capacity: first?.capacity,
    );
  }
}

/// One slot window line with an optional eyebrow and fill bar — the shape
/// shared by the pinned booked slot and the next-batch fallback.
class _SlotWindowBar extends StatelessWidget {
  const _SlotWindowBar({
    required this.colors,
    required this.eyebrow,
    required this.window,
    this.bookedCount,
    this.capacity,
  });

  final AppColorSet colors;
  final String eyebrow;
  final String window;
  final int? bookedCount;
  final int? capacity;

  @override
  Widget build(BuildContext context) {
    final booked = bookedCount;
    final cap = capacity;
    final hasFill = booked != null && cap != null && cap > 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          eyebrow,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: AppTypography.overline.copyWith(
            color: colors.brand,
            fontSize: 8,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.1,
            height: 1,
          ),
        ),
        const SizedBox(height: 4),
        _SlotFillLine(
          colors: colors,
          window: window,
          bookedCount: hasFill ? booked : null,
          capacity: hasFill ? cap : null,
        ),
      ],
    );
  }
}

/// One aligned "window ... booked/capacity" line with a full-width fill bar
/// underneath — the shared shape for every slot row in the tile.
class _SlotFillLine extends StatelessWidget {
  const _SlotFillLine({
    required this.colors,
    required this.window,
    this.bookedCount,
    this.capacity,
  });

  final AppColorSet colors;
  final String window;
  final int? bookedCount;
  final int? capacity;

  @override
  Widget build(BuildContext context) {
    final booked = bookedCount;
    final cap = capacity;
    final hasFill = booked != null && cap != null && cap > 0;
    final ratio = hasFill ? (booked / cap).clamp(0.0, 1.0).toDouble() : 0.0;
    final isFull = hasFill && booked >= cap;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(
              child: Text(
                window,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurface,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  height: 1.2,
                ),
              ),
            ),
            if (hasFill) ...[
              const SizedBox(width: AppSpacing.sm),
              Text(
                '$booked/$cap',
                maxLines: 1,
                style: AppTypography.caption.copyWith(
                  color: isFull ? colors.onSurface : colors.onSurfaceDim,
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  height: 1.2,
                  fontFeatures: const [FontFeature.tabularFigures()],
                ),
              ),
            ],
          ],
        ),
        if (hasFill) ...[
          const SizedBox(height: 5),
          ClipRRect(
            borderRadius: AppRadius.borderFull,
            child: LinearProgressIndicator(
              value: ratio,
              minHeight: 5,
              backgroundColor: colors.outline.withValues(alpha: 0.45),
              valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
            ),
          ),
        ],
      ],
    );
  }
}

class _BatchSlotRow extends StatelessWidget {
  const _BatchSlotRow({required this.slot, required this.colors});

  final DeliverySlot slot;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return _SlotFillLine(
      colors: colors,
      window: _formatSlotRange(slot),
      bookedCount: slot.bookedCount,
      capacity: slot.capacity,
    );
  }
}

class _MapPlaceholder extends StatelessWidget {
  const _MapPlaceholder({
    required this.colors,
    required this.brightness,
    required this.message,
  });

  final AppColorSet colors;
  final Brightness brightness;
  final String message;

  static const _davaoZoom = 12.0;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderMd,
      child: Stack(
        fit: StackFit.expand,
        children: [
          FlutterMap(
            options: const MapOptions(
              initialCenter: MapHelpers.davaoCenter,
              initialZoom: _davaoZoom,
              interactionOptions: InteractionOptions(
                flags: InteractiveFlag.none,
              ),
            ),
            children: [
              MapHelpers.tileLayer(brightness),
              MapHelpers.attribution(),
            ],
          ),
          Container(color: Colors.black.withValues(alpha: 0.52)),
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border.all(color: colors.outline.withValues(alpha: 0.18)),
              borderRadius: AppRadius.borderMd,
            ),
          ),
          Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Text(
                message,
                textAlign: TextAlign.center,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.caption.copyWith(
                  color: Colors.white,
                  fontSize: 10,
                  height: 1.15,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Live Delivery ────────────────────────────────────────────────────────────

class _QueuedDeliveryStatusTile extends StatelessWidget {
  const _QueuedDeliveryStatusTile({
    super.key,
    required this.colors,
    required this.liveState,
    this.bookedSlot,
  });

  final AppColorSet colors;
  final LiveDeliveryMapState liveState;
  final _BookedSlotView? bookedSlot;

  @override
  Widget build(BuildContext context) {
    final position = liveState.queuePosition;
    final size = liveState.queueSize;
    final queueLabel = position == null
        ? 'Waiting in queue'
        : size != null && size > 1
        ? '${_ordinal(position)} of $size in queue'
        : '${_ordinal(position)} in queue';
    final slotView = bookedSlot;

    final child = ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        color: colors.surface,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Delivery Status',
              maxLines: 1,
              style: AppTypography.h3.copyWith(
                color: colors.onSurface,
                fontSize: 20,
                height: 1,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (slotView != null) ...[
              _SlotWindowBar(
                colors: colors,
                eyebrow: slotView.isToday
                    ? 'YOUR BATCH · TODAY'
                    : 'YOUR BATCH · '
                          '${_shortDateLabel(slotView.slot.date).toUpperCase()}',
                window: _formatRawRange(
                  slotView.slot.startTime,
                  slotView.slot.endTime,
                ),
                bookedCount: slotView.fill?.bookedCount,
                capacity: slotView.fill?.capacity,
              ),
              const SizedBox(height: AppSpacing.md),
            ],
            _StatusLine(
              colors: colors,
              icon: Icons.check_rounded,
              title: 'Order Dispatched',
              subtitle: 'Ongoing Rider Delivery',
            ),
            const SizedBox(height: AppSpacing.xs),
            _StatusLine(
              colors: colors,
              leading: _QueueStopBadge(colors: colors, position: position),
              title: queueLabel,
              subtitle: 'Standby for your turn',
            ),
            const Spacer(),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Flexible(
                  child: Text(
                    'View order details',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      height: 1,
                    ),
                  ),
                ),
                const SizedBox(width: 3),
                Icon(
                  Icons.arrow_forward_rounded,
                  size: 11,
                  color: colors.brand,
                ),
              ],
            ),
          ],
        ),
      ),
    );

    return Semantics(
      container: true,
      explicitChildNodes: true,
      button: true,
      label: 'Open current delivery details',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          if (liveState.orderId != null) {
            context.push('/customer/orders/${liveState.orderId}');
          }
        },
        child: child,
      ),
    );
  }
}

String _ordinal(int value) {
  final mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return '${value}th';
  return switch (value % 10) {
    1 => '${value}st',
    2 => '${value}nd',
    3 => '${value}rd',
    _ => '${value}th',
  };
}

class _LiveDeliveryStatusTile extends StatelessWidget {
  const _LiveDeliveryStatusTile({
    super.key,
    required this.colors,
    required this.liveState,
    required this.liveRiderPoint,
    required this.hasLiveRiderPoint,
    required this.locationHealth,
    this.bookedSlot,
  });

  final AppColorSet colors;
  final LiveDeliveryMapState liveState;
  final LatLng? liveRiderPoint;
  final bool hasLiveRiderPoint;
  final LocationHealth locationHealth;

  /// "1.2 km · ~4 min away" while a live fix exists; null hides the caption.
  String? get _remainingLabel {
    final point = liveRiderPoint;
    if (point == null || liveState.routePoints.length < 2) return null;
    final meters = remainingRouteDistanceMeters(point, liveState.routePoints);
    final minutes = estimateRouteEtaMinutes(point, liveState.routePoints);
    final distance = meters >= 950
        ? '${(meters / 1000).toStringAsFixed(1)} km'
        : '${meters.round()} m';
    return '$distance · ~$minutes min away';
  }
  final _BookedSlotView? bookedSlot;

  @override
  Widget build(BuildContext context) {
    final ratio = liveRiderPoint == null
        ? 0.0
        : routeProgressRatioForPoint(liveRiderPoint!, liveState.routePoints);
    final queueSize = liveState.queueSize;
    final queueLabel = liveState.queuePosition == null
        ? null
        : queueSize != null && queueSize > 1
        ? '${_ordinal(liveState.queuePosition!)} of $queueSize in queue'
        : '${_ordinal(liveState.queuePosition!)} in queue';

    final slotView = bookedSlot;

    final child = ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(color: colors.surface),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Delivery Status',
              maxLines: 1,
              style: AppTypography.h3.copyWith(
                color: colors.onSurface,
                fontSize: 20,
                height: 1.0,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (slotView != null) ...[
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  slotView.fill != null
                      ? '${_formatRawRange(slotView.slot.startTime, slotView.slot.endTime)}: '
                            '${slotView.fill!.bookedCount}/${slotView.fill!.capacity}'
                      : _formatRawRange(
                          slotView.slot.startTime,
                          slotView.slot.endTime,
                        ),
                  maxLines: 1,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurface,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                  ),
                ),
              ),
              const SizedBox(height: 4),
            ],
            DeliveryJourneyBar(
              colors: colors,
              progress: ratio,
              compact: true,
              remainingLabel: _remainingLabel,
            ),
            const SizedBox(height: AppSpacing.sm),
            _StatusLine(
              colors: colors,
              icon: Icons.check_rounded,
              title: 'Order Dispatched',
              // The line below already says the rider is on the way, so the
              // subtitle only carries the queue position (narrow card).
              subtitle: queueLabel ?? 'Ongoing rider delivery',
            ),
            const SizedBox(height: AppSpacing.xs),
            _StatusLine(
              colors: colors,
              icon: Icons.electric_moped_rounded,
              title: 'Rider is on the way',
              subtitle: switch (locationHealth) {
                LocationHealth.live => 'Live · location updating',
                LocationHealth.stale => 'Paused · last known shown',
                LocationHealth.offline when hasLiveRiderPoint =>
                  'Offline · last known shown',
                LocationHealth.offline => 'Waiting for rider GPS',
              },
              outlined: true,
            ),
            if (liveState.routingHealth != RoutingHealth.current) ...[
              const SizedBox(height: AppSpacing.xs),
              _StatusLine(
                colors: colors,
                icon: Icons.route_outlined,
                title: liveState.routingHealth == RoutingHealth.stale
                    ? 'Route data stale'
                    : 'Route geometry degraded',
                subtitle: 'Stop order remains server verified',
                outlined: true,
              ),
            ],
            if (!hasLiveRiderPoint) ...[
              const SizedBox(height: AppSpacing.xs),
              _StatusLine(
                colors: colors,
                icon: Icons.gps_fixed_rounded,
                title: 'GPS reconnecting',
                subtitle: 'Live map resumes soon',
                outlined: true,
              ),
              const SizedBox(height: AppSpacing.sm),
              Expanded(
                child: _PendingRoutePreview(colors: colors, state: liveState),
              ),
              const SizedBox(height: AppSpacing.sm),
              _OpenTrackingButton(colors: colors),
            ],
          ],
        ),
      ),
    );

    return Semantics(
      container: true,
      explicitChildNodes: true,
      button: true,
      label: 'Open current delivery details',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          if (liveState.orderId != null) {
            context.push('/customer/orders/${liveState.orderId}');
          }
        },
        child: child,
      ),
    );
  }
}

class _PendingRoutePreview extends StatelessWidget {
  const _PendingRoutePreview({required this.colors, required this.state});

  final AppColorSet colors;
  final LiveDeliveryMapState state;

  LatLng get _center => LatLng(
    (state.shopPoint.latitude + state.destPoint.latitude) / 2,
    (state.shopPoint.longitude + state.destPoint.longitude) / 2,
  );

  List<LatLng> get _routePoints =>
      state.routePoints.isNotEmpty ? state.routePoints : const [];

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;

    return ClipRRect(
      key: const Key('pending-route-preview-map'),
      borderRadius: AppRadius.borderMd,
      child: Stack(
        fit: StackFit.expand,
        children: [
          FlutterMap(
            options: MapOptions(
              initialCenter: _center,
              initialZoom: 13.2,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.none,
              ),
            ),
            children: [
              MapHelpers.tileLayer(brightness),
              if (_routePoints.isNotEmpty)
                MapHelpers.routePolyline(_routePoints),
              MarkerLayer(
                markers: [
                  MapHelpers.shopMarker(point: state.shopPoint),
                  MapHelpers.destinationMarker(point: state.destPoint),
                ],
              ),
              MapHelpers.attribution(includeRouting: _routePoints.isNotEmpty),
            ],
          ),
          Container(color: Colors.black.withValues(alpha: 0.22)),
          Positioned(
            top: AppSpacing.xs,
            left: AppSpacing.xs,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 3,
              ),
              decoration: BoxDecoration(
                color: colors.surface.withValues(alpha: 0.92),
                borderRadius: AppRadius.borderFull,
                border: Border.all(
                  color: colors.outline.withValues(alpha: 0.35),
                ),
              ),
              child: Text(
                'ROUTE PREVIEW',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.overline.copyWith(
                  color: colors.brand,
                  fontSize: 7,
                  fontWeight: FontWeight.w900,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OpenTrackingButton extends StatelessWidget {
  const _OpenTrackingButton({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      button: true,
      label: 'Open live tracking',
      child: ExcludeSemantics(
        child: SizedBox(
          key: const Key('open-live-tracking-button'),
          width: double.infinity,
          height: 48,
          child: TextButton(
            onPressed: () => context.push('/customer/tracking'),
            style: TextButton.styleFrom(
              foregroundColor: Colors.black,
              backgroundColor: colors.brand,
              shape: RoundedRectangleBorder(
                borderRadius: AppRadius.borderFull,
              ),
            ),
            child: Text(
              'Open live tracking',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: Colors.black,
                fontSize: 10,
                fontWeight: FontWeight.w900,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// One diameter for every status circle in the delivery tiles, so rows
/// share a left edge and their text columns line up.
const _statusCircleSize = 26.0;
const _statusCircleStroke = 1.5;
const _statusDoneGreen = Color(0xFF78EC75);

/// Filled green = step done; brand outline = step pending/in progress.
class _StatusCircle extends StatelessWidget {
  const _StatusCircle({
    required this.colors,
    required this.icon,
    this.outlined = false,
  });

  final AppColorSet colors;
  final IconData icon;
  final bool outlined;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _statusCircleSize,
      height: _statusCircleSize,
      decoration: BoxDecoration(
        color: outlined ? Colors.transparent : _statusDoneGreen,
        shape: BoxShape.circle,
        border: outlined
            ? Border.all(color: colors.brand, width: _statusCircleStroke)
            : null,
      ),
      child: Icon(
        icon,
        size: 15,
        color: outlined ? colors.brand : Colors.black,
      ),
    );
  }
}

/// Outlined circle holding the customer's stop number in the rider's route,
/// or an hourglass while the queue position is still unknown.
class _QueueStopBadge extends StatelessWidget {
  const _QueueStopBadge({required this.colors, required this.position});

  final AppColorSet colors;
  final int? position;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: _statusCircleSize,
      height: _statusCircleSize,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: colors.brand, width: _statusCircleStroke),
      ),
      child: position == null
          ? Icon(Icons.hourglass_top_rounded, size: 14, color: colors.brand)
          : Text(
              '$position',
              style: AppTypography.bodyBold.copyWith(
                color: colors.brand,
                fontSize: 12,
                height: 1,
              ),
            ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.colors,
    required this.title,
    required this.subtitle,
    this.icon,
    this.outlined = false,
    this.leading,
  });

  final AppColorSet colors;
  final IconData? icon;
  final String title;
  final String subtitle;
  final bool outlined;

  /// Replaces the default status circle (e.g. the queue stop badge) while
  /// keeping the row's text styles and alignment identical.
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      container: true,
      label: '$title. $subtitle',
      child: ExcludeSemantics(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            leading ??
                _StatusCircle(colors: colors, icon: icon!, outlined: outlined),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontWeight: FontWeight.w900,
                      fontSize: 10,
                      height: 1.05,
                    ),
                  ),
                  Text(
                    subtitle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurface,
                      fontWeight: FontWeight.w600,
                      fontSize: 9,
                      height: 1.05,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

String _formatSlotRange(DeliverySlot slot) =>
    _formatRawRange(slot.startTime, slot.endTime);

String _formatRawRange(String startRaw, String endRaw) {
  final start = _parseTime(startRaw);
  final end = _parseTime(endRaw);
  if (start == null || end == null) {
    return '$startRaw - $endRaw';
  }

  final startPeriod = start.hour >= 12 ? 'PM' : 'AM';
  final endPeriod = end.hour >= 12 ? 'PM' : 'AM';
  final startLabel = _formatTime(
    start,
    includePeriod: startPeriod != endPeriod,
  );
  final endLabel = _formatTime(end, includePeriod: true);
  return '$startLabel - $endLabel';
}

/// Formats an ISO `YYYY-MM-DD` date as e.g. `Fri, Jul 17`.
String _shortDateLabel(String isoDate) {
  final date = DateTime.tryParse(isoDate);
  if (date == null) return isoDate;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return '${days[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}';
}

TimeOfDay? _parseTime(String raw) {
  final parts = raw.split(':');
  if (parts.length < 2) return null;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return null;
  return TimeOfDay(hour: hour, minute: minute);
}

String _formatTime(TimeOfDay time, {required bool includePeriod}) {
  final period = time.hour >= 12 ? 'PM' : 'AM';
  final hour = time.hourOfPeriod == 0 ? 12 : time.hourOfPeriod;
  final minute = time.minute.toString().padLeft(2, '0');
  final label = '$hour:$minute';
  return includePeriod ? '$label $period' : label;
}

// ── Active ────────────────────────────────────────────────────────────────────

class _ActiveTile extends StatelessWidget {
  const _ActiveTile({
    required this.state,
    required this.brightness,
    required this.riderPoint,
    required this.locationHealth,
  });
  final LiveDeliveryMapState state;
  final Brightness brightness;
  final LatLng riderPoint;
  final LocationHealth locationHealth;

  @override
  Widget build(BuildContext context) {
    final canShowRouteEta =
        state.routePoints.length >= 2 &&
        (state.routingHealth == RoutingHealth.current ||
            state.routingHealth == RoutingHealth.stale);
    // Prefer the server's road-time leg duration over the client-side
    // geometry estimate; the dispatch plan is the source of truth.
    final serverEtaMinutes = state.legDurationSeconds != null
        ? (state.legDurationSeconds! / 60).ceil()
        : null;
    final eta = canShowRouteEta
        ? (serverEtaMinutes ??
              estimateRouteEtaMinutes(riderPoint, state.routePoints))
        : null;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Stack(
      fit: StackFit.expand,
      children: [
        Semantics(
          key: const Key('live-delivery-map'),
          container: true,
          excludeSemantics: true,
          label: 'Live delivery map',
          hint: 'Shows the rider current location and delivery route',
          child: FlutterMap(
            options: MapOptions(
              initialCenter: riderPoint,
              initialZoom: 13.8,
              interactionOptions: const InteractionOptions(
                flags: InteractiveFlag.none,
              ),
            ),
            children: [
              MapHelpers.tileLayer(brightness),
              if (state.routePoints.isNotEmpty)
                MapHelpers.routePolyline(state.routePoints),
              MarkerLayer(
                markers: [
                  MapHelpers.shopMarker(point: state.shopPoint),
                  MapHelpers.destinationMarker(point: state.destPoint),
                  MapHelpers.riderMarker(riderPoint),
                ],
              ),
              MapHelpers.attribution(
                includeRouting: state.routePoints.isNotEmpty,
              ),
            ],
          ),
        ),

        // LIVE MAP badge — top left
        Positioned(
          top: AppSpacing.sm,
          left: AppSpacing.sm,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: 3,
            ),
            decoration: BoxDecoration(
              color: colors.brand,
              borderRadius: AppRadius.borderFull,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 5,
                  height: 5,
                  decoration: const BoxDecoration(
                    color: Colors.black,
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 4),
                Text(
                  switch (locationHealth) {
                    LocationHealth.live => 'LIVE MAP',
                    LocationHealth.stale => 'STALE LOCATION',
                    LocationHealth.offline => 'GPS OFFLINE',
                  },
                  style: AppTypography.overline.copyWith(
                    color: Colors.black,
                    fontSize: 8,
                    letterSpacing: 0.8,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),

        // ETA badge — top right
        if (eta != null)
          Positioned(
            top: AppSpacing.sm,
            right: AppSpacing.sm,
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: 3,
              ),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                borderRadius: AppRadius.borderFull,
              ),
              child: Text(
                '~$eta min',
                style: AppTypography.overline.copyWith(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
