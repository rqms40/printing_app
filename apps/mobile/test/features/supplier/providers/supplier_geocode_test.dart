import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/supplier/providers/supplier_profile_provider.dart';

void main() {
  test('parseShopGeocode reads nominatim-backed coordinates', () {
    final point = parseShopGeocode({
      'latitude': 7.0505,
      'longitude': 125.5889,
      'displayName': 'Quimpo Blvd, Davao City',
    });
    expect(point, isNotNull);
    expect(point!.latitude, closeTo(7.0505, 0.0001));
    expect(point.longitude, closeTo(125.5889, 0.0001));
  });

  test('parseShopGeocode rejects a missing or zero pin', () {
    expect(parseShopGeocode(null), isNull);
    expect(parseShopGeocode({'latitude': 0, 'longitude': 0}), isNull);
    expect(parseShopGeocode({'latitude': 'x', 'longitude': 125.5}), isNull);
  });

  test('parseShopGeocodeSuggestions reads a place list to tap', () {
    final hits = parseShopGeocodeSuggestions({
      'latitude': 7.0505,
      'longitude': 125.5889,
      'displayName': 'Quimpo Blvd, Davao City',
      'suggestions': [
        {
          'displayName': 'Quimpo Blvd, Davao City',
          'latitude': 7.0505,
          'longitude': 125.5889,
        },
        {
          'displayName': 'New Burgos Street, Davao City',
          'latitude': 7.0876,
          'longitude': 125.6146,
        },
      ],
    });
    expect(hits.map((hit) => hit.displayName).toList(), [
      'Quimpo Blvd, Davao City',
      'New Burgos Street, Davao City',
    ]);
  });
}
