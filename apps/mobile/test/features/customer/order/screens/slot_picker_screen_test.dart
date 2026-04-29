import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/order/screens/slot_picker_screen.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';

@GenerateNiceMocks([MockSpec<Dio>(), MockSpec<WebSocketService>()])
import 'slot_picker_screen_test.mocks.dart';

void main() {
  testWidgets('renders three slot cards with capacity bars and a Full state', (tester) async {
    final mockDio = MockDio();
    final mockWs = MockWebSocketService();
    when(mockDio.get<List<dynamic>>(any)).thenAnswer((_) async => Response(
          data: [
            {'templateId': 1, 'startTime': '09:30:00', 'endTime': '11:30:00', 'capacity': 10, 'bookedCount': 8},
            {'templateId': 2, 'startTime': '14:00:00', 'endTime': '16:00:00', 'capacity': 10, 'bookedCount': 10},
            {'templateId': 3, 'startTime': '21:00:00', 'endTime': '23:00:00', 'capacity': 10, 'bookedCount': 0},
          ],
          statusCode: 200,
          requestOptions: RequestOptions(path: ''),
        ));
    when(mockWs.connectDeliverySlots()).thenAnswer((_) async => true);

    await tester.pumpWidget(ProviderScope(
      overrides: [
        dioProvider.overrideWithValue(mockDio),
        webSocketServiceProvider.overrideWithValue(mockWs),
      ],
      child: const MaterialApp(home: SlotPickerScreen(date: '2026-04-30')),
    ));
    await tester.pumpAndSettle();

    expect(find.text('9:30 AM – 11:30 AM'), findsOneWidget);
    expect(find.text('Full'), findsOneWidget); // slot 2 (10/10)
    expect(find.text('8/10 booked'), findsOneWidget);
  });
}
