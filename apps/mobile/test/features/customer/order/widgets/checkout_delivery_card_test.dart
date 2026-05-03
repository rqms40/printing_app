import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_delivery_card.dart';

void main() {
  testWidgets('renders three mode tabs', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutDeliveryCard())),
      ),
    );
    // Section heading + segmented chip both render "Delivery"; ensure both pills present.
    expect(find.text('Delivery'), findsNWidgets(2));
    expect(find.text('Pickup'), findsOneWidget);
    expect(find.text('Multi-drop'), findsOneWidget);
  });

  testWidgets('tapping Pickup switches mode and shows shop card', (
    tester,
  ) async {
    final container = ProviderContainer();
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutDeliveryCard())),
      ),
    );
    await tester.tap(find.text('Pickup'));
    await tester.pump();
    expect(container.read(checkoutProvider).mode, DeliveryMode.pickup);
    expect(find.textContaining('GRID Print Shop'), findsOneWidget);
  });

  testWidgets(
    'single delivery reopens pin form with current temporary address',
    (tester) async {
      final container = ProviderContainer(
        overrides: [
          addressProvider.overrideWith(
            (ref) =>
                AddressNotifier(initialState: const [], skipBootstrap: true),
          ),
        ],
      );
      addTearDown(container.dispose);
      container
          .read(checkoutProvider.notifier)
          .setTemporaryAddress(
            const TemporaryCheckoutAddress(
              label: 'Client office',
              fullAddress: 'Unit 12, Jacinto Extension',
              city: 'Davao City',
              landmark: 'Blue gate',
              latitude: 7.0731,
              longitude: 125.6128,
            ),
          );

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(
            home: Scaffold(body: CheckoutDeliveryCard(mapTilesEnabled: false)),
          ),
        ),
      );

      await tester.tap(find.text('Client office'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Pin Location'));
      await tester.pumpAndSettle();

      expect(await _textFieldValue(tester, 'Label'), 'Client office');
      expect(
        await _textFieldValue(tester, 'Full Address *'),
        'Unit 12, Jacinto Extension',
      );
      expect(await _textFieldValue(tester, 'City *'), 'Davao City');
      expect(await _textFieldValue(tester, 'Landmark'), 'Blue gate');
    },
  );
}

Future<String?> _textFieldValue(WidgetTester tester, String labelText) async {
  for (var attempt = 0; attempt < 6; attempt++) {
    final matches = find.widgetWithText(TextFormField, labelText).evaluate();
    if (matches.isNotEmpty) {
      final field = matches.first.widget as TextFormField;
      return field.controller?.text;
    }
    await tester.drag(find.byType(ListView).last, const Offset(0, -120));
    await tester.pumpAndSettle();
  }
  fail('No TextFormField with label "$labelText" was built');
}
