import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

void main() {
  testWidgets('RFQ review exposes pending copy without payment or totals', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
        ordersProvider.overrideWith((_) => _RfqOrdersNotifier()),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_rfqItem())
      ..setMode(DeliveryMode.pickup);
    final router = GoRouter(
      routes: [GoRoute(path: '/', builder: (_, _) => const CheckoutScreen())],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pump();

    expect(find.text('Price and turnaround pending review'), findsWidgets);
    expect(find.text('Stock: Matte'), findsOneWidget);
    expect(find.text('Payment method'), findsNothing);
    expect(find.text('Delivery options'), findsNothing);
    expect(find.text('Payment details'), findsNothing);
    expect(find.textContaining('₱0'), findsNothing);
    expect(find.text('Submit quote request'), findsOneWidget);
  });
}

class _RfqOrdersNotifier extends OrdersNotifier {
  _RfqOrdersNotifier() : super(skipBootstrap: true);
  @override
  Future<List<Order>> submitRfq(CheckoutState state) async => const [];
}

CartItem _rfqItem() => CartItem(
  id: 'rfq',
  category: 'flyers',
  categoryName: 'Flyers',
  productSlug: 'flyers',
  quoteRequired: true,
  requiredDate: DateTime(2099, 12, 31),
  catalogServerBacked: true,
  fileName: 'art.pdf',
  fileMetadataId: 41,
  specs: const {'stock': 'matte'},
  specDisplayValues: const {'stock': 'Matte'},
  quantity: 100,
  pageCount: 1,
  createdAt: DateTime(2026),
);
