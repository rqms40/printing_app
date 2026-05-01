import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

@GenerateNiceMocks([MockSpec<Dio>(), MockSpec<WebSocketService>()])
import 'delivery_slot_provider_test.mocks.dart';

void main() {
  test('refresh fetches and parses slot list', () async {
    final mockDio = MockDio();
    final mockWs = MockWebSocketService();
    when(mockDio.get<List<dynamic>>('/delivery-slots?date=2026-04-30'))
        .thenAnswer((_) async => Response(
              data: [
                {
                  'templateId': 1,
                  'startTime': '09:30:00',
                  'endTime': '11:30:00',
                  'capacity': 10,
                  'bookedCount': 8,
                },
              ],
              statusCode: 200,
              requestOptions: RequestOptions(path: ''),
            ));
    final container = ProviderContainer(overrides: [
      dioProvider.overrideWithValue(mockDio),
      webSocketServiceProvider.overrideWithValue(mockWs),
    ]);
    addTearDown(container.dispose);

    final notifier =
        container.read(deliverySlotProvider('2026-04-30').notifier);
    await notifier.refresh();

    final state = container.read(deliverySlotProvider('2026-04-30'));
    expect(state.slots, hasLength(1));
    expect(state.slots.first.bookedCount, 8);
  });

  test('applyUpdate mutates a matching slot', () {
    final mockDio = MockDio();
    final mockWs = MockWebSocketService();
    final container = ProviderContainer(overrides: [
      dioProvider.overrideWithValue(mockDio),
      webSocketServiceProvider.overrideWithValue(mockWs),
    ]);
    addTearDown(container.dispose);

    final notifier =
        container.read(deliverySlotProvider('2026-04-30').notifier);
    // Seed state directly via internal cast (test-only)
    notifier.debugSeedSlotsForTest([
      const DeliverySlot(
        templateId: 1,
        startTime: '09:30:00',
        endTime: '11:30:00',
        capacity: 10,
        bookedCount: 8,
      ),
    ]);

    notifier.applyUpdate({
      'templateId': 1,
      'date': '2026-04-30',
      'bookedCount': 9,
    });

    final s = container.read(deliverySlotProvider('2026-04-30'));
    expect(s.slots.first.bookedCount, 9);
  });
}
