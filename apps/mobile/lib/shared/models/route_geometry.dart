import 'package:latlong2/latlong.dart';

/// A strictly validated GeoJSON `LineString`.
///
/// GeoJSON coordinates are always `[longitude, latitude]`. Invalid input is
/// rejected instead of being swapped, clamped, or replaced with a straight
/// line, because dispatch geometry is owned by the persisted server plan.
class GeoJsonLineString {
  GeoJsonLineString._(List<LatLng> points)
    : points = List<LatLng>.unmodifiable(points);

  final List<LatLng> points;

  static GeoJsonLineString? tryParse(dynamic value) {
    if (value is! Map) return null;
    final json = Map<String, dynamic>.from(value);
    if (json['type'] != 'LineString') return null;
    final coordinates = json['coordinates'];
    if (coordinates is! List || coordinates.length < 2) return null;

    final points = <LatLng>[];
    for (final coordinate in coordinates) {
      if (coordinate is! List || coordinate.length != 2) return null;
      final longitude = coordinate[0];
      final latitude = coordinate[1];
      if (longitude is! num || latitude is! num) return null;
      final lng = longitude.toDouble();
      final lat = latitude.toDouble();
      if (!lng.isFinite || !lat.isFinite) return null;
      if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return null;
      points.add(LatLng(lat, lng));
    }
    return GeoJsonLineString._(points);
  }

  Map<String, dynamic> toJson() => {
    'type': 'LineString',
    'coordinates': [
      for (final point in points) [point.longitude, point.latitude],
    ],
  };
}
