import 'dart:convert';
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

  /// Fetches a driving route between two points.
  ///
  /// Returns a list of [LatLng] coordinates following real roads.
  /// Falls back to a detailed hardcoded Manila route if the API is unavailable.
  static Future<List<LatLng>> getRoute(LatLng start, LatLng end) async {
    final key = '${start.latitude},${start.longitude}-${end.latitude},${end.longitude}';
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

      final response = await http.get(url).timeout(
        const Duration(seconds: 8),
      );

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

    // Fallback: detailed hardcoded route along Manila roads
    return _fallbackRoute;
  }

  /// Detailed fallback route: Makati (Ayala Ave) → QC (Katipunan Ave)
  /// Following actual road layout with curves and turns.
  static final List<LatLng> _fallbackRoute = const [
    // Ayala Ave, Makati
    LatLng(14.5510, 121.0230),
    LatLng(14.5520, 121.0248),
    LatLng(14.5535, 121.0268),
    LatLng(14.5548, 121.0285),
    LatLng(14.5560, 121.0298),
    // Ayala → EDSA junction (curve)
    LatLng(14.5572, 121.0310),
    LatLng(14.5580, 121.0322),
    LatLng(14.5592, 121.0330),
    // EDSA northbound — Guadalupe
    LatLng(14.5620, 121.0338),
    LatLng(14.5648, 121.0345),
    LatLng(14.5675, 121.0352),
    // EDSA — Boni / Pioneer
    LatLng(14.5710, 121.0360),
    LatLng(14.5740, 121.0368),
    LatLng(14.5772, 121.0375),
    // EDSA — Shaw Blvd junction (slight curve)
    LatLng(14.5800, 121.0380),
    LatLng(14.5828, 121.0383),
    LatLng(14.5855, 121.0385),
    // EDSA — Ortigas (curve westward slightly)
    LatLng(14.5880, 121.0383),
    LatLng(14.5910, 121.0380),
    LatLng(14.5938, 121.0378),
    // EDSA — Robinson Galleria / Santolan
    LatLng(14.5968, 121.0375),
    LatLng(14.5998, 121.0373),
    LatLng(14.6028, 121.0374),
    // EDSA — Camp Crame (curves east)
    LatLng(14.6060, 121.0378),
    LatLng(14.6088, 121.0382),
    LatLng(14.6115, 121.0388),
    // EDSA — Aurora Blvd junction
    LatLng(14.6140, 121.0392),
    LatLng(14.6168, 121.0396),
    LatLng(14.6195, 121.0400),
    // EDSA — Kamuning / Timog
    LatLng(14.6222, 121.0405),
    LatLng(14.6250, 121.0410),
    LatLng(14.6278, 121.0418),
    // Turn east toward Katipunan
    LatLng(14.6300, 121.0428),
    LatLng(14.6318, 121.0442),
    LatLng(14.6332, 121.0460),
    LatLng(14.6345, 121.0478),
    // Katipunan Ave approach
    LatLng(14.6358, 121.0495),
    LatLng(14.6370, 121.0510),
    LatLng(14.6382, 121.0520),
    // Katipunan Ave, Loyola Heights (destination)
    LatLng(14.6395, 121.0528),
    LatLng(14.6400, 121.0530),
  ];
}
