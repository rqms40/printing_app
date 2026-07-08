import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/services/routing_service.dart';

void main() {
  group('RoutingService fallback route', () {
    test('stays bounded between the requested start and destination', () {
      const shop = LatLng(7.0640, 125.6079);
      const destination = LatLng(7.0731, 125.6128);

      final route = RoutingService.fallbackRouteBetween(shop, destination);

      expect(route.first, shop);
      expect(route.last, destination);
      expect(route.length, greaterThan(2));

      for (final point in route) {
        expect(point.latitude, inInclusiveRange(7.0640, 7.0731));
        expect(point.longitude, inInclusiveRange(125.6079, 125.6128));
      }
    });

    test('returns a single point for a zero-distance route', () {
      const shop = LatLng(7.0640, 125.6079);

      final route = RoutingService.fallbackRouteBetween(shop, shop);

      expect(route, [shop]);
    });
  });
}
