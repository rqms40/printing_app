import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/screens/order_detail_screen.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

Widget _wrap(Widget child, {required List<Order> orders}) {
  return ProviderScope(
    overrides: [
      ordersProvider.overrideWith(
        (_) => OrdersNotifier(initialState: orders, skipBootstrap: true),
      ),
    ],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

Order _order({
  required String id,
  required String orderId,
  required PaymentMethod paymentMethod,
  required OrderDeliveryAddress deliveryAddress,
}) {
  return Order(
    id: id,
    orderId: orderId,
    userId: '1',
    category: 'paper',
    fileName: '$orderId.pdf',
    quantity: 1,
    totalPrice: 2,
    deliveryFee: 0,
    paymentMethod: paymentMethod,
    paymentStatus: PaymentStatus.pending,
    orderStatus: OrderStatus.orderPlaced,
    deliveryOption: 'delivery',
    deliveryAddress: deliveryAddress,
    createdAt: DateTime(2026, 5, 2, 19),
    updatedAt: DateTime(2026, 5, 2, 19),
  );
}

void main() {
  testWidgets('opens the matching order when route uses public order ref', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final wrongOrder = _order(
      id: '1',
      orderId: 'ORD-10001',
      paymentMethod: PaymentMethod.cod,
      deliveryAddress: const OrderDeliveryAddress(
        fullAddress: 'Wrong address',
        city: 'Davao City',
        latitude: 7.0,
        longitude: 125.0,
      ),
    );
    final targetOrder = _order(
      id: '7',
      orderId: 'ORD-10007',
      paymentMethod: PaymentMethod.gcash,
      deliveryAddress: const OrderDeliveryAddress(
        label: 'Test',
        fullAddress: 'Test',
        city: 'Test',
        landmark: 'Test',
        latitude: 7.0713113,
        longitude: 125.6123279,
      ),
    );

    await tester.pumpWidget(
      _wrap(
        const OrderDetailScreen(orderId: 'ORD-10007'),
        orders: [wrongOrder, targetOrder],
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Order #ORD-10007'), findsOneWidget);
    expect(find.text('GCash'), findsOneWidget);
    expect(find.text('Chat about this order'), findsOneWidget);
    expect(find.text('Wrong address'), findsNothing);
    expect(find.text('Landmark: Test'), findsOneWidget);
  });
}
