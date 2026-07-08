import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';
import 'package:google_polyline_algorithm/google_polyline_algorithm.dart';

/// Service that fetches real driving routes from OSRM (free, no API key).
///
/// OSRM public demo server: router.project-osrm.org
/// Returns actual road-following polyline geometry.
class RoutingService {
  RoutingService._();

  /// Cached route to avoid repeated API calls during the session.
  static List<LatLng>? _cachedRoute;
  static String? _cachedKey;

  @visibleForTesting
  static Future<List<LatLng>> Function(LatLng start, LatLng end)?
  debugRouteFetcher;

  /// Fetches a driving route between two points.
  ///
  /// Returns a list of [LatLng] coordinates following real roads.
  /// Falls back to a detailed hardcoded Manila route if the API is unavailable.
  static Future<List<LatLng>> getRoute(LatLng start, LatLng end) async {
    final debugFetcher = debugRouteFetcher;
    if (debugFetcher != null) {
      return debugFetcher(start, end);
    }

    final key =
        '${start.latitude},${start.longitude}-${end.latitude},${end.longitude}';
    if (_cachedRoute != null && _cachedKey == key) {
      return _cachedRoute!;
    }

    try {
      final url = Uri.parse(
        'https://router.project-osrm.org/route/v1/driving/'
        '${start.longitude},${start.latitude};'
        '${end.longitude},${end.latitude}'
        '?overview=full&geometries=polyline',
      );

      final response = await http.get(url).timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        final data = json.decode(response.body) as Map<String, dynamic>;
        final routes = data['routes'] as List<dynamic>?;

        if (routes != null && routes.isNotEmpty) {
          final geometry = routes[0]['geometry'] as String;
          final decoded = decodePolyline(geometry);
          final points = decoded
              .map((p) => LatLng(p[0].toDouble(), p[1].toDouble()))
              .toList();

          _cachedRoute = points;
          _cachedKey = key;
          return points;
        }
      }
    } catch (_) {
      // API unavailable — fall through to hardcoded route
    }

    // Fallback: keep the route bounded to the requested endpoints. This is
    // not turn-by-turn geometry, but it avoids drawing a delivery in another
    // city when the public OSRM service is unavailable.
    return fallbackRouteBetween(start, end);
  }

  @visibleForTesting
  static List<LatLng> fallbackRouteBetween(LatLng start, LatLng end) {
    if (start == end) return [start];

    const distance = Distance();
    final meters = distance(start, end);
    final segments = (meters / 120).ceil().clamp(2, 24).toInt();

    return List.generate(segments + 1, (index) {
      final progress = index / segments;
      return LatLng(
        start.latitude + ((end.latitude - start.latitude) * progress),
        start.longitude + ((end.longitude - start.longitude) * progress),
      );
    });
  }
}
