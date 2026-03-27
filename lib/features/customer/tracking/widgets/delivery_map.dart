import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// Live delivery tracking map showing shop, destination, and driver route.
class DeliveryMap extends StatefulWidget {
  const DeliveryMap({super.key});

  @override
  State<DeliveryMap> createState() => _DeliveryMapState();
}

class _DeliveryMapState extends State<DeliveryMap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    // Shop / pickup point (Makati)
    const shopPoint = LatLng(14.5547, 121.0244);
    // Destination (QC)
    const destinationPoint = LatLng(14.6340, 121.0347);

    // Route from MockData location updates
    final routePoints = MockData.locationUpdates
        .map((loc) => LatLng(loc.latitude, loc.longitude))
        .toList();

    // Center the map between shop and destination
    const mapCenter = LatLng(14.5940, 121.0296);

    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        width: double.infinity,
        decoration: BoxDecoration(
          border: Border.all(color: colors.outline, width: 0.5),
          borderRadius: AppRadius.borderLg,
        ),
        child: ClipRRect(
          borderRadius: AppRadius.borderLg,
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
                      // Shop / pickup marker
                      Marker(
                        point: shopPoint,
                        width: 36,
                        height: 36,
                        child: Icon(
                          Icons.location_on,
                          color: colors.onSurface,
                          size: 36,
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

              // "Live Tracking" badge with pulsing dot
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
                      AnimatedBuilder(
                        animation: _pulseController,
                        builder: (context, child) {
                          return Opacity(
                            opacity: 0.4 + (_pulseController.value * 0.6),
                            child: Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: colors.success,
                                shape: BoxShape.circle,
                              ),
                            ),
                          );
                        },
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'Live Tracking',
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
