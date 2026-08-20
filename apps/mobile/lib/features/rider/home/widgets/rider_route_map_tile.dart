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
      _planned.any((stop) => stop.planStop?.geometryMalformed ?? false);

  void _fitCamera() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(_framePoints),
          // Extra top/right/bottom room keeps markers clear of the summary
          // chip, the stop rail, and the bottom status chips.
          padding: const EdgeInsets.fromLTRB(52, 60, 60, 64),
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
    final hasPlan = _planned.isNotEmpty;
    final hasPins = widget.stops.any(
      (stop) => stop.supplierPin != null || stop.pinDestination != null,
    );
    final gpsChip = _gpsChip(gps, active);

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
                  for (final view in _planned)
                    for (final leg in view.legs)
                      if (leg.geometry case final geometry?)
                        MapHelpers.persistedRouteLeg(
                          key: Key('route-leg-${view.id}-${leg.kind.name}-${leg.sequence}'),
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
                          Marker(
                            point: stop.pinDestination!,
                            width: 34,
                            height: 46,
                            alignment: Alignment.topCenter,
                            child: _numberBadge(
                              stop.legs
                                      .where(
                                        (leg) =>
                                            leg.kind ==
                                            RiderDispatchStopKind.dropoff,
                                      )
                                      .firstOrNull
                                      ?.sequence ??
                                  stop.planSequence ??
                                  1,
                              colors,
                            ),
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
              if (!hasPlan && !hasPins)
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
                                fontSize: 11,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              Positioned(
                top: 14,
                left: 14,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    RiderRouteSummaryChip(
                      key: const Key('route-summary'),
                      stops: _planned,
                    ),
                    if (_hasPendingStops) const SizedBox(height: 8),
                    Container(
                      key: const Key('route-open-pill'),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 7,
                      ),
                      decoration: BoxDecoration(
                        color: kRouteColor,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x66000000),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            widget.activeStop != null
                                ? 'Open delivery'
                                : 'View deliveries',
                            style: AppTypography.caption.copyWith(
                              color: Colors.black,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const Icon(
                            Icons.chevron_right_rounded,
                            color: Colors.black,
                            size: 15,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              Positioned(
                left: 14,
                right: 60,
                bottom: 12,
                child: IgnorePointer(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (_hasMalformedGeometry)
                        const _MapStatusChip(
                          icon: Icons.info_outline_rounded,
                          text: 'Route detail degraded',
                          tone: _ChipTone.warning,
                        ),
                      if (gpsChip != null) ...[
                        if (_hasMalformedGeometry) const SizedBox(height: 6),
                        gpsChip,
                      ],
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

  bool get _hasPendingStops => _planned.any(
    (stop) => stop.planStop!.status == RiderDispatchStopStatus.pending,
  );

  /// GPS status chip — only surfaces states the rider can act on or should
  /// know about; healthy tracking stays silent.
  _MapStatusChip? _gpsChip(
    RiderLocationTrackerState? gps,
    RiderAssignmentView? active,
  ) {
    if (gps == null || active?.shouldTrackLocation != true) return null;
    return switch (gps.status) {
      RiderGpsStatus.serviceDisabled ||
      RiderGpsStatus.permissionDenied ||
      RiderGpsStatus.permissionDeniedForever ||
      RiderGpsStatus.uploadFailed ||
      RiderGpsStatus.streamError => _MapStatusChip(
        icon: Icons.gps_off_rounded,
        text: gps.message,
        tone: _ChipTone.warning,
      ),
      RiderGpsStatus.locating ||
      RiderGpsStatus.requestingPermission => _MapStatusChip(
        icon: Icons.gps_not_fixed_rounded,
        text: gps.message,
        tone: _ChipTone.neutral,
      ),
      _ => null,
    };
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

enum _ChipTone { neutral, warning }

/// Compact status chip pinned to the map's lower-left corner.
class _MapStatusChip extends StatelessWidget {
  const _MapStatusChip({
    required this.icon,
    required this.text,
    required this.tone,
  });

  final IconData icon;
  final String text;
  final _ChipTone tone;

  @override
  Widget build(BuildContext context) {
    final fg = tone == _ChipTone.warning
        ? Colors.orangeAccent
        : Colors.white.withValues(alpha: 0.85);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: const Color(0xE6111111),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: fg),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: AppTypography.caption.copyWith(
                color: fg,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
