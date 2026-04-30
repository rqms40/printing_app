import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';

void main() {
  testWidgets('renders Express, Standard, Scheduled rows; standard default',
      (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    expect(find.text('Express'), findsOneWidget);
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('Scheduled'), findsOneWidget);
    expect(find.text('Saver'), findsNothing);
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.standard);
  });

  testWidgets('tapping Express updates state to priority tier', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    await tester.tap(find.text('Express'));
    await tester.pump();
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.priority);
  });
}
