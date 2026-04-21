import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// Driver's active delivery map with real road route and live position.
class DeliveryMapView extends ConsumerStatefulWidget {
  const DeliveryMapView({super.key, required this.assignmentId});

  final String assignmentId;

  @override
  ConsumerState<DeliveryMapView> createState() => _DeliveryMapViewState();
}

class _DeliveryMapViewState extends ConsumerState<DeliveryMapView> {
  List<LatLng> _routePoints = [];
  int _driverIndex = 0;
  Timer? _driverTimer;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    unawaited(WebSocketService.instance.connectLocation());
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
      _driverIndex = (points.length * 0.3).round();
    });
    _emitDriverLocation();
    _startDriverSimulation();
  }

  void _emitDriverLocation() {
    if (_routePoints.isEmpty) return;
    final point = _routePoints[_driverIndex];
    WebSocketService.instance.sendDriverLocation({
      'assignmentId': widget.assignmentId,
      'latitude': point.latitude,
      'longitude': point.longitude,
      'timestamp': DateTime.now().toIso8601String(),
    });
  }

  void _startDriverSimulation() {
    _driverTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      var shouldEmitLocation = false;
      setState(() {
        if (_driverIndex < _routePoints.length - 1) {
          _driverIndex++;
          shouldEmitLocation = true;
        } else {
          timer.cancel();
        }
      });
      if (shouldEmitLocation) _emitDriverLocation();
    });
  }

  @override
  void dispose() {
    _driverTimer?.cancel();
    WebSocketService.instance.disconnectLocation();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (_isLoading || _routePoints.isEmpty) {
      return ClipRRect(
        borderRadius: AppRadius.borderMd,
        child: Container(
          color: colors.surfaceVariant,
          child: Center(child: CircularProgressIndicator(color: colors.accent)),
        ),
      );
    }

    final driverPoint = _routePoints[_driverIndex];

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
                options: MapOptions(
                  initialCenter: driverPoint,
                  initialZoom: 14.0,
                ),
                children: [
                  MapHelpers.tileLayer(Theme.of(context).brightness),
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

              // Live badge
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
      opacity: Tween(
        begin: 0.4,
        end: 1.0,
      ).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
      child: Container(
        width: 8,
        height: 8,
        decoration: BoxDecoration(color: widget.color, shape: BoxShape.circle),
      ),
    );
  }
}
