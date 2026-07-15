import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_summary_chip.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_vehicle_marker.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Rider home cockpit map. The server's persisted plan is the only source of
/// dispatch ordering and geometry; this widget never calls a routing service.
class RiderRouteMapTile extends ConsumerStatefulWidget {
  const RiderRouteMapTile({
    super.key,
    required this.stops,
    required this.activeStop,
    this.planOrigin,
    required this.onTap,
  });

  final List<RiderAssignmentView> stops;
  final RiderAssignmentView? activeStop;
  final LatLng? planOrigin;
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
    final points = <LatLng>[widget.planOrigin ?? MapHelpers.shopPoint];
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
                      MapHelpers.shopMarker(point: widget.planOrigin ?? MapHelpers.shopPoint),
                      for (final stop in _planned)
                        Marker(
                          point: stop.planStop!.destination,
                          width: 34,
                          height: 46,
                          alignment: Alignment.topCenter,
                          child: _numberBadge(stop.planSequence!, colors),
                        ),
                      if (livePoint != null)
                        riderVehicleMarker(
                          point: livePoint,
                          headingDegrees: gps?.headingDegrees,
                        ),
                    ],
                  ),
                  MapHelpers.attribution(includeRouting: true),
                ],
              ),
              Positioned(
                top: 14,
                left: 14,
                child: RiderRouteSummaryChip(
                  key: const Key('route-summary'),
                  stops: _planned,
                ),
              ),
              Positioned(
                top: 14,
                right: 14,
                child: Container(
                  key: const Key('route-open-pill'),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xE6111111),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: kRouteColor, width: 1),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        widget.activeStop != null ? 'Open delivery' : 'View route',
                        style: AppTypography.caption.copyWith(
                          color: Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const Icon(
                        Icons.chevron_right_rounded,
                        color: Colors.white,
                        size: 14,
                      ),
                    ],
                  ),
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

}
