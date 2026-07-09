import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/checkout_payment_settings_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  test('credits-only mode enables GRIDGO Credits and disables all other methods', () {
    const settings = CheckoutPaymentSettings(creditsOnlyMode: true);

    expect(
      settings.isMethodEnabled(
        PaymentMethod.gridCredits,
        creditsBalance: 100,
      ),
      isTrue,
    );
    for (final method in [
      PaymentMethod.gcash,
      PaymentMethod.maya,
      PaymentMethod.cod,
    ]) {
      expect(
        settings.isMethodEnabled(method, creditsBalance: 100),
        isFalse,
      );
      expect(
        settings.disabledSubtitleFor(method, creditsBalance: 100),
        'Unavailable during beta testing',
      );
    }
  });
}
