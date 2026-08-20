import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_timeline.dart';
import 'package:printing_app/features/rider/home/widgets/rider_route_summary_chip.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_vehicle_marker.dart';
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
  final _mapController = MapController();

  List<RiderAssignmentView> get _planned =>
      widget.stops.where((stop) => stop.legs.isNotEmpty).toList()..sort(
        (left, right) =>
            (left.planSequence ?? 0).compareTo(right.planSequence ?? 0),
      );

  bool get _hasSupplierPin =>
      widget.stops.any((stop) => stop.supplierPin != null);

  List<LatLng> get _framePoints {
    final points = <LatLng>[];
    if (!_hasSupplierPin) {
      points.add(widget.planOrigin ?? MapHelpers.shopPoint);
    }
    for (final stop in widget.stops) {
      if (stop.supplierPin != null) points.add(stop.supplierPin!);
      if (stop.pinDestination != null) points.add(stop.pinDestination!);
      for (final leg in stop.legs) {
        if (leg.geometry != null) points.addAll(leg.geometry!.points);
      }
    }
    if (points.isEmpty) {
      points.add(widget.planOrigin ?? MapHelpers.shopPoint);
      points.add(MapHelpers.davaoCenter);
    } else if (points.length == 1) {
      points.add(MapHelpers.davaoCenter);
    }
    return points;
  }

  bool get _hasMalformedGeometry =>
      _planned.any((view) => view.legs.any((leg) => leg.geometryMalformed));

  int? get _planVersion => _planned.firstOrNull?.planVersion;

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(_framePoints),
          padding: const EdgeInsets.all(40),
        ),
      );
    });
  }

  @override
  void didUpdateWidget(covariant RiderRouteMapPanel oldWidget) {
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
                child: FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _framePoints.last,
                    initialZoom: 13,
                    backgroundColor: RiderTheme.background,
                    onMapReady: _fitCamera,
                  ),
                  children: [
                    MapHelpers.tileLayer(Brightness.dark),
                    for (final view in _planned)
                      for (final leg in view.legs)
                        if (leg.geometry case final geometry?)
                          MapHelpers.persistedRouteLeg(
                            key: Key(
                              'route-leg-${view.id}-${leg.kind.name}-${leg.sequence}',
                            ),
                            points: geometry.points,
                            isCompleted:
                                leg.status == RiderDispatchStopStatus.completed,
                            isCurrent:
                                view.planStop?.sequence == leg.sequence &&
                                view.isCurrentPlanStop,
                          ),
                    MarkerLayer(
                      markers: [
                        if (!_hasSupplierPin)
                          MapHelpers.shopMarker(
                            point: widget.planOrigin ?? MapHelpers.shopPoint,
                          ),
                        for (final stop in widget.stops)
                          if (stop.supplierPin != null)
                            MapHelpers.shopMarker(point: stop.supplierPin),
                        for (final stop in widget.stops)
                          if (stop.pinDestination != null)
                            _numberedStopMarker(
                              stop.pinDestination!,
                              stop.planSequence ?? 1,
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

  Marker _numberedStopMarker(LatLng point, int number) => Marker(
    point: point,
    width: 38,
    height: 58,
    alignment: Alignment.topCenter,
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 30,
          height: 30,
          decoration: BoxDecoration(
            color: RiderTheme.surface,
            shape: BoxShape.circle,
            border: Border.all(color: kRouteColor, width: 1.4),
            boxShadow: const [
              BoxShadow(
                color: Color(0x99000000),
                blurRadius: 8,
                offset: Offset(0, 2),
              ),
            ],
          ),
          child: Center(
            child: Text(
              '$number',
              style: const TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 10,
              ),
            ),
          ),
        ),
        Container(width: 2.4, height: 14, color: kRouteColor),
      ],
    ),
  );

}
