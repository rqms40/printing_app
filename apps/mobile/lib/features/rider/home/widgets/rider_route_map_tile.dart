import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_summary_chip.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/shared/maps/grid_map_view.dart';
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
  final _mapController = GridMapController();

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

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitBounds(_framePoints, padding: 56);
    });
  }

  @override
  void initState() {
    super.initState();
    _fitCamera();
  }

  @override
  void didUpdateWidget(covariant RiderRouteMapTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    _fitCamera();
  }

  @override
  void dispose() {
    _mapController.unbind();
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
    final hasPlan = _planned.isNotEmpty;
    final gpsChip = _gpsChip(gps, active);

    final polylines = <GridMapPolyline>[];
    for (var i = 0; i < _planned.length; i++) {
      final geometry = _planned[i].planStop?.geometry;
      if (geometry == null) continue;
      polylines.addAll(
        MapHelpers.persistedRouteLeg(
          id: 'route-leg-$i',
          points: geometry.points,
          isCompleted: _planned[i].planStop!.status ==
              RiderDispatchStopStatus.completed,
          isCurrent: _planned[i].isCurrentPlanStop,
        ),
      );
    }

    final markers = <GridMapMarker>[
      MapHelpers.shopMarker(
        point: widget.planOrigin ?? MapHelpers.shopPoint,
      ),
      for (final stop in _planned)
        MapHelpers.stopMarker(
          sequence: stop.planSequence!,
          point: stop.planStop!.destination,
          isCurrent: stop.isCurrentPlanStop,
        ),
      if (livePoint != null)
        MapHelpers.riderMarker(
          livePoint,
          rotation: gps?.headingDegrees ?? 0,
        ),
    ];

    return GestureDetector(
      onTap: widget.onTap,
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: ColoredBox(
          color: colors.surfaceDim,
          child: Stack(
            fit: StackFit.expand,
            children: [
              GridMapView(
                controller: _mapController,
                initialCamera: MapHelpers.camera(
                  _framePoints.last,
                  zoom: 12.5,
                ),
                interactive: false,
                markers: markers,
                polylines: polylines,
              ),
              MapHelpers.attribution(includeRouting: true),
              if (!hasPlan)
                Positioned.fill(
                  child: IgnorePointer(
                    child: Center(
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 230),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 18,
                          vertical: 14,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xE6111111),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.08),
                          ),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(
                              Icons.route_rounded,
                              color: kRouteColor,
                              size: 22,
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'No route planned yet',
                              style: AppTypography.bodyBold.copyWith(
                                color: Colors.white,
                                fontSize: 13,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              widget.activeStop != null
                                  ? 'Tap to open your active delivery'
                                  : 'Stops appear here when dispatch assigns you',
                              textAlign: TextAlign.center,
                              style: AppTypography.caption.copyWith(
                                color: Colors.white.withValues(alpha: 0.65),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              Positioned(
                top: 10,
                left: 10,
                child: RiderRouteSummaryChip(stops: widget.stops),
              ),
              if (_hasMalformedGeometry)
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: _statusChip(
                    icon: Icons.info_outline_rounded,
                    label: 'Route detail degraded',
                    color: Colors.orangeAccent,
                  ),
                )
              else if (gpsChip != null)
                Positioned(
                  left: 10,
                  right: 10,
                  bottom: 10,
                  child: gpsChip,
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget? _gpsChip(
    RiderLocationTrackerState? gps,
    RiderAssignmentView? active,
  ) {
    if (gps == null || active == null || !active.shouldTrackLocation) {
      return null;
    }
    if (gps.status == RiderGpsStatus.live ||
        gps.status == RiderGpsStatus.uploading) {
      return null;
    }
    return _statusChip(
      icon: Icons.gps_off_rounded,
      label: gps.message,
      color: Colors.orangeAccent,
    );
  }

  Widget _statusChip({
    required IconData icon,
    required String label,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xE6111111),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 6),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
