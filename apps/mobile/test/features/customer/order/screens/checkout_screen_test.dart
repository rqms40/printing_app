import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/features/customer/order/screens/order_success_screen.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

void main() {
  testWidgets('renders all 5 cards + footer', (tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
      ],
    );
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
    container
        .read(checkoutProvider.notifier)
        .addItem(
          CartItem(
            id: 'a',
            category: 'paper',
            fileName: 'a.pdf',
            filePath: '/tmp/a.pdf',
            fileSize: 1,
            fileMetadataId: 1,
            quantity: 1,
            pageCount: 1,
            printSubtotal: 100,
            createdAt: DateTime.now(),
          ),
        );
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, _) => const CheckoutScreen()),
        GoRoute(
          path: '/customer/order/new',
          builder: (_, _) => const Scaffold(body: SizedBox()),
        ),
      ],
    );
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Order summary'), findsOneWidget);
    expect(find.text('Delivery options'), findsOneWidget);
    expect(find.text('Payment method'), findsOneWidget);
    expect(find.text('Place Order'), findsOneWidget);
  });

  testWidgets('resets checkout and passes created orders to success route', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final createdOrder = _order(id: 'batch-alpha', orderRef: 'ORD-10042');
    final ordersNotifier = _CheckoutOrdersNotifier([createdOrder]);
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
        ordersProvider.overrideWith((_) => ordersNotifier),
      ],
    );
    addTearDown(container.dispose);
    container.read(checkoutProvider.notifier)
      ..addItem(_cartItem())
      ..setMode(DeliveryMode.pickup)
      ..setPaymentMethod(PaymentMethod.cod);

    OrderSuccessPayload? receivedPayload;
    final router = GoRouter(
      routes: [
        GoRoute(path: '/', builder: (_, _) => const CheckoutScreen()),
        GoRoute(
          path: '/customer/order/success',
          builder: (_, state) {
            receivedPayload = state.extra as OrderSuccessPayload?;
            return const Scaffold(body: Text('Success route'));
          },
        ),
      ],
    );
    addTearDown(router.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
    final placeOrderButton = tester.widget<InkWell>(
      find.widgetWithText(InkWell, 'Place Order'),
    );
    placeOrderButton.onTap!();
    await tester.pumpAndSettle();

    expect(find.text('Success route'), findsOneWidget);
    expect(receivedPayload?.createdOrders.single.id, 'batch-alpha');
    expect(container.read(checkoutProvider).items, isEmpty);
  });

  testWidgets('RFQ review hides payment, speed, and numeric totals', (
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
        ordersProvider.overrideWith((_) => _CheckoutOrdersNotifier(const [])),
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

class _CheckoutOrdersNotifier extends OrdersNotifier {
  _CheckoutOrdersNotifier(this.createdOrders) : super(skipBootstrap: true);

  final List<Order> createdOrders;

  @override
  Future<List<Order>> placeCheckout(CheckoutState state) async => createdOrders;

  @override
  Future<List<Order>> submitRfq(CheckoutState state) async => createdOrders;
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

CartItem _cartItem() => CartItem(
  id: 'a',
  category: 'paper',
  fileName: 'a.pdf',
  filePath: '/tmp/a.pdf',
  fileSize: 1,
  fileMetadataId: 1,
  quantity: 1,
  pageCount: 1,
  printSubtotal: 100,
  createdAt: DateTime(2026, 7, 27),
);

Order _order({required String id, required String orderRef}) {
  final now = DateTime(2026, 7, 27);
  return Order(
    id: id,
    orderId: orderRef,
    userId: '7',
    category: 'paper',
    fileName: 'a.pdf',
    quantity: 1,
    totalPrice: 100,
    deliveryFee: 0,
    paymentMethod: PaymentMethod.gridCredits,
    paymentStatus: PaymentStatus.paid,
    orderStatus: OrderStatus.submitted,
    deliveryOption: 'pickup',
    createdAt: now,
    updatedAt: now,
  );
}
