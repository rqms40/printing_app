import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

void main() {
  group('GeoJsonLineString', () {
    test('decodes GeoJSON longitude latitude order exactly', () {
      final geometry = GeoJsonLineString.tryParse({
        'type': 'LineString',
        'coordinates': [
          [125.6079, 7.064],
          [125.6128, 7.0731],
        ],
      });

      expect(geometry, isNotNull);
      expect(geometry!.points.first.latitude, 7.064);
      expect(geometry.points.first.longitude, 125.6079);
      expect(geometry.points.last.latitude, 7.0731);
      expect(geometry.points.last.longitude, 125.6128);
    });

    test('rejects malformed, short, and out-of-range geometry', () {
      expect(
        GeoJsonLineString.tryParse({
          'type': 'Polygon',
          'coordinates': [
            [125.6079, 7.064],
            [125.6128, 7.0731],
          ],
        }),
        isNull,
      );
      expect(
        GeoJsonLineString.tryParse({
          'type': 'LineString',
          'coordinates': [
            [125.6079, 7.064],
          ],
        }),
        isNull,
      );
      expect(
        GeoJsonLineString.tryParse({
          'type': 'LineString',
          'coordinates': [
            [181, 7.064],
            [125.6128, 7.0731],
          ],
        }),
        isNull,
      );
      expect(
        GeoJsonLineString.tryParse({
          'type': 'LineString',
          'coordinates': [
            [7.064, 125.6079],
            [7.0731, 125.6128],
          ],
        }),
        isNull,
      );
      expect(
        GeoJsonLineString.tryParse({
          'type': 'LineString',
          'coordinates': [
            ['125.6079', 7.064],
            [125.6128, 7.0731],
          ],
        }),
        isNull,
      );
    });
  });
}
