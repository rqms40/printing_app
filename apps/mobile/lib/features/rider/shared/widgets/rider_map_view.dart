import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/off_route.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_vehicle_marker.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

/// Rider delivery map backed only by the persisted server dispatch leg.
class RiderMapView extends ConsumerStatefulWidget {
  const RiderMapView({
    super.key,
    required this.assignmentId,
    this.isPickupActive = false,
    required this.destination,
    required this.planStop,
    this.planStops = const [],
    this.supplierPin,
    required this.trackLocation,
    this.interactive = true,
    this.showLiveBadge = true,
    this.showRoute = true,
    this.borderRadius,
    this.planOrigin,
    this.overlayTopInset = 0,
    this.overlayBottomInset = 0,
  });

  final String assignmentId;
  final bool isPickupActive;
  final LatLng? destination;
  final RiderDispatchPlanStop? planStop;
  final List<RiderDispatchPlanStop> planStops;
  final LatLng? supplierPin;
  final bool trackLocation;
  final bool interactive;
  final bool showLiveBadge;
  final bool showRoute;
  final LatLng? planOrigin;
  final BorderRadius? borderRadius;

  /// Extra space reserved above/below the floating overlays so hosts can keep
  /// them clear of their own chrome (header row, customer sheet).
  final double overlayTopInset;
  final double overlayBottomInset;

  @override
  ConsumerState<RiderMapView> createState() => _RiderMapViewState();
}

class _RiderMapViewState extends ConsumerState<RiderMapView>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  bool _followCamera = false;
  int _offRouteFixes = 0;
  bool _offRouteDismissed = false;
  bool _replanInFlight = false;
  GeoJsonLineString? _uiRoute;
  bool _fetchingUiRoute = false;
  late final AnimationController _pulseController;

  LatLng get _shop =>
      widget.supplierPin ?? widget.planOrigin ?? MapHelpers.shopPoint;

  /// Prefer the order destination pin (matches Delivery Info address text)
  /// over plan-stop coordinates, which can be stale after address fixes.
  LatLng get _destination =>
      widget.destination ??
      widget.planStop?.destination ??
      MapHelpers.davaoCenter;

  List<RiderDispatchPlanStop> get _legs {
    final all = widget.planStops.isNotEmpty
        ? widget.planStops
        : [if (widget.planStop != null) widget.planStop!];
    if (widget.planStop != null) {
      return all
          .where((leg) => leg.sequence == widget.planStop!.sequence)
          .toList();
    }
    return all;
  }

  List<LatLng> get _routePoints {
    if (!widget.showRoute) return const [];
    if (_uiRoute != null) return _uiRoute!.points;
    return _legs.firstOrNull?.geometry?.points ?? const [];
  }

  bool get _routeDegraded => _routePoints.isEmpty;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void didUpdateWidget(covariant RiderMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.planStop?.sequence != widget.planStop?.sequence ||
        oldWidget.assignmentId != widget.assignmentId) {
      _uiRoute = null;
    } else if (_legs.firstOrNull?.geometry != null) {
      _uiRoute = null;
    }
    _fitBounds();
  }

  void _fitBounds() {
    final riderPoint = ref.read(riderLocationTrackerProvider(_trackerArgs)).point;
    final bounds = LatLngBounds.fromPoints([
      _shop,
      _destination,
      if (riderPoint != null) riderPoint,
      ..._routePoints,
      for (final leg in _legs)
        if (leg.geometry != null) ...leg.geometry!.points,
    ]);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      // Keep the route inside the band not covered by host chrome (header,
      // customer sheet); fall back to plain padding when the map is too small.
      final size = _mapController.camera.nonRotatedSize;
      var padding = EdgeInsets.fromLTRB(
        48,
        widget.overlayTopInset + 48,
        48,
        widget.overlayBottomInset + 48,
      );
      if (padding.vertical + 80 > size.height ||
          padding.horizontal + 80 > size.width) {
        padding = const EdgeInsets.all(48);
      }
      try {
        _mapController.fitCamera(
          CameraFit.bounds(bounds: bounds, padding: padding),
        );
      } catch (_) {}
    });
  }

  Future<void> _fetchUIRoute(LatLng from, LatLng to) async {
    if (_fetchingUiRoute) return;
    _fetchingUiRoute = true;
    try {
      final res = await ApiClient.instance.dio.get('/riders/route', queryParameters: {
        'fromLat': from.latitude,
        'fromLng': from.longitude,
        'toLat': to.latitude,
        'toLng': to.longitude,
      });
      if (res.data != null && res.data['geometry'] != null && mounted) {
        setState(() {
          _uiRoute = GeoJsonLineString.tryParse(res.data['geometry']);
        });
        if (_uiRoute != null) _fitBounds();
      }
    } catch (_) {
    } finally {
      _fetchingUiRoute = false;
    }
  }

  RiderLocationTrackerArgs get _trackerArgs => RiderLocationTrackerArgs(
    assignmentId: widget.assignmentId,
    enabled: widget.trackLocation,
  );

  Future<void> _refreshGpsLocation() async {
    if (widget.trackLocation) {
      await ref
          .read(riderLocationTrackerProvider(_trackerArgs).notifier)
          .refreshNow();
    }
    _fitBounds();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(riderLocationTrackerProvider(_trackerArgs), (previous, next) {
      final point = next.point;
      if (point == null || point == previous?.point) return;
      if (_followCamera) {
        _mapController.move(point, _mapController.camera.zoom);
      }
      if (_routeDegraded && _uiRoute == null && widget.isPickupActive) {
        _fetchUIRoute(point, _shop);
      }
      final leg = _routePoints;
      if (widget.trackLocation && leg.length >= 2) {
        final off = isOffRoute(point, leg);
        final fixes = off ? _offRouteFixes + 1 : 0;
        if (fixes != _offRouteFixes) {
          setState(() {
            _offRouteFixes = fixes;
            if (!off) _offRouteDismissed = false;
          });
        }
      }
    });
    final brightness = Theme.of(context).brightness;
    final radius = widget.borderRadius ?? BorderRadius.zero;

    final tracker = ref.watch(riderLocationTrackerProvider(_trackerArgs));
    final riderPoint = tracker.point;

    final markers = <Marker>[
      MapHelpers.shopMarker(point: _shop),
      MapHelpers.destinationMarker(point: _destination),
    ];

    return ClipRRect(
      borderRadius: radius,
      child: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: _destination,
              initialZoom: 13,
              backgroundColor: brightness == Brightness.dark
                  ? const Color(0xFF111111)
                  : const Color(0xFFE8E8E8),
              interactionOptions: InteractionOptions(
                flags: widget.interactive
                    ? InteractiveFlag.all
                    : InteractiveFlag.none,
              ),
              onMapReady: _fitBounds,
              onPositionChanged: (camera, hasGesture) {
                if (hasGesture && _followCamera) {
                  setState(() => _followCamera = false);
                }
              },
            ),
            children: [
              MapHelpers.tileLayer(brightness),
              if (widget.showRoute)
                Builder(builder: (context) {
                  final activeLeg = _legs.firstOrNull;
                  // Only use the server's leg geometry if it matches the current phase (pickup vs dropoff)
                  final isLegPickup = activeLeg?.kind == RiderDispatchStopKind.pickup;
                  final useGeometry = activeLeg?.geometry?.points != null &&
                      (widget.isPickupActive ? isLegPickup : !isLegPickup);
                  final geometryPoints = useGeometry ? activeLeg!.geometry!.points : null;
                  
                  final linePoints = <LatLng>[];
                  if (riderPoint != null) {
                    linePoints.add(riderPoint);
                  }
                  if (geometryPoints != null && geometryPoints.isNotEmpty) {
                    linePoints.addAll(geometryPoints);
                  } else if (riderPoint != null) {
                    // Fallback straight line if no routing data is available for the active phase.
                    linePoints.add(widget.isPickupActive ? _shop : _destination);
                  }
                  if (linePoints.length >= 2) {
                    return MapHelpers.persistedRouteLeg(
                      key: const Key('active-route-leg'),
                      points: linePoints,
                      isCompleted: false,
                      isCurrent: true,
                    );
                  }
                  return const SizedBox.shrink();
                }),
              MarkerLayer(markers: markers),
              if (riderPoint != null)
                AnimatedVehiclePosition(
                  point: riderPoint,
                  builder: (context, animated) => Stack(
                    children: [
                      if (tracker.accuracyMeters != null)
                        riderAccuracyCircle(
                          point: animated,
                          accuracyMeters: tracker.accuracyMeters!,
                        ),
                      MarkerLayer(
                        markers: [
                          riderVehicleMarker(
                            point: animated,
                            headingDegrees: tracker.headingDegrees,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              MapHelpers.attribution(includeRouting: _routePoints.isNotEmpty),
            ],
          ),
          if (widget.showLiveBadge && widget.trackLocation && !_offRouteVisible)
            Positioned(
              top: _overlayTop(context),
              left: AppSpacing.md,
              child: _GpsBadge(
                pulseController: _pulseController,
                state: tracker,
              ),
            ),
          if (widget.showRoute)
            Positioned(
              left: AppSpacing.md,
              right: AppSpacing.md,
              bottom: widget.overlayBottomInset + AppSpacing.sm + AppSpacing.xs,
              child: IgnorePointer(
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xE6111111),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _routeDegraded
                              ? Icons.info_outline_rounded
                              : Icons.route_rounded,
                          size: 13,
                          color: _routeDegraded
                              ? Colors.orangeAccent
                              : kRouteColor,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _routeDegraded
                              ? 'Route line unavailable'
                              : '${(widget.planStop!.legDistanceMeters / 1000).toStringAsFixed(1)} km to this stop',
                          style: AppTypography.caption.copyWith(
                            color: _routeDegraded
                                ? Colors.orangeAccent
                                : Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            key: const Key('rider-map-location-control'),
            top: _overlayTop(context),
            right: AppSpacing.md,
            child: Column(
              children: [
                _MapControlButton(
                  label: widget.trackLocation
                      ? 'Refresh GPS location'
                      : 'Recenter delivery map',
                  icon: Icons.my_location_rounded,
                  onTap: () => unawaited(_refreshGpsLocation()),
                ),
                if (widget.trackLocation) ...[
                  const SizedBox(height: AppSpacing.sm + 4),
                  _MapControlButton(
                    key: const Key('camera-follow-toggle'),
                    label: _followCamera
                        ? 'Stop following my position'
                        : 'Follow my position',
                    icon: _followCamera
                        ? Icons.navigation_rounded
                        : Icons.navigation_outlined,
                    onTap: () => setState(() => _followCamera = !_followCamera),
                  ),
                ],
              ],
            ),
          ),
          if (_offRouteVisible)
            Positioned(
              key: const Key('off-route-banner'),
              top: _overlayTop(context),
              left: AppSpacing.md,
              // Stay clear of the map control column on the right.
              right: AppSpacing.md + 52,
              child: Material(
                color: const Color(0xF23D2E00),
                borderRadius: AppRadius.borderMd,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.fork_right_rounded,
                        color: Color(0xFFFFDE58),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Off route — request a new plan?',
                          style: AppTypography.caption.copyWith(
                            color: const Color(0xFFFFF3C4),
                            fontSize: 12,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: _replanInFlight
                            ? null
                            : () => unawaited(_requestReplan()),
                        child: Text(
                          _replanInFlight ? 'Requesting…' : 'Request replan',
                        ),
                      ),
                      IconButton(
                        iconSize: 16,
                        color: const Color(0xFFFFF3C4),
                        onPressed: () =>
                            setState(() => _offRouteDismissed = true),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  bool get _offRouteVisible =>
      widget.trackLocation && _offRouteFixes >= 3 && !_offRouteDismissed;

  double _overlayTop(BuildContext context) =>
      MediaQuery.paddingOf(context).top +
      widget.overlayTopInset +
      AppSpacing.md;

  Future<void> _requestReplan() async {
    setState(() => _replanInFlight = true);
    final error = await ref.read(deliveriesProvider.notifier).requestReplan();
    if (!mounted) return;
    setState(() {
      _replanInFlight = false;
      if (error == null) {
        _offRouteFixes = 0;
        _offRouteDismissed = false;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error ?? 'Route updated with a new plan')),
    );
  }
}

class _GpsBadge extends StatelessWidget {
  const _GpsBadge({required this.pulseController, required this.state});

  final AnimationController pulseController;
  final RiderLocationTrackerState state;

  bool get _isHealthy =>
      state.status == RiderGpsStatus.live ||
      state.status == RiderGpsStatus.uploading;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      constraints: const BoxConstraints(maxWidth: 250),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: colors.surface.withValues(alpha: 0.94),
        borderRadius: AppRadius.borderFull,
        border: Border.all(color: colors.outline.withValues(alpha: 0.6)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x18000000),
            blurRadius: 12,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          FadeTransition(
            opacity: Tween(begin: 0.35, end: 1.0).animate(
              CurvedAnimation(parent: pulseController, curve: Curves.easeInOut),
            ),
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: _isHealthy ? colors.brand : Colors.orangeAccent,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              state.message,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: colors.onBackground,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MapControlButton extends StatelessWidget {
  const _MapControlButton({
    super.key,
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Semantics(
      button: true,
      focusable: true,
      label: label,
      onTap: onTap,
      child: ExcludeSemantics(
        child: Material(
          color: colors.surface.withValues(alpha: 0.94),
          shape: const CircleBorder(),
          elevation: 2,
          child: InkWell(
            customBorder: const CircleBorder(),
            onTap: onTap,
            child: SizedBox(
              width: 44,
              height: 44,
              child: Icon(icon, size: 22, color: colors.onBackground),
            ),
          ),
        ),
      ),
    );
  }
}
