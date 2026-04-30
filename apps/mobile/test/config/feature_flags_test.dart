import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/config/feature_flags.dart';

void main() {
  group('FeatureFlags', () {
    test('checkoutV2 defaults to false', () {
      const flags = FeatureFlags();
      expect(flags.checkoutV2, isFalse);
    });

    test('reads CHECKOUT_V2=true from env', () {
      const flags = FeatureFlags(env: {'CHECKOUT_V2': 'true'});
      expect(flags.checkoutV2, isTrue);
    });
  });
}
