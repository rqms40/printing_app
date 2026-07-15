import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_vehicle_marker.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Rider delivery map backed only by the persisted server dispatch leg.
class RiderMapView extends ConsumerStatefulWidget {
  const RiderMapView({
    super.key,
    required this.assignmentId,
    required this.destination,
    required this.planStop,
    required this.trackLocation,
    this.interactive = true,
    this.showLiveBadge = true,
    this.showRoute = true,
    this.borderRadius,
    this.planOrigin,
  });

  final String assignmentId;
  final LatLng? destination;
  final RiderDispatchPlanStop? planStop;
  final bool trackLocation;
  final bool interactive;
  final bool showLiveBadge;
  final bool showRoute;
  final LatLng? planOrigin;
  final BorderRadius? borderRadius;

  @override
  ConsumerState<RiderMapView> createState() => _RiderMapViewState();
}

class _RiderMapViewState extends ConsumerState<RiderMapView>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  late final AnimationController _pulseController;

  LatLng get _shop => widget.planOrigin ?? MapHelpers.shopPoint;

  LatLng get _destination =>
      widget.planStop?.destination ??
      widget.destination ??
      MapHelpers.davaoCenter;

  List<LatLng> get _routePoints => widget.showRoute
      ? widget.planStop?.geometry?.points ?? const []
      : const [];

  bool get _routeDegraded =>
      widget.showRoute &&
      (widget.planStop == null ||
          widget.planStop!.geometryMalformed ||
          widget.planStop!.geometry == null);

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
    _fitBounds();
  }

  void _fitBounds() {
    final bounds = LatLngBounds.fromPoints([
      _shop,
      _destination,
      ..._routePoints,
    ]);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(bounds: bounds, padding: const EdgeInsets.all(48)),
      );
    });
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
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
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
              interactionOptions: InteractionOptions(
                flags: widget.interactive
                    ? InteractiveFlag.all
                    : InteractiveFlag.none,
              ),
              onMapReady: _fitBounds,
            ),
            children: [
              MapHelpers.tileLayer(brightness),
              if (_routePoints.isNotEmpty)
                MapHelpers.persistedRouteLeg(
                  key: const Key('active-route-leg'),
                  points: _routePoints,
                  isCompleted: false,
                  isCurrent: true,
                ),
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
          if (widget.showLiveBadge && widget.trackLocation)
            Positioned(
              top: AppSpacing.md,
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
              bottom: AppSpacing.sm,
              child: IgnorePointer(
                child: Text(
                  _routeDegraded
                      ? 'Route geometry unavailable'
                      : 'Persisted route · '
                            '${(widget.planStop!.legDistanceMeters / 1000).toStringAsFixed(1)} km',
                  textAlign: TextAlign.center,
                  style: AppTypography.caption.copyWith(
                    color: _routeDegraded
                        ? Colors.orangeAccent
                        : colors.onSurface,
                    fontWeight: FontWeight.w600,
                    shadows: const [
                      Shadow(color: Color(0xCC000000), blurRadius: 8),
                    ],
                  ),
                ),
              ),
            ),
          Positioned(
            key: const Key('rider-map-location-control'),
            top: MediaQuery.paddingOf(context).top + AppSpacing.xxxl,
            right: AppSpacing.md,
            child: _MapControlButton(
              label: widget.trackLocation
                  ? 'Refresh GPS location'
                  : 'Recenter delivery map',
              icon: Icons.my_location_rounded,
              onTap: () => unawaited(_refreshGpsLocation()),
            ),
          ),
        ],
      ),
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
