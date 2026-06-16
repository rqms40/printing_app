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

class MapTrackingTile extends ConsumerStatefulWidget {
  const MapTrackingTile({super.key});

  @override
  ConsumerState<MapTrackingTile> createState() => _MapTrackingTileState();
}

class _MapTrackingTileState extends ConsumerState<MapTrackingTile> {
  static const _freshLocationWindow = Duration(minutes: 10);

  String? _subscribedAssignmentId;
  bool _isConnecting = false;
  late final WebSocketService _ws;

  @override
  void initState() {
    super.initState();
    _ws = ref.read(webSocketServiceProvider);
  }

  @override
  void dispose() {
    _ws.disconnectLocation();
    super.dispose();
  }

  Future<void> _ensureLocationSubscription(String assignmentId) async {
    if (_subscribedAssignmentId == assignmentId || _isConnecting) return;
    _isConnecting = true;
    if (_subscribedAssignmentId != null) {
      _ws.disconnectLocation();
    }
    try {
      await _ws.connectLocation(onLocationUpdate: _handleLocationUpdate);
      if (!mounted) return;
      _ws.subscribeToDelivery(assignmentId);
      _subscribedAssignmentId = assignmentId;
    } finally {
      _isConnecting = false;
    }
  }

  void _handleLocationUpdate(dynamic data) {
    if (!mounted || data is! Map) return;
    final payload = Map<String, dynamic>.from(data);
    final lat = (payload['latitude'] as num?)?.toDouble();
    final lng = (payload['longitude'] as num?)?.toDouble();
    if (lat == null || lng == null) return;

    ref.read(liveRiderLocationProvider.notifier).state = LocationUpdate(
      id: 'home-live',
      deliveryAssignmentId:
          payload['assignmentId']?.toString() ??
          payload['assignment_id']?.toString() ??
          _subscribedAssignmentId ??
          '',
      latitude: lat,
      longitude: lng,
      timestamp: _parsePayloadTimestamp(payload['timestamp']),
    );
  }

  DateTime _parsePayloadTimestamp(dynamic value) {
    if (value is DateTime) return value;
    if (value is String) {
      return DateTime.tryParse(value) ?? DateTime.now();
    }
    if (value is num) {
      final milliseconds = value > 1000000000000 ? value : value * 1000;
      return DateTime.fromMillisecondsSinceEpoch(milliseconds.round());
    }
    return DateTime.now();
  }

  @override
  Widget build(BuildContext context) {
    final mapAsync = ref.watch(liveDeliveryMapProvider);
    // Watched directly here so location updates only rebuild markers,
    // not the entire FutureProvider async cycle.
    final locationUpdate = ref.watch(liveRiderLocationProvider);
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
            state.orderStatus == OrderStatus.onTheWay &&
            state.deliveryAssignmentId != null;

        final deliveryAssignmentId = state.deliveryAssignmentId;
        if (canShowLiveMap &&
            deliveryAssignmentId != null &&
            deliveryAssignmentId.isNotEmpty) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) return;
            unawaited(_ensureLocationSubscription(deliveryAssignmentId));
          });
        }

        if (canShowLiveMap) {
          final isLocationFresh = locationUpdate != null &&
              locationUpdate.deliveryAssignmentId == state.deliveryAssignmentId &&
              DateTime.now().difference(locationUpdate.timestamp) <= _freshLocationWindow;

          if (isLocationFresh) {
            return _DeliveryStatusAndMapLayout(
              colors: colors,
              brightness: brightness,
              slots: slots.slots,
              isLoading: slots.isLoading,
              liveState: state,
              liveRiderPoint: LatLng(locationUpdate.latitude, locationUpdate.longitude),
              onMapTap: () => context.push('/customer/tracking'),
            );
          }
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

class _DeliveryStatusAndMapLayout extends StatelessWidget {
  const _DeliveryStatusAndMapLayout({
    required this.colors,
    required this.brightness,
    required this.slots,
    required this.isLoading,
    this.liveState,
    this.liveRiderPoint,
    this.onMapTap,
  });

  final AppColorSet colors;
  final Brightness brightness;
  final List<DeliverySlot> slots;
  final bool isLoading;
  final LiveDeliveryMapState? liveState;
  final LatLng? liveRiderPoint;
  final VoidCallback? onMapTap;

  bool get _hasLiveMap => liveState != null && liveRiderPoint != null;

  List<DeliverySlot> get _dailySlots {
    final sorted = [...slots]
      ..sort((a, b) => a.startTime.compareTo(b.startTime));
    return sorted.take(3).toList();
  }

  @override
  Widget build(BuildContext context) {
    final visibleSlots = _dailySlots;
    final idleMapMessage = visibleSlots.isEmpty
        ? 'No batches scheduled today'
        : 'Live map starts after rider dispatch.';
    final statusPanel = _hasLiveMap
        ? _LiveDeliveryStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            liveState: liveState!,
            liveRiderPoint: liveRiderPoint!,
            slots: slots,
          )
        : _BatchStatusTile(
            key: const Key('delivery-status-panel'),
            colors: colors,
            slots: visibleSlots,
            isLoading: isLoading,
          );
    final mapPanel = _DeliveryMapPanel(
      key: const Key('delivery-map-panel'),
      colors: colors,
      brightness: brightness,
      message: isLoading ? 'Loading delivery status...' : idleMapMessage,
      liveState: liveState,
      liveRiderPoint: liveRiderPoint,
      onMapTap: onMapTap,
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        const rightColumnGap = AppSpacing.xs + 2;
        final maxHeight = constraints.hasBoundedHeight
            ? constraints.maxHeight
            : 290.0;
        final bandHeight = (maxHeight - (rightColumnGap * 2)).clamp(
          0.0,
          double.infinity,
        );
        final unit = bandHeight / 7;
        final statusHeight = (unit * 4) + rightColumnGap;
        final mapHeight = unit * 3;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: statusHeight, child: statusPanel),
            const SizedBox(height: rightColumnGap),
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
    required this.isLoading,
  });

  final AppColorSet colors;
  final List<DeliverySlot> slots;
  final bool isLoading;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
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
            const SizedBox(height: AppSpacing.xs),
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
              Expanded(
                child: Align(
                  alignment: Alignment.centerLeft,
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
                ),
              )
            else
              for (final slot in slots) ...[
                _BatchSlotRow(slot: slot, colors: colors),
                const SizedBox(height: AppSpacing.xs),
              ],
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
    this.onMapTap,
  });

  final AppColorSet colors;
  final Brightness brightness;
  final String message;
  final LiveDeliveryMapState? liveState;
  final LatLng? liveRiderPoint;
  final VoidCallback? onMapTap;

  bool get _hasLiveMap => liveState != null && liveRiderPoint != null;

  @override
  Widget build(BuildContext context) {
    final child = _hasLiveMap
        ? _ActiveTile(
            state: liveState!,
            brightness: brightness,
            riderPoint: liveRiderPoint!,
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
            children: [MapHelpers.tileLayer(brightness)],
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

class _LiveDeliveryStatusTile extends StatelessWidget {
  const _LiveDeliveryStatusTile({
    super.key,
    required this.colors,
    required this.liveState,
    required this.liveRiderPoint,
    required this.slots,
  });

  final AppColorSet colors;
  final LiveDeliveryMapState liveState;
  final LatLng liveRiderPoint;
  final List<DeliverySlot> slots;

  static double _progressRatio(LatLng rider, List<LatLng> route) {
    if (route.length < 2) return 0.0;
    const distance = Distance();
    var nearest = 0;
    var minDist = double.infinity;
    for (var i = 0; i < route.length; i++) {
      final d = distance(rider, route[i]);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return (nearest / (route.length - 1)).clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final ratio = _progressRatio(liveRiderPoint, liveState.routePoints);
    final percent = (ratio * 100).round();

    final assignedSlot = liveState.assignedSlot;
    final activeSlot = assignedSlot != null
        ? slots.where((s) => s.templateId == assignedSlot.slotTemplateId).firstOrNull
        : null;

    final child = ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
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
            const SizedBox(height: AppSpacing.xs),
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
              subtitle: 'Ongoing Rider Delivery',
            ),
            const SizedBox(height: AppSpacing.xs),
            _StatusLine(
              colors: colors,
              icon: Icons.electric_moped_rounded,
              title: 'Rider is on the way',
              subtitle: 'Tracking real-time location',
              darkIcon: true,
            ),
          ],
        ),
      ),
    );

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        if (liveState.orderId != null) {
          context.push('/customer/orders/${liveState.orderId}');
        }
      },
      child: child,
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

    return Row(
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
  });
  final LiveDeliveryMapState state;
  final Brightness brightness;
  final LatLng riderPoint;

  static int _etaMinutes(LatLng rider, List<LatLng> route) {
    if (route.isEmpty) return 0;
    const distance = Distance();
    var nearest = 0;
    var minDist = double.infinity;
    for (var i = 0; i < route.length; i++) {
      final d = distance(rider, route[i]);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return route.length - nearest;
  }

  @override
  Widget build(BuildContext context) {
    final eta = _etaMinutes(riderPoint, state.routePoints);
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Stack(
      fit: StackFit.expand,
      children: [
        FlutterMap(
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
          ],
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
                  'LIVE MAP',
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
