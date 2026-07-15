import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/shared/rider_eta.dart';

void main() {
  test('eta formatting', () {
    expect(formatEtaMinutes(45), '~1 min');
    expect(formatEtaMinutes(540), '~9 min');
    expect(formatEtaMinutes(3600), '~1 h');
    expect(formatEtaMinutes(3900), '~1 h 5 min');
    expect(formatDistanceMeters(850), '850 m');
    expect(formatDistanceMeters(2340), '2.3 km');
  });
}
