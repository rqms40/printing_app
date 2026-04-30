import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';

void main() {
  testWidgets('renders 4 tier rows and selects standard by default', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    expect(find.text('Priority'), findsOneWidget);
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('Saver'), findsOneWidget);
    expect(find.text('Scheduled'), findsOneWidget);
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.standard);
  });

  testWidgets('tapping Saver updates state', (tester) async {
    final container = ProviderContainer();
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    await tester.tap(find.text('Saver'));
    await tester.pump();
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.saver);
  });
}
