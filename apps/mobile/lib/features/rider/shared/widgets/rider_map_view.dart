import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/off_route.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/shared/maps/grid_map_view.dart';
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
    this.overlayTopInset = 0,
    this.overlayBottomInset = 0,
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

  /// Extra space reserved above/below the floating overlays so hosts can keep
  /// them clear of their own chrome (header row, customer sheet).
  final double overlayTopInset;
  final double overlayBottomInset;

  @override
  ConsumerState<RiderMapView> createState() => _RiderMapViewState();
}

class _RiderMapViewState extends ConsumerState<RiderMapView>
    with SingleTickerProviderStateMixin {
  final _mapController = GridMapController();
  bool _followCamera = false;
  int _offRouteFixes = 0;
  bool _offRouteDismissed = false;
  bool _replanInFlight = false;
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _fitBounds());
  }

  @override
  void didUpdateWidget(covariant RiderMapView oldWidget) {
    super.didUpdateWidget(oldWidget);
    _fitBounds();
  }

  void _fitBounds() {
    final points = <LatLng>[_shop, _destination, ..._routePoints];
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitBounds(points, padding: 48);
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
    _mapController.unbind();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    ref.listen(riderLocationTrackerProvider(_trackerArgs), (previous, next) {
      final point = next.point;
      if (point == null || point == previous?.point) return;
      if (_followCamera) {
        _mapController.moveTo(GridMapCamera(target: point, zoom: 15));
      }
      final leg = _routePoints;
      if (widget.trackLocation && leg.length >= 2) {
        final off = isOffRoute(point, leg);
        final fixes = off ? _offRouteFixes + 1 : 0;
        if (fixes != _offRouteFixes) {
          setState(() {
            _offRouteFixes = fixes;
            if (!off) _offRouteDismissed = false;
          });
        }
      }
    });
    final radius = widget.borderRadius ?? BorderRadius.zero;

    final tracker = ref.watch(riderLocationTrackerProvider(_trackerArgs));
    final riderPoint = tracker.point;

    final markers = <GridMapMarker>[
      MapHelpers.shopMarker(point: _shop),
      MapHelpers.destinationMarker(point: _destination),
      if (riderPoint != null)
        MapHelpers.riderMarker(
          riderPoint,
          rotation: tracker.headingDegrees ?? 0,
          semanticLabel: 'Rider vehicle',
        ),
    ];

    final polylines = _routePoints.isNotEmpty
        ? MapHelpers.persistedRouteLeg(
            id: 'active-route-leg',
            points: _routePoints,
            isCompleted: false,
            isCurrent: true,
          )
        : const <GridMapPolyline>[];

    final circles = <GridMapCircle>[
      if (riderPoint != null && tracker.accuracyMeters != null)
        GridMapCircle(
          id: 'gps-accuracy',
          center: riderPoint,
          radiusMeters: tracker.accuracyMeters!,
          fillColor: const Color(0x33FFDE58),
          strokeColor: const Color(0x88FFDE58),
          strokeWidth: 1,
        ),
    ];

    return ClipRRect(
      borderRadius: radius,
      child: Stack(
        children: [
          GridMapView(
            controller: _mapController,
            initialCamera: MapHelpers.camera(_destination, zoom: 13),
            interactive: widget.interactive,
            markers: markers,
            polylines: polylines,
            circles: circles,
            padding: EdgeInsets.fromLTRB(
              0,
              widget.overlayTopInset,
              0,
              widget.overlayBottomInset,
            ),
            onCameraMove: (_) {
              if (_followCamera) {
                // User-driven camera will also fire; follow toggle is explicit.
              }
            },
          ),
          MapHelpers.attribution(includeRouting: _routePoints.isNotEmpty),
          if (widget.showLiveBadge && widget.trackLocation && !_offRouteVisible)
            Positioned(
              top: _overlayTop(context),
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
              bottom: widget.overlayBottomInset + AppSpacing.sm + AppSpacing.xs,
              child: IgnorePointer(
                child: Center(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xE6111111),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _routeDegraded
                              ? Icons.info_outline_rounded
                              : Icons.route_rounded,
                          size: 13,
                          color: _routeDegraded
                              ? Colors.orangeAccent
                              : kRouteColor,
                        ),
                        const SizedBox(width: 5),
                        Text(
                          _routeDegraded
                              ? 'Route line unavailable'
                              : '${(widget.planStop!.legDistanceMeters / 1000).toStringAsFixed(1)} km to this stop',
                          style: AppTypography.caption.copyWith(
                            color: _routeDegraded
                                ? Colors.orangeAccent
                                : Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          Positioned(
            key: const Key('rider-map-location-control'),
            top: _overlayTop(context),
            right: AppSpacing.md,
            child: Column(
              children: [
                _MapControlButton(
                  label: widget.trackLocation
                      ? 'Refresh GPS location'
                      : 'Recenter delivery map',
                  icon: Icons.my_location_rounded,
                  onTap: () => unawaited(_refreshGpsLocation()),
                ),
                if (widget.trackLocation) ...[
                  const SizedBox(height: AppSpacing.sm + 4),
                  _MapControlButton(
                    key: const Key('camera-follow-toggle'),
                    label: _followCamera
                        ? 'Stop following my position'
                        : 'Follow my position',
                    icon: _followCamera
                        ? Icons.navigation_rounded
                        : Icons.navigation_outlined,
                    onTap: () => setState(() => _followCamera = !_followCamera),
                  ),
                ],
              ],
            ),
          ),
          if (_offRouteVisible)
            Positioned(
              key: const Key('off-route-banner'),
              top: _overlayTop(context),
              left: AppSpacing.md,
              // Stay clear of the map control column on the right.
              right: AppSpacing.md + 52,
              child: Material(
                color: const Color(0xF23D2E00),
                borderRadius: AppRadius.borderMd,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.fork_right_rounded,
                        color: Color(0xFFFFDE58),
                        size: 18,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          'Off route — request a new plan?',
                          style: AppTypography.caption.copyWith(
                            color: const Color(0xFFFFF3C4),
                            fontSize: 12,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: _replanInFlight
                            ? null
                            : () => unawaited(_requestReplan()),
                        child: Text(
                          _replanInFlight ? 'Requesting…' : 'Request replan',
                        ),
                      ),
                      IconButton(
                        iconSize: 16,
                        color: const Color(0xFFFFF3C4),
                        onPressed: () =>
                            setState(() => _offRouteDismissed = true),
                        icon: const Icon(Icons.close_rounded),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  bool get _offRouteVisible =>
      widget.trackLocation && _offRouteFixes >= 3 && !_offRouteDismissed;

  double _overlayTop(BuildContext context) =>
      MediaQuery.paddingOf(context).top +
      widget.overlayTopInset +
      AppSpacing.md;

  Future<void> _requestReplan() async {
    setState(() => _replanInFlight = true);
    final error = await ref.read(deliveriesProvider.notifier).requestReplan();
    if (!mounted) return;
    setState(() {
      _replanInFlight = false;
      if (error == null) {
        _offRouteFixes = 0;
        _offRouteDismissed = false;
      }
    });
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(error ?? 'Route updated with a new plan')),
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
    super.key,
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
