import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

void main() {
  group('MapHelpers.tileLayer', () {
    test('uses the shared CARTO dark tile endpoint in light mode', () {
      final layer = MapHelpers.tileLayer(Brightness.light);

      expect(layer.urlTemplate, MapHelpers.cartoDarkTileUrl);
      expect(layer.urlTemplate, contains('basemaps.cartocdn.com'));
      expect(layer.urlTemplate, contains('dark_all'));
      expect(layer.urlTemplate, isNot(contains('tile.openstreetmap.org')));
    });

    test('uses the shared CARTO dark tile endpoint in dark mode', () {
      final layer = MapHelpers.tileLayer(Brightness.dark);

      expect(layer.urlTemplate, MapHelpers.cartoDarkTileUrl);
      expect(layer.urlTemplate, contains('basemaps.cartocdn.com'));
      expect(layer.urlTemplate, contains('dark_all'));
      expect(layer.urlTemplate, isNot(contains('tile.openstreetmap.org')));
    });

    test('uses native CARTO styling instead of an extra dark filter', () {
      expect(MapHelpers.tileLayer(Brightness.light).tileBuilder, isNull);
      expect(MapHelpers.tileLayer(Brightness.dark).tileBuilder, isNull);
    });
  });

  group('MapHelpers.routePolyline', () {
    test('uses a yellow route stroke like the desktop riders map', () {
      final layer = MapHelpers.routePolyline([
        MapHelpers.shopPoint,
        MapHelpers.davaoCenter,
      ]);

      expect(layer.polylines, hasLength(2));
      expect(layer.polylines[0].color, const Color(0xFF0A0A0A));
      expect(layer.polylines[1].color, const Color(0xFFFFDE58));
      expect(layer.polylines[1].color, isNot(const Color(0xFF00897B)));
    });
  });
}
