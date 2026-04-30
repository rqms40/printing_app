import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

String _today() {
  final now = DateTime.now();
  return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
}

ProviderContainer _makeContainer({bool seedBookable = true}) {
  final container = ProviderContainer(overrides: [
    dioProvider.overrideWithValue(MockDio()),
    webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
  ]);
  if (seedBookable) {
    container
        .read(deliverySlotProvider(_today()).notifier)
        .debugSeedSlotsForTest(const [
      DeliverySlot(
        templateId: 1,
        startTime: '00:00:00',
        endTime: '23:59:00',
        capacity: 10,
        bookedCount: 0,
      ),
    ]);
  }
  return container;
}

void main() {
  testWidgets('renders Express, Standard, Scheduled rows; standard default',
      (tester) async {
    final container = _makeContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Express'), findsOneWidget);
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('Scheduled'), findsOneWidget);
    expect(find.text('Saver'), findsNothing);
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.standard);
  });

  testWidgets('tapping Express updates state to priority tier', (tester) async {
    final container = _makeContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Express'));
    await tester.pump();
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.priority);
  });

  testWidgets('disables tiers and shows banner when no slot bookable today',
      (tester) async {
    final container = _makeContainer(seedBookable: false);
    addTearDown(container.dispose);
    // Force the state to "loaded but empty" so the card sees an empty slots list
    // (instead of triggering a real refresh on first read).
    container
        .read(deliverySlotProvider(_today()).notifier)
        .debugSeedSlotsForTest(const []);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
    ));
    await tester.pumpAndSettle();
    expect(find.textContaining('No slot is open right now'), findsOneWidget);
    await tester.tap(find.text('Express'));
    await tester.pump();
    expect(container.read(checkoutProvider).speedTier, DeliverySpeedTier.standard);
  });
}
