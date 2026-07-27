import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/screens/order_success_screen.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

void main() {
  testWidgets('shows the created delivery state immediately', (tester) async {
    final order = _order(
      id: 'batch-alpha',
      orderRef: 'ORD-10042',
      deliveryOption: 'delivery',
      assignedSlot: const AssignedDeliverySlot(
        slotTemplateId: 3,
        date: '2026-07-28',
        startTime: '09:00:00',
        endTime: '11:00:00',
      ),
    );

    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(createdOrders: [order]),
    );

    expect(find.text('ORD-10042'), findsOneWidget);
    expect(find.text('Order Placed'), findsOneWidget);
    expect(find.text('Delivery'), findsOneWidget);
    expect(find.textContaining('2026-07-28'), findsOneWidget);
    expect(find.textContaining('09:00'), findsOneWidget);
  });

  testWidgets('uses the stable string route id for order navigation', (
    tester,
  ) async {
    final order = _order(id: 'batch-alpha', orderRef: 'ORD-10042');
    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(createdOrders: [order]),
    );

    await tester.tap(find.text('View order'));
    await tester.pumpAndSettle();

    expect(find.text('Order details batch-alpha'), findsOneWidget);
  });

  testWidgets('shows pickup method and track action when available', (
    tester,
  ) async {
    final order = _order(
      id: 'delivery-beta',
      orderRef: 'ORD-10043',
      deliveryOption: 'pickup',
      canTrackDelivery: true,
    );
    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(createdOrders: [order]),
    );

    expect(find.text('Pickup'), findsOneWidget);
    await tester.tap(find.text('Track delivery'));
    await tester.pumpAndSettle();
    expect(find.text('Tracking delivery-beta'), findsOneWidget);
  });

  testWidgets('shows a multi-order summary and list action', (tester) async {
    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(
        createdOrders: [
          _order(id: '11', orderRef: 'ORD-10011'),
          _order(id: '12', orderRef: 'ORD-10012'),
        ],
      ),
    );

    expect(find.text("We've queued 2 print jobs."), findsOneWidget);
    expect(find.text('ORD-10011'), findsOneWidget);
    expect(find.text('ORD-10012'), findsOneWidget);
    expect(find.text('View orders'), findsOneWidget);
  });

  testWidgets('matches exact orders before shared-batch fallback', (
    tester,
  ) async {
    final snapshots = [
      _order(id: 'line-one', orderRef: 'SNAP-1', batchId: 'batch-shared'),
      _order(id: 'line-two', orderRef: 'SNAP-2', batchId: 'batch-shared'),
    ];
    final notifier = _TestOrdersNotifier([
      _order(id: 'line-one', orderRef: 'LIVE-1', batchId: 'batch-shared'),
      _order(id: 'line-two', orderRef: 'LIVE-2', batchId: 'batch-shared'),
    ]);

    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(createdOrders: snapshots),
      ordersNotifier: notifier,
    );

    expect(find.text('LIVE-1'), findsOneWidget);
    expect(find.text('LIVE-2'), findsOneWidget);
    expect(find.text('SNAP-1'), findsNothing);
    expect(find.text('SNAP-2'), findsNothing);
  });

  testWidgets('reflects a newer provider status without refetching', (
    tester,
  ) async {
    final initial = _order(id: '21', orderRef: 'ORD-10021');
    final notifier = _TestOrdersNotifier([initial]);
    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(createdOrders: [initial]),
      ordersNotifier: notifier,
    );

    expect(find.text('Order Placed'), findsOneWidget);
    notifier.replace([
      initial.copyWith(orderStatus: OrderStatus.printingInProgress),
    ]);
    await tester.pump();

    expect(find.text('Printing in Progress'), findsOneWidget);
  });

  testWidgets('keeps the generic fallback when route payload is absent', (
    tester,
  ) async {
    await _pumpSuccess(tester);

    expect(find.text('Order placed'), findsOneWidget);
    expect(
      find.text("We're on it. We'll notify you when the file is verified."),
      findsOneWidget,
    );
    expect(find.text('Back to home'), findsOneWidget);
  });

  testWidgets('renders malformed short slot times without throwing', (
    tester,
  ) async {
    await _pumpSuccess(
      tester,
      payload: OrderSuccessPayload(
        createdOrders: [
          _order(
            id: 'short-slot',
            orderRef: 'ORD-SHORT',
            assignedSlot: const AssignedDeliverySlot(
              slotTemplateId: 4,
              date: '2026-07-29',
              startTime: '9',
              endTime: '',
            ),
          ),
        ],
      ),
    );

    expect(find.text('2026-07-29 · 9–'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  test('payload snapshots do not retain mutable Order objects', () {
    final sourceOrder = _order(id: 'immutable', orderRef: 'ORD-IMMUTABLE');
    final source = <Order>[sourceOrder];

    final payload = OrderSuccessPayload(createdOrders: source);
    source.clear();

    expect(payload.createdOrders, hasLength(1));
    expect(payload.createdOrders.single, isNot(same(sourceOrder)));
    expect(payload.createdOrders.single.id, 'immutable');
  });
}

class _TestOrdersNotifier extends OrdersNotifier {
  _TestOrdersNotifier(List<Order> initial)
    : super(initialState: initial, skipBootstrap: true);

  void replace(List<Order> orders) => state = orders;
}

Future<void> _pumpSuccess(
  WidgetTester tester, {
  OrderSuccessPayload? payload,
  _TestOrdersNotifier? ordersNotifier,
}) async {
  tester.view.physicalSize = const Size(393, 852);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final notifier = ordersNotifier ?? _TestOrdersNotifier(const []);
  final router = GoRouter(
    initialLocation: '/',
    routes: [
      GoRoute(
        path: '/',
        builder: (_, _) => OrderSuccessScreen(payload: payload),
      ),
      GoRoute(
        path: '/customer/orders',
        builder: (_, _) => const Scaffold(body: Text('Orders list')),
      ),
      GoRoute(
        path: '/customer/orders/:id',
        builder: (_, state) =>
            Scaffold(body: Text('Order details ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/customer/orders/:id/track',
        builder: (_, state) =>
            Scaffold(body: Text('Tracking ${state.pathParameters['id']}')),
      ),
      GoRoute(
        path: '/customer/home',
        builder: (_, _) => const Scaffold(body: Text('Home')),
      ),
    ],
  );
  addTearDown(router.dispose);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [ordersProvider.overrideWith((_) => notifier)],
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
}

Order _order({
  required String id,
  required String orderRef,
  String deliveryOption = 'delivery',
  AssignedDeliverySlot? assignedSlot,
  bool canTrackDelivery = false,
  String? batchId,
}) {
  final now = DateTime(2026, 7, 27);
  return Order(
    id: id,
    orderId: orderRef,
    batchId: batchId,
    userId: '7',
    category: 'paper',
    fileName: 'print.pdf',
    quantity: 1,
    totalPrice: 100,
    deliveryFee: 0,
    paymentMethod: PaymentMethod.gridCredits,
    paymentStatus: PaymentStatus.paid,
    orderStatus: OrderStatus.orderPlaced,
    deliveryOption: deliveryOption,
    assignedSlot: assignedSlot,
    canTrackDelivery: canTrackDelivery,
    createdAt: now,
    updatedAt: now,
  );
}
