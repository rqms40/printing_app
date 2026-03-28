import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Customer delivery tracking map with real road route and live driver.
class DeliveryMap extends StatefulWidget {
  const DeliveryMap({super.key});

  @override
  State<DeliveryMap> createState() => _DeliveryMapState();
}

class _DeliveryMapState extends State<DeliveryMap>
    with SingleTickerProviderStateMixin {
  late final AnimationController _pulseController;
  List<LatLng> _routePoints = [];
  int _driverIndex = 0;
  Timer? _driverTimer;
  bool _isLoading = true;

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
    final points = await RoutingService.getRoute(
      MapHelpers.shopPoint,
      MapHelpers.destinationPoint,
    );
    if (!mounted) return;
    setState(() {
      _routePoints = points;
      _isLoading = false;
      // Start driver at ~40% along the route (already en route)
      _driverIndex = (points.length * 0.4).round();
    });
    _startDriverSimulation();
  }

  void _startDriverSimulation() {
    _driverTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      setState(() {
        if (_driverIndex < _routePoints.length - 1) {
          _driverIndex++;
        } else {
          timer.cancel();
        }
      });
    });
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _driverTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (_isLoading || _routePoints.isEmpty) {
      return ClipRRect(
        borderRadius: AppRadius.borderLg,
        child: Container(
          height: 300,
          color: colors.surfaceVariant,
          child: Center(
            child: CircularProgressIndicator(color: colors.accent),
          ),
        ),
      );
    }

    final driverPoint = _routePoints[_driverIndex];

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
              FlutterMap(
                options: MapOptions(
                  initialCenter: driverPoint,
                  initialZoom: 13.5,
                ),
                children: [
                  MapHelpers.tileLayer(),
                  MapHelpers.routePolyline(_routePoints),
                  MarkerLayer(
                    markers: [
                      MapHelpers.shopMarker(),
                      MapHelpers.destinationMarker(),
                      MapHelpers.driverMarker(driverPoint),
                    ],
                  ),
                ],
              ),

              // Live Tracking badge
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
                      BoxShadow(color: Color(0x20000000), blurRadius: 8, offset: Offset(0, 2)),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      AnimatedBuilder(
                        animation: _pulseController,
                        builder: (context, _) => Opacity(
                          opacity: 0.4 + (_pulseController.value * 0.6),
                          child: Container(
                            width: 8,
                            height: 8,
                            decoration: const BoxDecoration(
                              color: kRouteColor,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Text(
                        'Live Tracking',
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

              // ETA badge
              Positioned(
                top: AppSpacing.sm,
                right: AppSpacing.sm,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.xs,
                  ),
                  decoration: BoxDecoration(
                    color: colors.surface.withValues(alpha: 0.95),
                    borderRadius: AppRadius.borderFull,
                    boxShadow: const [
                      BoxShadow(color: Color(0x20000000), blurRadius: 8, offset: Offset(0, 2)),
                    ],
                  ),
                  child: Text(
                    '~${_routePoints.length - _driverIndex} min',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurface,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
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
