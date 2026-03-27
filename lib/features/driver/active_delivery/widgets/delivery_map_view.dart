import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/driver/active_delivery/providers/location_provider.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// Live delivery map for the driver's active delivery view.
class DeliveryMapView extends ConsumerWidget {
  const DeliveryMapView({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final location = ref.watch(locationProvider);

    // Destination (QC)
    const destinationPoint = LatLng(14.6340, 121.0347);

    // Route from MockData location updates
    final routePoints = MockData.locationUpdates
        .map((loc) => LatLng(loc.latitude, loc.longitude))
        .toList();

    // Driver current position from location provider, or fallback
    final driverPoint = location != null
        ? LatLng(location.latitude, location.longitude)
        : const LatLng(14.5547, 121.0244);

    // Center between driver and destination
    const mapCenter = LatLng(14.5940, 121.0296);

    return ClipRRect(
      borderRadius: AppRadius.borderMd,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: colors.outline, width: 0.5),
          borderRadius: AppRadius.borderMd,
        ),
        child: ClipRRect(
          borderRadius: AppRadius.borderMd,
          child: Stack(
            children: [
              // Real OpenStreetMap
              FlutterMap(
                options: const MapOptions(
                  initialCenter: mapCenter,
                  initialZoom: 12.5,
                ),
                children: [
                  TileLayer(
                    urlTemplate:
                        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.gridprint.app',
                  ),
                  // Route polyline
                  PolylineLayer(
                    polylines: [
                      Polyline(
                        points: routePoints,
                        color: colors.accent,
                        strokeWidth: 3.0,
                      ),
                    ],
                  ),
                  // Markers
                  MarkerLayer(
                    markers: [
                      // Driver current position
                      Marker(
                        point: driverPoint,
                        width: 40,
                        height: 40,
                        child: Container(
                          decoration: BoxDecoration(
                            color: colors.accent,
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: colors.surface,
                              width: 3,
                            ),
                          ),
                          child: Icon(
                            Icons.navigation,
                            color: colors.surface,
                            size: 20,
                          ),
                        ),
                      ),
                      // Destination marker
                      Marker(
                        point: destinationPoint,
                        width: 36,
                        height: 36,
                        child: Icon(
                          Icons.flag,
                          color: colors.accent,
                          size: 36,
                        ),
                      ),
                    ],
                  ),
                ],
              ),

              // "Live Tracking Active" badge
              Positioned(
                top: AppSpacing.md,
                left: AppSpacing.md,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: AppRadius.borderFull,
                    border: Border.all(color: colors.outline, width: 0.5),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _PulsingDot(color: colors.success),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'Live Tracking Active',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurface,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
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
}

/// A small dot that pulses to indicate live status.
class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});

  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.4, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _animation,
      child: Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          color: widget.color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
