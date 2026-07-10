import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
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

class DeliveryMap extends ConsumerStatefulWidget {
  const DeliveryMap({super.key, this.tutorialKey});

  final GlobalKey? tutorialKey;

  @override
  ConsumerState<DeliveryMap> createState() => _DeliveryMapState();
}

class _DeliveryMapState extends ConsumerState<DeliveryMap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  final _mapController = MapController();
  bool _isMapReady = false;
  String? _desiredAssignmentId;
  int? _desiredPlanVersion;
  String? _subscribedAssignmentId;
  int? _subscribedPlanVersion;
  bool _isConnecting = false;
  late final WebSocketService _ws;
  Timer? _healthRefreshTimer;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _ws = ref.read(webSocketServiceProvider);
    _ws.listenForLocationHealth(_handleLocationHealth);
    _healthRefreshTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
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

  void _scheduleLocationSubscription(LiveDeliveryMapState state) {
    final assignmentId = state.deliveryAssignmentId;
    final planVersion = state.planVersion;
    if (assignmentId == null || assignmentId.isEmpty || planVersion == null) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      unawaited(_ensureLocationSubscription(assignmentId, planVersion));
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    _ws.removeLocationUpdateListener(_handleLocationUpdate);
    _ws.removeLocationHealthListener(_handleLocationHealth);
    _healthRefreshTimer?.cancel();
    super.dispose();
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
    final latitude = (payload['latitude'] as num?)?.toDouble();
    final longitude = (payload['longitude'] as num?)?.toDouble();
    final assignmentId = payload['assignmentId']?.toString();
    final planVersion = _readStrictPlanVersion(payload['planVersion']);
    final timestamp = payload['timestamp'] is String
        ? DateTime.tryParse(payload['timestamp'] as String)
        : null;
    final state = ref.read(liveDeliveryMapProvider).asData?.value;
    if (latitude == null ||
        longitude == null ||
        assignmentId == null ||
        planVersion == null ||
        timestamp == null ||
        state?.deliveryAssignmentId != assignmentId ||
        state?.planVersion == null ||
        state!.planVersion != planVersion) {
      return;
    }
    ref.read(liveRiderLocationProvider.notifier).state = LocationUpdate(
      id: 'live',
      deliveryAssignmentId: assignmentId,
      planVersion: planVersion,
      latitude: latitude,
      longitude: longitude,
      timestamp: timestamp,
    );
  }

  void _moveCameraTo(LatLng point) {
    if (!_isMapReady || !mounted) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_isMapReady || !mounted) return;
      try {
        _mapController.move(point, 13.5);
      } catch (e) {
        debugPrint('DeliveryMap: map camera move skipped: $e');
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final mapAsync = ref.watch(liveDeliveryMapProvider);
    final locationUpdate = ref.watch(liveRiderLocationProvider);
    final socketHealth = ref.watch(liveLocationSocketHealthProvider);

    // Move camera whenever a live location update arrives.
    ref.listen(liveRiderLocationProvider, (_, next) {
      if (next == null) return;
      _moveCameraTo(LatLng(next.latitude, next.longitude));
    });

    return mapAsync.when(
      skipLoadingOnRefresh: true,
      loading: () => _loadingView(colors),
      error: (e, st) => _loadingView(colors),
      data: (state) {
        final canShowLiveMap =
            state.status == LiveMapStatus.active &&
            state.canTrackDelivery &&
            state.deliveryAssignmentId?.isNotEmpty == true &&
            state.planVersion != null;
        if (!canShowLiveMap) return _loadingView(colors);
        _scheduleLocationSubscription(state);
        final matchingLocation =
            locationUpdate != null &&
                locationUpdate.deliveryAssignmentId ==
                    state.deliveryAssignmentId &&
                state.planVersion != null &&
                locationUpdate.planVersion == state.planVersion
            ? locationUpdate
            : null;
        final riderPoint = matchingLocation != null
            ? LatLng(matchingLocation.latitude, matchingLocation.longitude)
            : null;
        final health = matchingLocation == null
            ? LocationHealth.offline
            : classifyLocationHealth(
                updatedAt: matchingLocation.timestamp,
                now: ref.read(deliveryTrackingNowProvider)(),
                connected: socketHealth == LocationSocketHealth.connected,
              );
        return _mapView(state, riderPoint, health, brightness, colors);
      },
    );
  }

  Widget _loadingView(AppColorSet colors) {
    return ClipRRect(
      key: widget.tutorialKey,
      borderRadius: AppRadius.borderLg,
      child: Container(
        height: 300,
        color: colors.surfaceVariant,
        child: Center(child: CircularProgressIndicator(color: colors.accent)),
      ),
    );
  }

  Widget _mapView(
    LiveDeliveryMapState state,
    LatLng? riderPoint,
    LocationHealth locationHealth,
    Brightness brightness,
    AppColorSet colors,
  ) {
    final canShowRouteEta =
        state.routePoints.length >= 2 &&
        (state.routingHealth == RoutingHealth.current ||
            state.routingHealth == RoutingHealth.stale);
    final eta = !canShowRouteEta
        ? null
        : riderPoint == null
        ? state.legDurationSeconds == null
              ? null
              : (state.legDurationSeconds! / 60).ceil()
        : estimateRouteEtaMinutes(riderPoint, state.routePoints);

    return ClipRRect(
      key: widget.tutorialKey,
      borderRadius: AppRadius.borderLg,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: colors.outline, width: 0.5),
          borderRadius: AppRadius.borderLg,
        ),
        child: ClipRRect(
          borderRadius: AppRadius.borderLg,
          child: Stack(
            children: [
              Semantics(
                key: const Key('live-delivery-map'),
                container: true,
                explicitChildNodes: true,
                label: 'Live delivery map',
                child: FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: riderPoint ?? state.destPoint,
                    initialZoom: 13.5,
                    onMapReady: () {
                      _isMapReady = true;
                      final latest = ref.read(liveRiderLocationProvider);
                      if (latest != null) {
                        _moveCameraTo(
                          LatLng(latest.latitude, latest.longitude),
                        );
                      }
                    },
                  ),
                  children: [
                    MapHelpers.tileLayer(brightness),
                    if (state.routePoints.isNotEmpty)
                      MapHelpers.routePolyline(state.routePoints),
                    MarkerLayer(
                      markers: [
                        MapHelpers.shopMarker(point: state.shopPoint),
                        MapHelpers.destinationMarker(point: state.destPoint),
                        if (riderPoint != null)
                          MapHelpers.riderMarker(
                            riderPoint,
                            semanticKey: const Key(
                              'rider-current-location-marker',
                            ),
                            semanticLabel: 'Rider current location marker',
                          ),
                      ],
                    ),
                    MapHelpers.attribution(
                      includeRouting: state.routePoints.isNotEmpty,
                    ),
                  ],
                ),
              ),

              // Live Tracking badge — top left
              Positioned(
                top: AppSpacing.sm,
                left: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.95),
                    borderRadius: AppRadius.borderFull,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x20000000),
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedBuilder(
                        animation: _pulseController,
                        builder: (context, _) => Opacity(
                          opacity: 0.4 + (_pulseController.value * 0.6),
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: kRouteColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        switch (locationHealth) {
                          LocationHealth.live => 'Live Tracking',
                          LocationHealth.stale => 'Location stale',
                          LocationHealth.offline => 'GPS offline',
                        },
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurface,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (state.routingHealth != RoutingHealth.current)
                Positioned(
                  top: 48,
                  left: AppSpacing.sm,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surface.withValues(alpha: 0.95),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Text(
                      switch (state.routingHealth) {
                        RoutingHealth.stale => 'Route data stale',
                        RoutingHealth.malformed => 'Route geometry degraded',
                        RoutingHealth.unavailable => 'Route unavailable',
                        RoutingHealth.current => '',
                      },
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w600,
                        fontSize: 11,
                      ),
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
                      vertical: AppSpacing.xs,
                    ),
                    decoration: BoxDecoration(
                      color: colors.surface.withValues(alpha: 0.95),
                      borderRadius: AppRadius.borderFull,
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x20000000),
                          blurRadius: 8,
                          offset: Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Text(
                      '~$eta min',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w700,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
