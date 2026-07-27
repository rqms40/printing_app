import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/maps/grid_map_models.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

void main() {
  group('MapHelpers constants', () {
    test('shop point matches GRIDGO store origin', () {
      expect(MapHelpers.shopPoint.latitude, closeTo(7.064, 0.0001));
      expect(MapHelpers.shopPoint.longitude, closeTo(125.6079, 0.0001));
    });
  });

  group('MapHelpers.routePolylines', () {
    test('uses a yellow route stroke with dark border', () {
      final layers = MapHelpers.routePolylines([
        MapHelpers.shopPoint,
        MapHelpers.davaoCenter,
      ]);

      expect(layers, hasLength(2));
      expect(layers[0].color, const Color(0xFF0A0A0A));
      expect(layers[1].color, const Color(0xFFFFDE58));
      expect(layers[1].color, isNot(const Color(0xFF00897B)));
    });

    test('returns empty for insufficient points', () {
      expect(MapHelpers.routePolylines([MapHelpers.shopPoint]), isEmpty);
    });
  });

  group('MapHelpers markers', () {
    test('shop and rider marker kinds are set', () {
      expect(MapHelpers.shopMarker().kind, GridMarkerKind.shop);
      expect(
        MapHelpers.riderMarker(MapHelpers.davaoCenter).kind,
        GridMarkerKind.rider,
      );
      expect(
        MapHelpers.destinationMarker().kind,
        GridMarkerKind.destination,
      );
    });
  });
}
