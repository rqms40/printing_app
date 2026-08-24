import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_fee_settings_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

String _today() {
  final now = DateTime.now();
  return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
}

String _dateAfter(int days) {
  final date = DateTime.now().add(Duration(days: days));
  return '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
}

ProviderContainer _makeContainer({bool seedBookable = true}) {
  final container = ProviderContainer(
    overrides: [
      dioProvider.overrideWithValue(MockDio()),
      webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
      deliveryFeeSettingsProvider.overrideWith(
        (ref) async => const DeliveryFeeSettings(
          deliveryFeePerKm: 100,
          priorityFeeAmount: 50,
          extraDestinationSurcharge: 30,
          serviceFeePercent: 10,
        ),
      ),
    ],
  );
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

void _seedSlots(
  ProviderContainer container,
  String date,
  List<DeliverySlot> slots,
) {
  container
      .read(deliverySlotProvider(date).notifier)
      .debugSeedSlotsForTest(slots);
}

void main() {
  testWidgets('renders Express, Standard, Scheduled rows; standard default', (
    tester,
  ) async {
    final container = _makeContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
      ),
    );
    await container.read(deliveryFeeSettingsProvider.future);
    await tester.pumpAndSettle();
    expect(find.text('Express'), findsOneWidget);
    expect(find.text('Standard'), findsOneWidget);
    expect(find.text('Scheduled'), findsOneWidget);
    expect(find.text('Saver'), findsNothing);
    expect(find.text('₱100.00'), findsNWidgets(2));
    expect(find.text('₱150.00'), findsOneWidget);
    expect(
      container.read(checkoutProvider).speedTier,
      DeliverySpeedTier.standard,
    );
  });

  testWidgets('tapping Express updates state to priority tier', (tester) async {
    final container = _makeContainer();
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Express'));
    await tester.pump();
    expect(
      container.read(checkoutProvider).speedTier,
      DeliverySpeedTier.priority,
    );
  });

  testWidgets(
    'standard stays selectable and shows next batch when none is live',
    (tester) async {
      final container = _makeContainer(seedBookable: false);
      addTearDown(container.dispose);
      _seedSlots(container, _today(), const []);
      _seedSlots(container, _dateAfter(1), const [
        DeliverySlot(
          templateId: 9,
          startTime: '09:00:00',
          endTime: '11:00:00',
          capacity: 10,
          bookedCount: 4,
        ),
      ]);
      container
          .read(checkoutProvider.notifier)
          .setSpeedTier(DeliverySpeedTier.priority);

      await tester.pumpWidget(
        UncontrolledProviderScope(
          container: container,
          child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('No slot is open right now'), findsOneWidget);
      expect(
        find.textContaining('Next batch: Tomorrow 09:00-11:00 · 4/10 booked'),
        findsOneWidget,
      );
      await tester.tap(find.text('Standard'));
      await tester.pump();
      expect(
        container.read(checkoutProvider).speedTier,
        DeliverySpeedTier.standard,
      );
    },
  );

  testWidgets('standard preview can use loaded slots beyond tomorrow', (
    tester,
  ) async {
    final container = _makeContainer(seedBookable: false);
    addTearDown(container.dispose);
    _seedSlots(container, _today(), const []);
    _seedSlots(container, _dateAfter(1), const []);
    _seedSlots(container, _dateAfter(2), const [
      DeliverySlot(
        templateId: 12,
        startTime: '14:00:00',
        endTime: '16:00:00',
        capacity: 10,
        bookedCount: 1,
      ),
    ]);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.textContaining('14:00-16:00 · 1/10 booked'), findsOneWidget);
  });

  testWidgets('scheduled flow picks a future date before showing slots', (
    tester,
  ) async {
    final container = _makeContainer(seedBookable: false);
    addTearDown(container.dispose);
    final tomorrow = _dateAfter(1);
    _seedSlots(container, _today(), const []);
    _seedSlots(container, tomorrow, const [
      DeliverySlot(
        templateId: 7,
        startTime: '09:00:00',
        endTime: '11:00:00',
        capacity: 10,
        bookedCount: 2,
      ),
    ]);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: const MaterialApp(home: Scaffold(body: CheckoutSpeedCard())),
      ),
    );
    await tester.pumpAndSettle();

    await tester.tap(find.text('Scheduled'));
    await tester.pumpAndSettle();
    expect(find.byType(CalendarDatePicker), findsOneWidget);

    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.text('09:00 – 11:00'), findsOneWidget);

    await tester.tap(find.text('09:00 – 11:00'));
    await tester.pump();
    await tester.tap(find.textContaining('Confirm'));
    await tester.pumpAndSettle();

    final state = container.read(checkoutProvider);
    expect(state.speedTier, DeliverySpeedTier.scheduled);
    expect(state.scheduledSlot?.templateId, 7);
    expect(state.scheduledSlot?.date, tomorrow);
  });
}
