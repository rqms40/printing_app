import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Bento map tile showing the rider's route. Fills its parent (use inside an
/// Expanded/SizedBox). Mirrors the customer MapTrackingTile slot.
class RiderRouteMapTile extends ConsumerStatefulWidget {
  const RiderRouteMapTile({
    super.key,
    required this.stops,
    required this.activeStop,
    required this.onTap,
  });

  final List<RiderAssignmentView> stops;
  final RiderAssignmentView? activeStop;
  final VoidCallback onTap;

  @override
  ConsumerState<RiderRouteMapTile> createState() => _RiderRouteMapTileState();
}

class _RiderRouteMapTileState extends ConsumerState<RiderRouteMapTile> {
  final _mapController = MapController();
  List<LatLng> _routePoints = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRoute();
  }

  LatLng get _destination {
    final latLng = widget.activeStop?.order.destination?.latLng;
    if (latLng != null) return latLng;
    if (widget.stops.isNotEmpty) {
      return widget.stops.first.order.destination?.latLng ??
          MapHelpers.davaoCenter;
    }
    return MapHelpers.davaoCenter;
  }

  Future<void> _loadRoute() async {
    final points = await RoutingService.getRoute(
      MapHelpers.shopPoint,
      _destination,
    );
    if (!mounted) return;
    setState(() {
      _routePoints = points;
      _loading = false;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _routePoints.isEmpty) return;
      _mapController.fitCamera(
        CameraFit.bounds(
          bounds: LatLngBounds.fromPoints(
            [MapHelpers.shopPoint, _destination, ..._routePoints],
          ),
          padding: const EdgeInsets.all(28),
        ),
      );
    });
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  List<Marker> _stopMarkers(AppColorSet colors) {
    final markers = <Marker>[];
    var n = 1;
    for (final stop in widget.stops) {
      final point = stop.order.destination?.latLng;
      if (point == null) {
        n++;
        continue;
      }
      markers.add(
        Marker(
          point: point,
          width: 34,
          height: 44,
          alignment: Alignment.topCenter,
          child: _numberBadge(n, colors),
        ),
      );
      n++;
    }
    if (markers.isEmpty) {
      markers.add(
        Marker(
          point: _destination,
          width: 30,
          height: 30,
          child: Icon(Icons.location_on_rounded, color: colors.brand, size: 28),
        ),
      );
    }
    return markers;
  }

  Widget _numberBadge(int number, AppColorSet colors) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: colors.surface,
            shape: BoxShape.circle,
            border: Border.all(color: colors.brand, width: 1.6),
            boxShadow: const [
              BoxShadow(color: Color(0x66000000), blurRadius: 6, offset: Offset(0, 2)),
            ],
          ),
          child: Center(
            child: Text(
              '$number',
              style: TextStyle(
                color: colors.onSurface,
                fontWeight: FontWeight.w800,
                fontSize: 11,
                height: 1,
              ),
            ),
          ),
        ),
        Container(
          width: 2.2,
          height: 10,
          decoration: BoxDecoration(
            color: colors.brand,
            borderRadius: BorderRadius.circular(4),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final brightness = Theme.of(context).brightness;
    final colors = brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final timeLabel = DateFormat('h:mm a').format(DateTime.now());

    return GestureDetector(
      onTap: widget.onTap,
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: ColoredBox(
          color: colors.surface,
          child: Stack(
            fit: StackFit.expand,
            children: [
              if (_loading)
                Center(
                  child: CircularProgressIndicator(
                    color: colors.brand,
                    strokeWidth: 2,
                  ),
                )
              else
                FlutterMap(
                  mapController: _mapController,
                  options: MapOptions(
                    initialCenter: _destination,
                    initialZoom: 13,
                    interactionOptions: const InteractionOptions(
                      flags: InteractiveFlag.none,
                    ),
                  ),
                  children: [
                    MapHelpers.tileLayer(brightness),
                    if (_routePoints.isNotEmpty)
                      PolylineLayer(
                        polylines: [
                          Polyline(
                            points: _routePoints,
                            color: colors.brand.withValues(alpha: 0.9),
                            strokeWidth: 3.2,
                          ),
                        ],
                      ),
                    MarkerLayer(markers: _stopMarkers(colors)),
                  ],
                ),
              Positioned(
                top: 12,
                left: 12,
                child: Text(
                  timeLabel,
                  style: AppTypography.h1.copyWith(
                    color: colors.onBackground,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                    height: 1,
                    shadows: [
                      Shadow(
                        color: colors.background.withValues(alpha: 0.7),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
              ),
              Positioned(
                left: 12,
                bottom: 10,
                child: Text(
                  widget.activeStop == null
                      ? 'No active route'
                      : 'Tap to navigate',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontStyle: FontStyle.italic,
                    fontSize: 10,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
