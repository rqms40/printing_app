import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/sheets/slot_picker_sheet.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

void main() {
  testWidgets('lists available slots and returns chosen ScheduledSlot',
      (tester) async {
    final mockDio = MockDio();
    final mockWs = MockWebSocketService();
    when(mockDio.get<List<dynamic>>(any)).thenAnswer((_) async => Response(
          data: const <dynamic>[],
          statusCode: 200,
          requestOptions: RequestOptions(path: ''),
        ));

    final container = ProviderContainer(overrides: [
      dioProvider.overrideWithValue(mockDio),
      webSocketServiceProvider.overrideWithValue(mockWs),
    ]);
    addTearDown(container.dispose);

    // Keep the autoDispose family member alive across the test so the seed
    // we apply below isn't thrown away before the sheet builds.
    final keepAlive =
        container.listen(deliverySlotProvider('2026-05-01'), (_, __) {});
    addTearDown(keepAlive.close);

    // Pre-create the notifier and seed slots before opening the sheet.
    final notifier =
        container.read(deliverySlotProvider('2026-05-01').notifier);
    notifier.debugSeedSlotsForTest(const [
      DeliverySlot(
        templateId: 7,
        startTime: '09:00:00',
        endTime: '11:00:00',
        capacity: 10,
        bookedCount: 4,
      ),
    ]);

    ScheduledSlot? picked;
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp(
        home: Builder(builder: (ctx) => Scaffold(
          body: ElevatedButton(
            onPressed: () async {
              picked = await SlotPickerSheet.show(ctx, initialDate: '2026-05-01');
            },
            child: const Text('Open'),
          ),
        )),
      ),
    ));
    await tester.tap(find.text('Open'));
    await tester.pumpAndSettle();
    expect(find.text('09:00 – 11:00'), findsOneWidget);
    await tester.tap(find.text('09:00 – 11:00'));
    await tester.pump();
    await tester.tap(find.textContaining('Confirm'));
    await tester.pumpAndSettle();
    expect(picked?.templateId, 7);
  });
}
