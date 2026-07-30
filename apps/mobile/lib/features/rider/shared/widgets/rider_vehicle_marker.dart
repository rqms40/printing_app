import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

/// The single GRIDGO vehicle marker: yellow disc, dark heading arrow.
/// Rotates with [headingDegrees]; falls back to a neutral dot when the
/// heading is unknown so it never points a misleading direction.
Marker riderVehicleMarker({
  required LatLng point,
  double? headingDegrees,
  Key? semanticKey,
  String semanticLabel = 'Rider current location marker',
}) {
  final hasHeading = headingDegrees != null && headingDegrees >= 0;
  final disc = Container(
    decoration: BoxDecoration(
      color: kRouteColor,
      shape: BoxShape.circle,
      border: Border.all(color: Colors.white, width: 2.5),
      boxShadow: const [
        BoxShadow(
          color: Color(0x40000000),
          blurRadius: 8,
          offset: Offset(0, 2),
        ),
      ],
    ),
    child: hasHeading
        ? Transform.rotate(
            angle: headingDegrees * (math.pi / 180.0),
            child: const Icon(
              Icons.navigation_rounded,
              color: kRouteBorderColor,
              size: 22,
            ),
          )
        : const Icon(Icons.circle, color: kRouteBorderColor, size: 12),
  );
  return Marker(
    point: point,
    width: 44,
    height: 44,
    child: Semantics(
      key: semanticKey,
      container: true,
      label: semanticLabel,
      child: disc,
    ),
  );
}

/// Translucent GPS accuracy circle drawn under the vehicle marker.
CircleLayer riderAccuracyCircle({
  required LatLng point,
  required double accuracyMeters,
}) {
  return CircleLayer(
    circles: [
      CircleMarker(
        point: point,
        radius: accuracyMeters,
        useRadiusInMeter: true,
        color: kRouteColor.withValues(alpha: 0.12),
        borderColor: kRouteColor.withValues(alpha: 0.35),
        borderStrokeWidth: 1,
      ),
    ],
  );
}

/// Lerps the vehicle's LatLng over [duration] whenever [point] changes so
/// the marker glides between GPS fixes instead of teleporting.
class AnimatedVehiclePosition extends StatefulWidget {
  const AnimatedVehiclePosition({
    super.key,
    required this.point,
    required this.builder,
    this.duration = const Duration(milliseconds: 600),
  });

  final LatLng point;
  final Widget Function(BuildContext context, LatLng animatedPoint) builder;
  final Duration duration;

  @override
  State<AnimatedVehiclePosition> createState() =>
      _AnimatedVehiclePositionState();
}

class _AnimatedVehiclePositionState extends State<AnimatedVehiclePosition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late LatLng _from = widget.point;
  late LatLng _to = widget.point;

  @override
  void didUpdateWidget(AnimatedVehiclePosition oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.point != widget.point) {
      _from = _current;
      _to = widget.point;
      _controller.forward(from: 0);
    }
  }

  LatLng get _current {
    final t = Curves.easeInOut.transform(_controller.value);
    return LatLng(
      _from.latitude + (_to.latitude - _from.latitude) * t,
      _from.longitude + (_to.longitude - _from.longitude) * t,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: _controller,
    builder: (context, _) => widget.builder(context, _current),
  );
}
