import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/providers/rider_location_tracker_provider.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Full-featured map for rider deliveries with OSRM routing and live GPS.
class RiderMapView extends ConsumerStatefulWidget {
  const RiderMapView({
    super.key,
    required this.assignmentId,
    required this.destination,
    required this.trackLocation,
    this.interactive = true,
    this.showLiveBadge = true,
    this.borderRadius,
  });

  final String assignmentId;
  final LatLng? destination;
  final bool trackLocation;
  final bool interactive;
  final bool showLiveBadge;
  final BorderRadius? borderRadius;

  @override
  ConsumerState<RiderMapView> createState() => _RiderMapViewState();
}

class _RiderMapViewState extends ConsumerState<RiderMapView>
    with SingleTickerProviderStateMixin {
  final _mapController = MapController();
  List<LatLng> _routePoints = [];
  bool _isLoading = true;
  late final AnimationController _pulseController;

  LatLng get _shop => MapHelpers.shopPoint;

  LatLng get _destination =>
      widget.destination ?? MapHelpers.davaoCenter;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _loadRoute();
  }

  Future<void> _loadRoute() async {
    final points = await RoutingService.getRoute(_shop, _destination);
    if (!mounted) return;
    setState(() {
      _routePoints = points;
      _isLoading = false;
    });
    _fitBounds();
  }

  void _fitBounds() {
    if (_routePoints.isEmpty) return;
    final bounds = LatLngBounds.fromPoints([_shop, _destination, ..._routePoints]);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: bounds,
          padding: const EdgeInsets.all(48),
        ),
      );
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _mapController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final radius = widget.borderRadius ?? BorderRadius.zero;

    final riderPoint = widget.trackLocation
        ? ref.watch(
            riderLocationTrackerProvider(
              RiderLocationTrackerArgs(
                assignmentId: widget.assignmentId,
                enabled: true,
              ),
            ),
          )
        : null;

    final markers = <Marker>[
      MapHelpers.shopMarker(point: _shop),
      MapHelpers.destinationMarker(point: _destination),
      if (riderPoint != null) MapHelpers.riderMarker(riderPoint),
    ];

    return ClipRRect(
      borderRadius: radius,
      child: Stack(
        children: [
          if (_isLoading)
            ColoredBox(
              color: colors.surfaceVariant,
              child: Center(
                child: CircularProgressIndicator(
                  color: colors.accent,
                  strokeWidth: 2,
                ),
              ),
            )
          else
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
                MapHelpers.tileLayer(Theme.of(context).brightness),
                if (_routePoints.isNotEmpty)
                  MapHelpers.routePolyline(_routePoints),
                MarkerLayer(markers: markers),
              ],
            ),

          if (widget.showLiveBadge && widget.trackLocation && riderPoint != null)
            Positioned(
              top: AppSpacing.md,
              left: AppSpacing.md,
              child: _LiveBadge(pulseController: _pulseController),
            ),

          Positioned(
            bottom: AppSpacing.md,
            right: AppSpacing.md,
            child: _MapControlButton(
              icon: Icons.my_location_rounded,
              onTap: _fitBounds,
            ),
          ),
        ],
      ),
    );
  }
}

class _LiveBadge extends StatelessWidget {
  const _LiveBadge({required this.pulseController});

  final AnimationController pulseController;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
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
              decoration: const BoxDecoration(
                color: kRouteColor,
                shape: BoxShape.circle,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            'Live GPS',
            style: AppTypography.caption.copyWith(
              color: colors.onBackground,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _MapControlButton extends StatelessWidget {
  const _MapControlButton({required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Material(
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
    );
  }
}