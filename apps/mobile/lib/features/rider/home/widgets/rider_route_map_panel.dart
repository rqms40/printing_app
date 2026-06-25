import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/home/widgets/rider_stop_timeline.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';
import 'package:intl/intl.dart';

/// Map cockpit matching rider-UI.png with live route + stop timeline.
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
  List<LatLng> _routePoints = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  @override
  void didUpdateWidget(covariant RiderRouteMapPanel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_routeKey(oldWidget.activeStop) != _routeKey(widget.activeStop)) {
      unawaited(_loadRoute());
    } else {
      _fitCamera();
    }
  }

  String? _routeKey(RiderAssignmentView? stop) {
    if (stop == null) return null;
    final point = stop.order.destination?.latLng;
    return '${stop.id}:${point?.latitude}:${point?.longitude}';
  }

  Future<void> _loadRoute() async {
    if (!_hasActiveRoute) {
      if (!mounted) return;
      setState(() {
        _routePoints = const [];
        _loading = false;
      });
      _fitCamera();
      return;
    }

    final dest = _destination;
    final points = await RoutingService.getRoute(MapHelpers.shopPoint, dest);
    if (!mounted) return;
    setState(() {
      _routePoints = points;
      _loading = false;
    });
    _fitCamera();
  }

  LatLng get _destination {
    final active = widget.activeStop;
    final latLng = active?.order.destination?.latLng;
    if (latLng != null) return latLng;
    if (widget.stops.isNotEmpty) {
      return widget.stops.first.order.destination?.latLng ??
          MapHelpers.davaoCenter;
    }
    return MapHelpers.davaoCenter;
  }

  bool get _hasActiveRoute => widget.activeStop != null;

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints([
            MapHelpers.shopPoint,
            _destination,
            if (_hasActiveRoute) ..._routePoints,
          ]),
          padding: const EdgeInsets.all(40),
        ),
      );
    });
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  int get _currentStopIndex {
    if (widget.activeStop == null) return 1;
    final idx = widget.stops.indexWhere((s) => s.id == widget.activeStop!.id);
    return idx < 0 ? 1 : idx + 1;
  }

  int get _completedCount => (_currentStopIndex - 1).clamp(0, 5).toInt();

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final timeLabel = DateFormat('h:mm a').format(now);
    final dayLabel = DateFormat('EEEE').format(now);
    final active = widget.activeStop;
    final trackGps = active?.shouldTrackLocation ?? false;

    final riderPoint = active != null && trackGps
        ? ref.watch(
            riderLocationTrackerProvider(
              RiderLocationTrackerArgs(assignmentId: active.id, enabled: true),
            ),
          )
        : (active != null && _routePoints.isNotEmpty
              ? _routePoints[(_routePoints.length * 0.35).round()]
              : null);

    final stopMarkers = <Marker>[];
    for (var i = 0; i < widget.stops.length && i < 5; i++) {
      final stop = widget.stops[i];
      final point = stop.order.destination?.latLng ?? _destination;
      stopMarkers.add(_numberedStopMarker(point, i + 1));
    }

    return Expanded(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: ColoredBox(
                color: RiderTheme.surface,
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          color: RiderTheme.yellow,
                          strokeWidth: 2,
                        ),
                      )
                    : FlutterMap(
                        mapController: _mapController,
                        options: MapOptions(
                          initialCenter: _destination,
                          initialZoom: 13,
                          backgroundColor: RiderTheme.background,
                        ),
                        children: [
                          MapHelpers.tileLayer(Brightness.dark),
                          if (_hasActiveRoute && _routePoints.isNotEmpty)
                            MapHelpers.routePolyline(_routePoints),
                          MarkerLayer(
                            markers: [
                              ...stopMarkers,
                              if (riderPoint != null)
                                _riderCarMarker(riderPoint),
                            ],
                          ),
                        ],
                      ),
              ),
            ),

            // Time block (top-left)
            Positioned(
              top: 14,
              left: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    timeLabel,
                    style: AppTypography.h1.copyWith(
                      color: RiderTheme.textPrimary,
                      fontSize: 30,
                      fontWeight: FontWeight.w800,
                      height: 1,
                    ),
                  ),
                  Text(
                    dayLabel,
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

            // Timeline (right)
            Positioned(
              top: 12,
              right: 8,
              bottom: 36,
              child: RiderStopTimeline(
                totalStops: widget.stops.length.clamp(1, 5).toInt(),
                completedCount: _completedCount,
                currentStopIndex: _currentStopIndex,
              ),
            ),

            // Optimizing caption
            Positioned(
              left: 16,
              right: 56,
              bottom: 10,
              child: Text(
                '*Optimizing your delivery sequence...',
                style: AppTypography.caption.copyWith(
                  color: RiderTheme.textMuted,
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

  Marker _numberedStopMarker(LatLng point, int number) {
    return Marker(
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
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'STOP',
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w900,
                      fontSize: 4.5,
                      height: 1,
                    ),
                  ),
                  Text(
                    '$number',
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                      fontSize: 10,
                      height: 1,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            width: 2.4,
            height: 14,
            decoration: BoxDecoration(
              color: kRouteColor,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ),
    );
  }

  Marker _riderCarMarker(LatLng point) {
    return Marker(
      point: point,
      width: 42,
      height: 42,
      child: Transform.rotate(
        angle: -0.65,
        child: const Icon(
          Icons.local_taxi_rounded,
          color: kRouteColor,
          size: 34,
        ),
      ),
    );
  }
}
