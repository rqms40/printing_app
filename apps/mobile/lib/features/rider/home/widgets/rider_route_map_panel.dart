import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_timeline.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Expanded rider route cockpit backed only by the persisted server plan.
class RiderRouteMapPanel extends ConsumerStatefulWidget {
  const RiderRouteMapPanel({
    super.key,
    required this.stops,
    required this.activeStop,
  });

  final List<RiderAssignmentView> stops;
  final RiderAssignmentView? activeStop;

  @override
  ConsumerState<RiderRouteMapPanel> createState() => _RiderRouteMapPanelState();
}

class _RiderRouteMapPanelState extends ConsumerState<RiderRouteMapPanel> {
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
    final now = DateTime.now();
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
                          _numberedStopMarker(
                            stop.planStop!.destination,
                            stop.planSequence!,
                          ),
                        if (livePoint != null) _riderCarMarker(livePoint),
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    DateFormat('h:mm a').format(now),
                    style: AppTypography.h1.copyWith(
                      color: RiderTheme.textPrimary,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      height: 1,
                    ),
                  ),
                  Text(
                    DateFormat('EEEE').format(now),
                    style: AppTypography.body.copyWith(
                      color: RiderTheme.textPrimary,
                      fontSize: 21,
                      fontWeight: FontWeight.w700,
                      height: 1.05,
                    ),
                  ),
                ],
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

  Marker _riderCarMarker(LatLng point) => Marker(
    point: point,
    width: 42,
    height: 42,
    child: const Icon(Icons.local_taxi_rounded, color: kRouteColor, size: 34),
  );
}
