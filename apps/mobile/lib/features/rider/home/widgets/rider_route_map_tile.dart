import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Cockpit route map: dark tiles, numbered stop pins, a rider car, the route
/// polyline, and time/day + optimizing caption overlays. Fills its parent.
///
/// The map is rendered immediately (never hidden behind a loading spinner), and
/// the camera is fit to the stops/shop only — never the routing geometry — so a
/// far-away routing fallback can never blank out the view.
class RiderRouteMapTile extends ConsumerStatefulWidget {
  const RiderRouteMapTile({
    super.key,
    required this.stops,
    required this.activeStop,
    required this.onTap,
  });

  final List<RiderAssignmentView> stops;
  final RiderAssignmentView? activeStop;
  final VoidCallback onTap;

  @override
  ConsumerState<RiderRouteMapTile> createState() => _RiderRouteMapTileState();
}

class _RiderRouteMapTileState extends ConsumerState<RiderRouteMapTile> {
  final _mapController = MapController();
  List<LatLng> _routePoints = [];

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  LatLng get _destination {
    final latLng = widget.activeStop?.order.destination?.latLng;
    if (latLng != null) return latLng;
    if (widget.stops.isNotEmpty) {
      return widget.stops.first.order.destination?.latLng ??
          MapHelpers.davaoCenter;
    }
    return MapHelpers.davaoCenter;
  }

  /// Points used to frame the camera — shop + every stop with coordinates +
  /// the destination. Deliberately excludes the routing geometry so a stale or
  /// fallback route can't drag the camera off to another city.
  List<LatLng> get _framePoints {
    final pts = <LatLng>[MapHelpers.shopPoint, _destination];
    for (final s in widget.stops) {
      final p = s.order.destination?.latLng;
      if (p != null) pts.add(p);
    }
    return pts;
  }

  /// A synthetic rider position 40% of the way from the shop to the
  /// destination, so the car always sits on-screen near the route.
  LatLng get _carPoint {
    final dest = _destination;
    return LatLng(
      MapHelpers.shopPoint.latitude +
          (dest.latitude - MapHelpers.shopPoint.latitude) * 0.4,
      MapHelpers.shopPoint.longitude +
          (dest.longitude - MapHelpers.shopPoint.longitude) * 0.4,
    );
  }

  Future<void> _loadRoute() async {
    final points = await RoutingService.getRoute(
      MapHelpers.shopPoint,
      _destination,
    );
    if (!mounted) return;
    setState(() => _routePoints = points);
    _fitCamera();
  }

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final pts = _framePoints;
      if (pts.length < 2) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(pts),
          padding: const EdgeInsets.all(48),
        ),
      );
    });
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  /// Whether the loaded route is plausibly near our stops (guards against the
  /// far-away fallback route the routing service returns when offline).
  bool get _routeIsNearby {
    if (_routePoints.isEmpty) return false;
    final dest = _destination;
    final first = _routePoints.first;
    const distance = Distance();
    // Within ~80km of the destination → treat as a real local route.
    return distance(first, dest) < 80000;
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final now = DateTime.now();
    final timeLabel = DateFormat('h:mm a').format(now);
    final dayLabel = DateFormat('EEEE').format(now);

    // Live rider GPS for the active delivery (streamed from geolocator and
    // broadcast to the backend). Falls back to a synthetic point when there is
    // no active, trackable delivery.
    final active = widget.activeStop;
    final livePoint = active != null
        ? ref.watch(
            riderLocationTrackerProvider(
              RiderLocationTrackerArgs(
                assignmentId: active.id,
                enabled: active.shouldTrackLocation,
              ),
            ),
          )
        : null;
    final carPoint = livePoint ?? _carPoint;

    return GestureDetector(
      onTap: widget.onTap,
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: ColoredBox(
          color: colors.surfaceDim,
          child: Stack(
            fit: StackFit.expand,
            children: [
              FlutterMap(
                mapController: _mapController,
                options: MapOptions(
                  initialCenter: _destination,
                  initialZoom: 12.5,
                  backgroundColor: colors.surfaceDim,
                  onTap: (_, _) => widget.onTap(),
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.none,
                  ),
                ),
                children: [
                  MapHelpers.tileLayer(
                    brightness,
                    cachingProvider: const DisabledMapCachingProvider(),
                  ),
                  if (_routeIsNearby)
                    PolylineLayer(
                      polylines: [
                        Polyline(
                          points: _routePoints,
                          color: Colors.black.withValues(alpha: 0.6),
                          strokeWidth: 6,
                        ),
                        Polyline(
                          points: _routePoints,
                          color: colors.brand.withValues(alpha: 0.95),
                          strokeWidth: 3.2,
                        ),
                      ],
                    ),
                  MarkerLayer(
                    markers: [..._stopMarkers(colors), _carMarker(colors, carPoint)],
                  ),
                ],
              ),

              // Time + day — top-left, plain on the dark map.
              Positioned(
                top: 14,
                left: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      timeLabel,
                      style: AppTypography.h1.copyWith(
                        color: Colors.white,
                        fontSize: 30,
                        fontWeight: FontWeight.w800,
                        height: 1,
                        shadows: const [
                          Shadow(color: Color(0xCC000000), blurRadius: 10),
                        ],
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      dayLabel,
                      style: AppTypography.h2.copyWith(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w700,
                        height: 1.05,
                        shadows: const [
                          Shadow(color: Color(0xCC000000), blurRadius: 10),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Optimizing caption — bottom-center.
              Positioned(
                left: 16,
                right: 16,
                bottom: 10,
                child: Text(
                  '*Optimizing your delivery sequence...',
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontStyle: FontStyle.italic,
                    fontSize: 11,
                    shadows: const [
                      Shadow(color: Color(0xCC000000), blurRadius: 8),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  List<Marker> _stopMarkers(AppColorSet colors) {
    final markers = <Marker>[];
    var n = 1;
    for (final stop in widget.stops) {
      final point = stop.order.destination?.latLng;
      if (point == null) {
        n++;
        continue;
      }
      markers.add(
        Marker(
          point: point,
          width: 34,
          height: 46,
          alignment: Alignment.topCenter,
          child: _numberBadge(n, colors),
        ),
      );
      n++;
    }
    return markers;
  }

  Widget _numberBadge(int number, AppColorSet colors) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: const Color(0xFF141414),
            shape: BoxShape.circle,
            border: Border.all(color: colors.brand, width: 1.8),
            boxShadow: const [
              BoxShadow(color: Color(0x99000000), blurRadius: 6, offset: Offset(0, 2)),
            ],
          ),
          child: Center(
            child: Text(
              '$number',
              style: TextStyle(
                color: colors.brand,
                fontWeight: FontWeight.w800,
                fontSize: 12,
                height: 1,
              ),
            ),
          ),
        ),
        Container(
          width: 2.6,
          height: 14,
          decoration: BoxDecoration(
            color: colors.brand,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ],
    );
  }

  Marker _carMarker(AppColorSet colors, LatLng point) {
    return Marker(
      point: point,
      width: 44,
      height: 44,
      child: Transform.rotate(
        angle: -0.6,
        child: Icon(
          Icons.local_taxi_rounded,
          color: colors.brand,
          size: 34,
          shadows: const [
            Shadow(color: Color(0xCC000000), blurRadius: 8),
          ],
        ),
      ),
    );
  }
}
