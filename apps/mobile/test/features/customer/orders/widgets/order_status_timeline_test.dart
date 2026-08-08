import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/orders/widgets/order_status_timeline.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/order_status_history.dart';

Order _order({
  required OrderStatus status,
  String deliveryOption = 'delivery',
}) {
  final now = DateTime(2026, 8, 6, 12);
  return Order(
    id: '1',
    orderId: 'ORD-1',
    userId: '10',
    category: 'paper',
    quantity: 1,
    totalPrice: 100,
    deliveryFee: 50,
    paymentMethod: PaymentMethod.gridCredits,
    paymentStatus: PaymentStatus.pending,
    orderStatus: status,
    deliveryOption: deliveryOption,
    createdAt: now,
    updatedAt: now,
  );
}

Future<void> _pumpTimeline(
  WidgetTester tester, {
  required Order order,
  List<OrderStatusHistory> history = const [],
}) async {
  // Tall surface so the full marketplace pipeline does not overflow.
  tester.view.physicalSize = const Size(800, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    MaterialApp(
      home: Scaffold(
        body: SingleChildScrollView(
          child: OrderStatusTimeline(
            order: order,
            statusHistory: history,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

Future<void> _disposeTimeline(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pump(const Duration(seconds: 2));
}

void main() {
  testWidgets('shows supplier assigned on the customer progress timeline', (
    tester,
  ) async {
    await _pumpTimeline(
      tester,
      order: _order(status: OrderStatus.supplierAssigned),
    );

    expect(find.text('Supplier assigned'), findsWidgets);
    expect(find.text('Supplier accepted'), findsOneWidget);
    expect(find.text('Awaiting ops payment auth'), findsOneWidget);
    expect(find.text('In production'), findsOneWidget);
    expect(find.text('Ready for dispatch'), findsOneWidget);
    expect(find.text('Rider assigned'), findsOneWidget);

    await _disposeTimeline(tester);
  });

  testWidgets('pickup orders still show delivery process not only Collected', (
    tester,
  ) async {
    await _pumpTimeline(
      tester,
      order: _order(
        status: OrderStatus.supplierAccepted,
        deliveryOption: 'pickup',
      ),
    );

    expect(find.text('Supplier accepted'), findsWidgets);
    expect(find.text('Ready for dispatch'), findsOneWidget);
    // Delivery process must remain visible even when deliveryOption is pickup.
    expect(find.text('Rider assigned'), findsOneWidget);
    expect(find.text('Picked up'), findsOneWidget);
    expect(find.text('Out for delivery'), findsOneWidget);
    expect(find.text('Delivered'), findsOneWidget);
    expect(find.text('Collected'), findsNothing);

    await _disposeTimeline(tester);
  });

  testWidgets('delivery pipeline shows logistics after ready for dispatch', (
    tester,
  ) async {
    await _pumpTimeline(
      tester,
      order: _order(status: OrderStatus.readyForDispatch),
    );

    expect(find.text('Ready for dispatch'), findsWidgets);
    expect(find.text('Rider assigned'), findsOneWidget);
    expect(find.text('Picked up'), findsOneWidget);
    expect(find.text('Out for delivery'), findsOneWidget);
    expect(find.text('Delivered'), findsOneWidget);

    await _disposeTimeline(tester);
  });

  testWidgets('terminal cancelled path is shown', (tester) async {
    await _pumpTimeline(
      tester,
      order: _order(status: OrderStatus.cancelled),
      history: [
        OrderStatusHistory(
          id: 'h1',
          orderId: '1',
          fromStatus: OrderStatus.submitted,
          toStatus: OrderStatus.cancelled,
          createdAt: DateTime(2026, 8, 6, 13),
        ),
      ],
    );

    expect(find.text('Cancelled'), findsOneWidget);
    expect(find.text('Submitted'), findsOneWidget);

    await _disposeTimeline(tester);
  });

  test('customer pipeline always includes supplier matching statuses', () {
    final steps = customerOrderStatusPipeline(isPickup: false);
    expect(steps, contains(OrderStatus.supplierAssigned));
    expect(steps, contains(OrderStatus.supplierAccepted));
    expect(steps, contains(OrderStatus.awaitingPayment));
    expect(steps, contains(OrderStatus.paymentAuthorized));
    expect(OrderStatus.supplierAssigned.displayName, 'Supplier assigned');
    expect(OrderStatus.supplierAccepted.customerSummary, contains('accepted'));
  });

  test('delivery pipeline keeps logistics after ready for dispatch', () {
    final steps = customerOrderStatusPipeline(isPickup: false);
    final readyIdx = steps.indexOf(OrderStatus.readyForDispatch);
    expect(readyIdx, greaterThanOrEqualTo(0));
    expect(steps.sublist(readyIdx), [
      OrderStatus.readyForDispatch,
      OrderStatus.riderAssigned,
      OrderStatus.pickedUp,
      OrderStatus.outForDelivery,
      OrderStatus.delivered,
    ]);
  });

  test('pickup option still uses delivery logistics process', () {
    final steps = customerOrderStatusPipeline(isPickup: true);
    final readyIdx = steps.indexOf(OrderStatus.readyForDispatch);
    expect(readyIdx, greaterThanOrEqualTo(0));
    expect(steps.sublist(readyIdx), [
      OrderStatus.readyForDispatch,
      OrderStatus.riderAssigned,
      OrderStatus.pickedUp,
      OrderStatus.outForDelivery,
      OrderStatus.delivered,
    ]);
    expect(steps, isNot(contains(OrderStatus.collectedByCustomer)));
  });

  test('parses camelCase marketplace statuses from the API', () {
    expect(
      parseMarketplaceOrderStatus('supplierAssigned'),
      OrderStatus.supplierAssigned,
    );
    expect(
      parseMarketplaceOrderStatus('supplier_accepted'),
      OrderStatus.supplierAccepted,
    );
    expect(
      parseMarketplaceOrderStatus('orderPlaced'),
      OrderStatus.submitted,
    );
  });
}
