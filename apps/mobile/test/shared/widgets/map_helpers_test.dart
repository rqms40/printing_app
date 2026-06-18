import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

void main() {
  group('MapHelpers.tileLayer', () {
    test('uses the shared OpenStreetMap tile endpoint in light mode', () {
      final layer = MapHelpers.tileLayer(Brightness.light);

      expect(layer.urlTemplate, MapHelpers.openStreetMapTileUrl);
      expect(layer.urlTemplate, contains('tile.openstreetmap.org'));
      expect(layer.urlTemplate, isNot(contains('basemaps.cartocdn.com')));
    });

    test('uses the shared OpenStreetMap tile endpoint in dark mode', () {
      final layer = MapHelpers.tileLayer(Brightness.dark);

      expect(layer.urlTemplate, MapHelpers.openStreetMapTileUrl);
      expect(layer.urlTemplate, contains('tile.openstreetmap.org'));
      expect(layer.urlTemplate, isNot(contains('basemaps.cartocdn.com')));
    });
  });
}
