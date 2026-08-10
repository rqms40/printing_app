import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/providers/checkout_payment_settings_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

void main() {
  test('credits-only mode enables Pilot Credits and hides other methods', () {
    const settings = CheckoutPaymentSettings(creditsOnlyMode: true);

    expect(settings.visibleMethods, [PaymentMethod.gridCredits]);
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
    }
  });

  test('default pilot mode shows credits + COD, hides live wallets', () {
    const settings = CheckoutPaymentSettings(creditsOnlyMode: false);

    expect(
      settings.visibleMethods,
      [PaymentMethod.gridCredits, PaymentMethod.cod],
    );
    expect(
      settings.isMethodEnabled(PaymentMethod.cod, creditsBalance: 0),
      isTrue,
    );
    expect(
      settings.isMethodEnabled(PaymentMethod.gcash, creditsBalance: 100),
      isFalse,
    );
    expect(
      settings.isMethodEnabled(PaymentMethod.maya, creditsBalance: 100),
      isFalse,
    );
  });

  test('sandbox showLiveWallets exposes GCash and Maya', () {
    const settings = CheckoutPaymentSettings(
      creditsOnlyMode: false,
      showLiveWallets: true,
    );

    expect(settings.visibleMethods, [
      PaymentMethod.gridCredits,
      PaymentMethod.cod,
      PaymentMethod.gcash,
      PaymentMethod.maya,
    ]);
    expect(
      settings.isMethodEnabled(PaymentMethod.gcash, creditsBalance: 0),
      isTrue,
    );
  });

  test('COD rules subtitle is documented for UI', () {
    expect(
      CheckoutPaymentSettings.codRulesSubtitle,
      contains('₱1,500'),
    );
    expect(
      CheckoutPaymentSettings.codRulesSubtitle.toLowerCase(),
      contains('one unpaid'),
    );
  });
}
