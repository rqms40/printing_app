import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/shared/off_route.dart';

void main() {
  // A ~1.1 km north-south leg through Davao.
  const leg = [
    LatLng(7.0640, 125.6079),
    LatLng(7.0690, 125.6079),
    LatLng(7.0740, 125.6079),
  ];

  test('on the leg is not off route', () {
    expect(isOffRoute(const LatLng(7.0665, 125.6079), leg), isFalse);
  });

  test('within the threshold corridor is not off route', () {
    // ~55 m east of the leg (0.0005 deg lng at this latitude).
    expect(isOffRoute(const LatLng(7.0690, 125.6084), leg), isFalse);
  });

  test('far from the leg is off route', () {
    // ~550 m east of the leg.
    expect(isOffRoute(const LatLng(7.0690, 125.6129), leg), isTrue);
  });

  test('beyond the leg end but close laterally uses segment endpoints', () {
    // 100 m north of the last point: distance to endpoint ~111 m < 120 m.
    expect(isOffRoute(const LatLng(7.0749, 125.6079), leg), isFalse);
  });

  test('degenerate legs never flag off route', () {
    expect(isOffRoute(const LatLng(7, 125), const []), isFalse);
    expect(isOffRoute(const LatLng(7, 125), const [LatLng(7.1, 125.1)]),
        isFalse);
  });
}
