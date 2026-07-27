import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_timeline.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_summary_chip.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/shared/maps/grid_map_view.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Expanded rider route cockpit backed only by the persisted server plan.
class RiderRouteMapPanel extends ConsumerStatefulWidget {
  const RiderRouteMapPanel({
    super.key,
    required this.stops,
    required this.activeStop,
    this.planOrigin,
  });

  final List<RiderAssignmentView> stops;
  final RiderAssignmentView? activeStop;
  final LatLng? planOrigin;

  @override
  ConsumerState<RiderRouteMapPanel> createState() => _RiderRouteMapPanelState();
}

class _RiderRouteMapPanelState extends ConsumerState<RiderRouteMapPanel> {
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

  int? get _planVersion => _planned.firstOrNull?.planVersion;

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitBounds(_framePoints, padding: 40);
    });
  }

  @override
  void initState() {
    super.initState();
    _fitCamera();
  }

  @override
  void didUpdateWidget(covariant RiderRouteMapPanel oldWidget) {
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
    final completedCount = _planned
        .where(
          (stop) => stop.planStop?.status == RiderDispatchStopStatus.completed,
        )
        .length;
    final currentSequence = active?.planSequence ?? 0;
    final routeCaption = _hasMalformedGeometry
        ? 'Route geometry degraded'
        : _planVersion == null
        ? 'No persisted dispatch plan'
        : 'Persisted route · Plan v$_planVersion';
    final caption = active?.shouldTrackLocation == true && gps != null
        ? '$routeCaption · ${gps.message}'
        : routeCaption;

    return SizedBox.expand(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ColoredBox(
                color: RiderTheme.surface,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    GridMapView(
                      controller: _mapController,
                      initialCamera: MapHelpers.camera(
                        _framePoints.last,
                        zoom: 13,
                      ),
                      interactive: true,
                      markers: [
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
                      ],
                      polylines: [
                        for (var i = 0; i < _planned.length; i++)
                          if (_planned[i].planStop?.geometry case final geometry?)
                            ...MapHelpers.persistedRouteLeg(
                              id: 'route-leg-$i',
                              points: geometry.points,
                              isCompleted: _planned[i].planStop!.status ==
                                  RiderDispatchStopStatus.completed,
                              isCurrent: _planned[i].isCurrentPlanStop,
                            ),
                      ],
                    ),
                    MapHelpers.attribution(includeRouting: true),
                  ],
                ),
              ),
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
              top: 12,
              right: 8,
              bottom: 36,
              child: RiderStopTimeline(
                totalStops: _planned.length.clamp(1, 5),
                completedCount: completedCount.clamp(0, 5),
                currentStopIndex: currentSequence,
                stopStatuses: [
                  for (final stop in _planned) stop.planStop!.status,
                ],
              ),
            ),
            Positioned(
              left: 16,
              right: 56,
              bottom: 10,
              child: Text(
                caption,
                style: AppTypography.caption.copyWith(
                  color: _hasMalformedGeometry
                      ? Colors.orangeAccent
                      : RiderTheme.textMuted,
                  fontStyle: FontStyle.italic,
                  fontSize: 11,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

}
