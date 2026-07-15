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
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

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
    // Watched directly here so location updates only rebuild markers,
    // not the entire FutureProvider async cycle.
    final locationUpdate = ref.watch(liveRiderLocationProvider);
    final socketHealth = ref.watch(liveLocationSocketHealthProvider);
    final slots = ref.watch(deliverySlotProvider(_today()));
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return mapAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => _DeliveryStatusAndMapLayout(
        colors: colors,
        brightness: brightness,
        slots: slots.slots,
        isLoading: true,
      ),
      error: (e, st) => _DeliveryStatusAndMapLayout(
        colors: colors,
        brightness: brightness,
        slots: slots.slots,
        isLoading: slots.isLoading,
      ),
      data: (state) {
        if (state.status == LiveMapStatus.loading) {
          return _DeliveryStatusAndMapLayout(
            colors: colors,
            brightness: brightness,
            slots: slots.slots,
            isLoading: true,
          );
        }

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
          );
        }

        return _DeliveryStatusAndMapLayout(
          colors: colors,
          brightness: brightness,
          slots: slots.slots,
          isLoading: slots.isLoading,
        );
      },
    );
  }

  static String _today() {
    final now = DateTime.now();
    return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  }
}

const _deliveryStatusTitleGap = AppSpacing.md;

class _DeliveryStatusAndMapLayout extends StatelessWidget {
  const _DeliveryStatusAndMapLayout({
    required this.colors,
    required this.brightness,
    required this.slots,
    required this.isLoading,
    this.liveState,
    this.liveRiderPoint,
    this.locationHealth = LocationHealth.offline,
    this.onMapTap,
  });

  final AppColorSet colors;
  final Brightness brightness;
  final List<DeliverySlot> slots;
  final bool isLoading;
  final LiveDeliveryMapState? liveState;
  final LatLng? liveRiderPoint;
  final LocationHealth locationHealth;
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

  bool get _shouldShowMapPanel =>
      !_hasActiveDelivery || liveRiderPoint != null || _isQueued;

  List<DeliverySlot> get _sortedSlots {
    final sorted = [...slots]
      ..sort((a, b) => a.startTime.compareTo(b.startTime));
    return sorted;
  }

  static double _idleStatusHeight({
    required int visibleSlotCount,
    required bool hasHiddenSlots,
    required bool isLoading,
  }) {
    if (isLoading && visibleSlotCount == 0) return 96;
    if (visibleSlotCount == 0) return 94;

    const chromeHeight = (AppSpacing.md * 2) + 20 + _deliveryStatusTitleGap;
    const slotRowHeight = 27.0;
    const viewMoreHeight = 20.0;
    return chromeHeight +
        (slotRowHeight * visibleSlotCount) +
        (hasHiddenSlots ? viewMoreHeight : 0);
  }

  double _statusHeight({
    required double maxHeight,
    required int visibleSlotCount,
    required int hiddenSlotCount,
    required bool showMapPanel,
  }) {
    if (!showMapPanel) return maxHeight;

    final maxStatusHeight = (maxHeight - _panelGap - _minMapHeight)
        .clamp(0.0, maxHeight)
        .toDouble();
    if (maxStatusHeight <= 0) return maxHeight;

    final desiredHeight = _isQueued
        // The queued tile needs enough height for its slot bar, dispatched
        // line, and the stop-position badge; the compressed active ratio
        // clips the badge below the visible area (and off the a11y tree).
        ? 196.0
        : _hasActiveDelivery
        ? ((((maxHeight - (_panelGap * 2)) / 7) * 4) + _panelGap)
        : _idleStatusHeight(
            visibleSlotCount: visibleSlotCount,
            hasHiddenSlots: hiddenSlotCount > 0,
            isLoading: isLoading,
          );

    return desiredHeight.clamp(0.0, maxStatusHeight).toDouble();
  }

  @override
  Widget build(BuildContext context) {
    final sortedSlots = _sortedSlots;
    final visibleSlots = sortedSlots.take(_maxInlineSlots).toList();
    final hiddenSlotCount = sortedSlots.length - visibleSlots.length;
    final showMapPanel = _shouldShowMapPanel;
    final queuePosition = liveState?.queuePosition;
    final idleMapMessage = _isQueued
        ? (queuePosition != null && queuePosition > 1
              ? 'Live map starts after Stop ${queuePosition - 1}!'
              : 'Live map starts when you are next!')
        : _hasActiveDelivery
        ? 'Waiting for rider location...'
        : visibleSlots.isEmpty
        ? 'No batches scheduled today'
        : 'Live map starts after rider dispatch.';
    final statusPanel =
        _hasActiveDelivery && liveState?.canTrackDelivery == false
        ? _QueuedDeliveryStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            liveState: liveState!,
            slots: sortedSlots,
          )
        : _hasActiveDelivery
        ? _LiveDeliveryStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            liveState: liveState!,
            liveRiderPoint: liveRiderPoint,
            hasLiveRiderPoint: liveRiderPoint != null,
            locationHealth: locationHealth,
            slots: sortedSlots,
          )
        : _BatchStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            slots: visibleSlots,
            allSlots: sortedSlots,
            hiddenSlotCount: hiddenSlotCount,
            isLoading: isLoading,
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
        final statusHeight = _statusHeight(
          maxHeight: maxHeight,
          visibleSlotCount: visibleSlots.length,
          hiddenSlotCount: hiddenSlotCount,
          showMapPanel: showMapPanel,
        );
        final mapHeight = (maxHeight - statusHeight - _panelGap)
            .clamp(0.0, double.infinity)
            .toDouble();

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: statusHeight, child: statusPanel),
            if (mapPanel != null) ...[
              const SizedBox(height: _panelGap),
              SizedBox(height: mapHeight, child: mapPanel),
            ],
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
  });

  final AppColorSet colors;
  final List<DeliverySlot> slots;
  final List<DeliverySlot> allSlots;
  final int hiddenSlotCount;
  final bool isLoading;

  bool get _hasHiddenSlots => hiddenSlotCount > 0;

  @override
  Widget build(BuildContext context) {
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
            const SizedBox(height: _deliveryStatusTitleGap),
            if (isLoading && slots.isEmpty)
              Expanded(
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
            else if (slots.isEmpty)
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
            else ...[
              for (var i = 0; i < slots.length; i++) ...[
                _BatchSlotRow(slot: slots[i], colors: colors),
                if (i != slots.length - 1 || _hasHiddenSlots)
                  const SizedBox(height: AppSpacing.xs),
              ],
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

class _BatchSlotRow extends StatelessWidget {
  const _BatchSlotRow({required this.slot, required this.colors});

  final DeliverySlot slot;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final ratio = slot.capacity <= 0
        ? 0.0
        : (slot.bookedCount / slot.capacity).clamp(0.0, 1.0);
    final percent = (ratio * 100).round();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            '${_formatSlotRange(slot)}: ${slot.bookedCount}/${slot.capacity}',
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
        Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: AppRadius.borderFull,
                child: LinearProgressIndicator(
                  value: ratio,
                  minHeight: 6,
                  backgroundColor: colors.outline.withValues(alpha: 0.55),
                  valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
                ),
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '$percent%',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 8,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
              ),
            ),
          ],
        ),
      ],
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
    this.slots = const [],
  });

  final AppColorSet colors;
  final LiveDeliveryMapState liveState;
  final List<DeliverySlot> slots;

  @override
  Widget build(BuildContext context) {
    final position = liveState.queuePosition;
    final size = liveState.queueSize;
    final queueLabel = position == null
        ? 'Waiting in queue'
        : size != null && size > 1
        ? '${_ordinal(position)} of $size in queue'
        : '${_ordinal(position)} in queue';
    final assignedSlot = liveState.assignedSlot;
    final activeSlot = assignedSlot != null
        ? slots
              .where((s) => s.templateId == assignedSlot.slotTemplateId)
              .firstOrNull
        : null;
    final slotRatio = activeSlot == null || activeSlot.capacity == 0
        ? 0.0
        : (activeSlot.bookedCount / activeSlot.capacity).clamp(0.0, 1.0);

    return ClipRRect(
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
            if (activeSlot != null) ...[
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  '${_formatSlotRange(activeSlot)}: '
                  '${activeSlot.bookedCount}/${activeSlot.capacity}',
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
              Row(
                children: [
                  Expanded(
                    child: ClipRRect(
                      borderRadius: AppRadius.borderFull,
                      child: LinearProgressIndicator(
                        value: slotRatio,
                        minHeight: 6,
                        backgroundColor: colors.outline.withValues(alpha: 0.55),
                        valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
                      ),
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    '${(slotRatio * 100).round()}%',
                    style: AppTypography.overline.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 8,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                    ),
                  ),
                ],
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
            Semantics(
              container: true,
              label: '$queueLabel. Standby for your turn',
              child: ExcludeSemantics(
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.brand, width: 1.6),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'STOP',
                            style: AppTypography.overline.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 5.5,
                              height: 1,
                              letterSpacing: 0.8,
                            ),
                          ),
                          Text(
                            position == null ? '—' : '$position',
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onSurface,
                              fontSize: 12,
                              height: 1.05,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            queueLabel,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: AppTypography.caption.copyWith(
                              color: colors.brand,
                              fontSize: 12,
                              fontWeight: FontWeight.w800,
                              height: 1.15,
                            ),
                          ),
                          Text(
                            'Standby for your turn',
                            maxLines: 1,
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
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
    required this.slots,
  });

  final AppColorSet colors;
  final LiveDeliveryMapState liveState;
  final LatLng? liveRiderPoint;
  final bool hasLiveRiderPoint;
  final LocationHealth locationHealth;
  final List<DeliverySlot> slots;

  @override
  Widget build(BuildContext context) {
    final ratio = liveRiderPoint == null
        ? 0.0
        : routeProgressRatioForPoint(liveRiderPoint!, liveState.routePoints);
    final percent = (ratio * 100).round();
    final queueSize = liveState.queueSize;
    final queueLabel = liveState.queuePosition == null
        ? null
        : queueSize != null && queueSize > 1
        ? '${_ordinal(liveState.queuePosition!)} of $queueSize in queue'
        : '${_ordinal(liveState.queuePosition!)} in queue';

    final assignedSlot = liveState.assignedSlot;
    final activeSlot = assignedSlot != null
        ? slots
              .where((s) => s.templateId == assignedSlot.slotTemplateId)
              .firstOrNull
        : null;

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
            if (activeSlot != null) ...[
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  '${_formatSlotRange(activeSlot)}: ${activeSlot.bookedCount}/${activeSlot.capacity}',
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
            Row(
              children: [
                Expanded(
                  child: ClipRRect(
                    borderRadius: AppRadius.borderFull,
                    child: LinearProgressIndicator(
                      value: ratio,
                      minHeight: 6,
                      backgroundColor: colors.outline.withValues(alpha: 0.55),
                      valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
                    ),
                  ),
                ),
                const SizedBox(width: 5),
                Text(
                  '$percent%',
                  style: AppTypography.overline.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 8,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            _StatusLine(
              colors: colors,
              icon: Icons.check_rounded,
              title: 'Order Dispatched',
              subtitle: queueLabel == null
                  ? 'Ongoing Rider Delivery'
                  : '$queueLabel · Ongoing Rider Delivery',
            ),
            const SizedBox(height: AppSpacing.xs),
            _StatusLine(
              colors: colors,
              icon: Icons.electric_moped_rounded,
              title: 'Rider is on the way',
              subtitle: switch (locationHealth) {
                LocationHealth.live => 'Tracking real-time location',
                LocationHealth.stale => 'Location stale — showing last update',
                LocationHealth.offline when hasLiveRiderPoint =>
                  'GPS offline — showing last location',
                LocationHealth.offline => 'Awaiting an authenticated GPS ping',
              },
              darkIcon: true,
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
                darkIcon: true,
              ),
            ],
            if (!hasLiveRiderPoint) ...[
              const SizedBox(height: AppSpacing.xs),
              _StatusLine(
                colors: colors,
                icon: Icons.gps_fixed_rounded,
                title: 'Rider GPS reconnecting',
                subtitle: 'Live map resumes automatically',
                darkIcon: true,
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

class _StatusLine extends StatelessWidget {
  const _StatusLine({
    required this.colors,
    required this.icon,
    required this.title,
    required this.subtitle,
    this.darkIcon = false,
  });

  final AppColorSet colors;
  final IconData icon;
  final String title;
  final String subtitle;
  final bool darkIcon;

  @override
  Widget build(BuildContext context) {
    final iconColor = darkIcon ? colors.brand : Colors.black;
    final iconBackground = darkIcon ? Colors.black : const Color(0xFF78EC75);

    return Semantics(
      container: true,
      label: '$title. $subtitle',
      child: ExcludeSemantics(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 26,
              height: 26,
              decoration: BoxDecoration(
                color: iconBackground,
                shape: BoxShape.circle,
              ),
              child: Icon(icon, size: 15, color: iconColor),
            ),
            const SizedBox(width: AppSpacing.xs),
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

String _formatSlotRange(DeliverySlot slot) {
  final start = _parseTime(slot.startTime);
  final end = _parseTime(slot.endTime);
  if (start == null || end == null) {
    return '${slot.startTime} - ${slot.endTime}';
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
