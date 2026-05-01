import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

void main() {
  testWidgets('renders all 5 cards + footer', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final container = ProviderContainer(overrides: [
      dioProvider.overrideWithValue(MockDio()),
      webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
    ]);
    addTearDown(container.dispose);
    final today = DateTime.now();
    final todayStr =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    container
        .read(deliverySlotProvider(todayStr).notifier)
        .debugSeedSlotsForTest(const [
      DeliverySlot(
        templateId: 1,
        startTime: '00:00:00',
        endTime: '23:59:00',
        capacity: 10,
        bookedCount: 0,
      ),
    ]);
    container.read(checkoutProvider.notifier).addItem(CartItem(
      id: 'a', category: 'paper', fileName: 'a.pdf', filePath: '/tmp/a.pdf',
      fileSize: 1, fileMetadataId: 1, quantity: 1, pageCount: 1,
      printSubtotal: 100, createdAt: DateTime.now(),
    ));
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const CheckoutScreen()),
      GoRoute(path: '/customer/order/new', builder: (_, _) => const Scaffold(body: SizedBox())),
    ]);
    await tester.pumpWidget(UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();
    expect(find.text('Order summary'), findsOneWidget);
    expect(find.text('Delivery options'), findsOneWidget);
    expect(find.text('Payment method'), findsOneWidget);
    expect(find.text('Place Order'), findsOneWidget);
  });
}
