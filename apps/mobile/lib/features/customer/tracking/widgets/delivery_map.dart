import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

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

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    ref.read(liveRiderLocationProvider.notifier).state = null;
    _connectLocationSocket();
  }

  /// Opens the location WebSocket and subscribes to the active delivery.
  /// This is the only place in the app where the location WS is connected.
  Future<void> _connectLocationSocket() async {
    await WebSocketService.instance.connectLocation(
      onLocationUpdate: (data) {
        if (!mounted) return; // widget may have been disposed
        if (data is! Map) return;
        final d = Map<String, dynamic>.from(data);
        final lat = (d['latitude'] as num?)?.toDouble();
        final lng = (d['longitude'] as num?)?.toDouble();
        if (lat == null || lng == null) return;
        ref.read(liveRiderLocationProvider.notifier).state = LocationUpdate(
          id: 'live',
          deliveryAssignmentId:
              d['assignmentId']?.toString() ??
              d['assignment_id']?.toString() ??
              'active',
          latitude: lat,
          longitude: lng,
          timestamp: DateTime.now(),
        );
      },
    );

    if (!mounted) return; // widget may have been disposed before WS connected
    final mapState = await ref.read(liveDeliveryMapProvider.future);
    final deliveryAssignmentId = mapState.deliveryAssignmentId;
    if (deliveryAssignmentId != null && deliveryAssignmentId.isNotEmpty) {
      WebSocketService.instance.subscribeToDelivery(deliveryAssignmentId);
    } else {
      debugPrint(
        'DeliveryMap: missing deliveryAssignmentId; live location subscription skipped',
      );
    }
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    WebSocketService.instance.disconnectLocation();
    super.dispose();
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
        if (state.status != LiveMapStatus.active) return _loadingView(colors);
        final riderPoint = locationUpdate != null
            ? LatLng(locationUpdate.latitude, locationUpdate.longitude)
            : state.shopPoint;
        return _mapView(state, riderPoint, brightness, colors);
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
    LatLng riderPoint,
    Brightness brightness,
    AppColorSet colors,
  ) {
    final eta = state.etaMinutes;

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
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: riderPoint,
                  initialZoom: 13.5,
                  onMapReady: () {
                    _isMapReady = true;
                    final latest = ref.read(liveRiderLocationProvider);
                    if (latest != null) {
                      _moveCameraTo(LatLng(latest.latitude, latest.longitude));
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
                      MapHelpers.riderMarker(riderPoint),
                    ],
                  ),
                ],
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
                        'Live Tracking',
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

              // ETA badge — top right
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
