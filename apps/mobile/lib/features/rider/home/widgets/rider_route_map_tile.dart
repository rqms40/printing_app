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
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Rider home cockpit map. The server's persisted plan is the only source of
/// dispatch ordering and geometry; this widget never calls a routing service.
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

  List<RiderAssignmentView> get _planned =>
      widget.stops.where((stop) => stop.planStop != null).toList()..sort(
        (left, right) => left.planSequence!.compareTo(right.planSequence!),
      );

  List<LatLng> get _framePoints {
    final points = <LatLng>[MapHelpers.shopPoint];
    for (final stop in _planned) {
      final geometry = stop.planStop?.geometry;
      if (geometry != null) points.addAll(geometry.points);
      points.add(stop.planStop!.destination);
    }
    if (points.length == 1) points.add(MapHelpers.davaoCenter);
    return points;
  }

  bool get _hasMalformedGeometry =>
      _planned.any((stop) => stop.planStop?.geometryMalformed ?? false);

  int? get _planVersion => _planned.firstOrNull?.planVersion;

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(_framePoints),
          padding: const EdgeInsets.all(48),
        ),
      );
    });
  }

  @override
  void didUpdateWidget(covariant RiderRouteMapTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    _fitCamera();
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final active = widget.activeStop;
    final gps = active != null
        ? ref.watch(
            riderLocationTrackerProvider(
              RiderLocationTrackerArgs(
                assignmentId: active.id,
                enabled: active.shouldTrackLocation,
              ),
            ),
          )
        : null;
    final livePoint = gps?.point;
    final routeCaption = _hasMalformedGeometry
        ? 'Route geometry degraded'
        : _planVersion == null
        ? 'No persisted dispatch plan'
        : 'Persisted route · Plan v$_planVersion';
    final caption = active?.shouldTrackLocation == true && gps != null
        ? '$routeCaption · ${gps.message}'
        : routeCaption;

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
                  initialCenter: _framePoints.last,
                  initialZoom: 12.5,
                  backgroundColor: colors.surfaceDim,
                  onMapReady: _fitCamera,
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
                  for (var i = 0; i < _planned.length; i++)
                    if (_planned[i].planStop?.geometry case final geometry?)
                      MapHelpers.persistedRouteLeg(
                        key: Key('route-leg-$i'),
                        points: geometry.points,
                        isCompleted:
                            _planned[i].planStop!.status ==
                            RiderDispatchStopStatus.completed,
                        isCurrent: _planned[i].isCurrentPlanStop,
                      ),
                  MarkerLayer(
                    markers: [
                      MapHelpers.shopMarker(),
                      for (final stop in _planned)
                        Marker(
                          point: stop.planStop!.destination,
                          width: 34,
                          height: 46,
                          alignment: Alignment.topCenter,
                          child: _numberBadge(stop.planSequence!, colors),
                        ),
                      if (livePoint != null) _carMarker(livePoint),
                    ],
                  ),
                  MapHelpers.attribution(includeRouting: true),
                ],
              ),
              Positioned(
                top: 14,
                left: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      DateFormat('h:mm a').format(DateTime.now()),
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
                      DateFormat('EEEE').format(DateTime.now()),
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
              Positioned(
                left: 16,
                right: 16,
                bottom: 10,
                child: Text(
                  caption,
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    color: _hasMalformedGeometry
                        ? Colors.orangeAccent
                        : Colors.white.withValues(alpha: 0.85),
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

  Widget _numberBadge(int number, AppColorSet colors) => Column(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          color: const Color(0xFF141414),
          shape: BoxShape.circle,
          border: Border.all(color: kRouteColor, width: 1.8),
        ),
        child: Center(
          child: Text(
            '$number',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ),
      ),
      Container(width: 2.6, height: 14, color: kRouteColor),
    ],
  );

  Marker _carMarker(LatLng point) => Marker(
    point: point,
    width: 44,
    height: 44,
    child: const Icon(
      Icons.local_taxi_rounded,
      color: kRouteColor,
      size: 34,
      shadows: [Shadow(color: Color(0xCC000000), blurRadius: 8)],
    ),
  );
}
