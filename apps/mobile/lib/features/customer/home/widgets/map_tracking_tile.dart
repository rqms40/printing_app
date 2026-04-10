import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

/// Dark map tile showing driver location + destination. Tapping goes to tracking.
class MapTrackingTile extends StatelessWidget {
  const MapTrackingTile({super.key});

  static const _driverPoint = LatLng(14.5580, 121.0200);
  static const _destinationPoint = LatLng(14.5547, 121.0244);
  static const _mapCenter = LatLng(14.5562, 121.0220);

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push('/customer/tracking'),
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Dark CartoDB tile map
            FlutterMap(
              options: const MapOptions(
                initialCenter: _mapCenter,
                initialZoom: 13.8,
                interactionOptions: InteractionOptions(
                  flags: InteractiveFlag.none,
                ),
              ),
              children: [
                TileLayer(
                  urlTemplate:
                      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.gridprint.app',
                ),
                MarkerLayer(
                  markers: [
                    // Driver — glowing yellow pin
                    Marker(
                      point: _driverPoint,
                      width: 38,
                      height: 38,
                      child: Container(
                        decoration: const BoxDecoration(
                          color: Color(0xFFFFDE58),
                          shape: BoxShape.circle,
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x99FFDE58),
                              blurRadius: 14,
                              spreadRadius: 3,
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.local_shipping_rounded,
                          color: Colors.black,
                          size: 18,
                        ),
                      ),
                    ),
                    // Destination — white home pin
                    Marker(
                      point: _destinationPoint,
                      width: 32,
                      height: 40,
                      alignment: Alignment.topCenter,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: const Color(0xFF222222),
                                width: 2,
                              ),
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x50000000),
                                  blurRadius: 6,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.home_rounded,
                              color: Color(0xFF222222),
                              size: 14,
                            ),
                          ),
                          Container(
                            width: 2.5,
                            height: 10,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: AppRadius.borderFull,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),

            // LIVE MAP chip
            Positioned(
              top: AppSpacing.sm,
              left: AppSpacing.sm,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 3,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFFFFDE58),
                  borderRadius: AppRadius.borderFull,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: const BoxDecoration(
                        color: Colors.black,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'LIVE MAP',
                      style: AppTypography.overline.copyWith(
                        color: Colors.black,
                        fontSize: 8,
                        letterSpacing: 0.8,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
