import 'dart:math' as math;

import 'package:latlong2/latlong.dart';

const double kOffRouteThresholdMeters = 120;

/// True when [point] is farther than [thresholdMeters] from every segment of
/// [leg]. Pure geometry — the server stays the routing authority; this only
/// decides when to OFFER a replan, never to reroute locally.
bool isOffRoute(
  LatLng point,
  List<LatLng> leg, {
  double thresholdMeters = kOffRouteThresholdMeters,
}) {
  if (leg.length < 2) return false;
  var best = double.infinity;
  for (var i = 0; i < leg.length - 1; i++) {
    final d = _distanceToSegmentMeters(point, leg[i], leg[i + 1]);
    if (d < best) best = d;
    if (best <= thresholdMeters) return false;
  }
  return best > thresholdMeters;
}

/// Meters from [p] to segment [a]-[b] using a local equirectangular
/// projection — accurate at city scale, cheap enough for every GPS fix.
double _distanceToSegmentMeters(LatLng p, LatLng a, LatLng b) {
  const metersPerDegLat = 111320.0;
  final metersPerDegLng =
      metersPerDegLat * math.cos(p.latitude * math.pi / 180.0);

  final ax = (a.longitude - p.longitude) * metersPerDegLng;
  final ay = (a.latitude - p.latitude) * metersPerDegLat;
  final bx = (b.longitude - p.longitude) * metersPerDegLng;
  final by = (b.latitude - p.latitude) * metersPerDegLat;

  final dx = bx - ax;
  final dy = by - ay;
  final lengthSquared = dx * dx + dy * dy;
  double t = lengthSquared == 0
      ? 0
      : -(ax * dx + ay * dy) / lengthSquared;
  t = t.clamp(0.0, 1.0);
  final cx = ax + t * dx;
  final cy = ay + t * dy;
  return math.sqrt(cx * cx + cy * cy);
}
