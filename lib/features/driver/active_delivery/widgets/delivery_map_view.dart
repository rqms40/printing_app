import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/driver/active_delivery/providers/location_provider.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Live delivery map for the driver's active delivery view.
class DeliveryMapView extends ConsumerWidget {
  const DeliveryMapView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final location = ref.watch(locationProvider);

    final driverPoint = location != null
        ? LatLng(location.latitude, location.longitude)
        : MapHelpers.shopPoint;

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
              FlutterMap(
                options: const MapOptions(
                  initialCenter: MapHelpers.mapCenter,
                  initialZoom: 12.0,
                ),
                children: [
                  MapHelpers.tileLayer(),
                  MapHelpers.routePolyline(),
                  MarkerLayer(
                    markers: [
                      MapHelpers.shopMarker(),
                      MapHelpers.destinationMarker(),
                      MapHelpers.driverMarker(driverPoint),
                    ],
                  ),
                ],
              ),

              // "Live Tracking Active" badge
              Positioned(
                top: AppSpacing.sm,
                left: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.95),
                    borderRadius: AppRadius.borderFull,
                    boxShadow: const [
                      BoxShadow(
                        color: Color(0x20000000),
                        blurRadius: 8,
                        offset: Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const _PulsingDot(color: kRouteColor),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'Live Tracking Active',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurface,
                          fontWeight: FontWeight.w600,
                          fontSize: 11,
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

/// Pulsing dot indicator for live status.
class _PulsingDot extends StatefulWidget {
  const _PulsingDot({required this.color});
  final Color color;

  @override
  State<_PulsingDot> createState() => _PulsingDotState();
}

class _PulsingDotState extends State<_PulsingDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c;

  @override
  void initState() {
    super.initState();
    _c = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: Tween(begin: 0.4, end: 1.0).animate(
        CurvedAnimation(parent: _c, curve: Curves.easeInOut),
      ),
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(
          color: widget.color,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
