import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_delivery_card.dart';

void main() {
  testWidgets('renders three mode tabs', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutDeliveryCard())),
    ));
    expect(find.text('Delivery'), findsOneWidget);
    expect(find.text('Pickup'), findsOneWidget);
    expect(find.text('Multi-drop'), findsOneWidget);
  });

  testWidgets('tapping Pickup switches mode and shows shop card', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutDeliveryCard())),
    ));
    await tester.tap(find.text('Pickup'));
    await tester.pump();
    expect(container.read(checkoutProvider).mode, DeliveryMode.pickup);
    expect(find.textContaining('GRID Print Shop'), findsOneWidget);
  });
}
