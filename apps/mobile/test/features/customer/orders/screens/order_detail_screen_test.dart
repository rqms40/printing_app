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
    orderStatus: OrderStatus.submitted,
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
    expect(find.text('Rider pending'), findsOneWidget);
    expect(find.text('Chat about this order'), findsNothing);
    expect(find.text('Wrong address'), findsNothing);
    expect(find.text('Landmark: Test'), findsOneWidget);
  });

  testWidgets('renders the API-owned spec snapshot label verbatim', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3000);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final base = _order(
      id: '42',
      orderId: 'ORD-10042',
      paymentMethod: PaymentMethod.gridCredits,
      deliveryAddress: const OrderDeliveryAddress(
        fullAddress: 'Davao City',
        city: 'Davao City',
        latitude: 7.0,
        longitude: 125.0,
      ),
    );
    final order = base.copyWith(
      category: 'future-fabrication',
      items: const [
        OrderLineItem(
          id: '420',
          orderId: 'ORD-10042',
          category: 'future-fabrication',
          categoryName: 'Future Fabrication',
          specs: {'finish': 'matte'},
          specLabels: {'finish': 'UV-DTF / CMYK+W'},
          specDisplayValues: {'finish': 'Matte finish'},
          quantity: 1,
          totalPrice: 2,
        ),
      ],
    );

    await tester.pumpWidget(
      _wrap(const OrderDetailScreen(orderId: '42'), orders: [order]),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('UV-DTF / CMYK+W'), findsOneWidget);
    expect(find.text('Finish'), findsNothing);
    expect(find.text('Matte finish'), findsOneWidget);
  });

  testWidgets('legacy accepted assignment keeps historical commerce cards', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final base = _order(
      id: '77',
      orderId: 'ORD-LEGACY',
      paymentMethod: PaymentMethod.cod,
      deliveryAddress: const OrderDeliveryAddress(
        fullAddress: 'Davao City',
        city: 'Davao City',
        latitude: 7.0,
        longitude: 125.0,
      ),
    );
    final legacy = base.copyWith(
      quoteAssignmentId: 901,
      estimatedCompletionAt: DateTime(2026, 8, 20),
    );

    await tester.pumpWidget(
      _wrap(const OrderDetailScreen(orderId: '77'), orders: [legacy]),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Price Breakdown'), findsOneWidget);
    expect(find.text('Payment'), findsOneWidget);
    expect(find.textContaining('Estimated ready by'), findsOneWidget);
    expect(find.text('Quote accepted'), findsNothing);
  });

  testWidgets('quoted order exposes quote content without an opacity delay', (
    tester,
  ) async {
    final semantics = tester.ensureSemantics();
    tester.view.physicalSize = const Size(1080, 3600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final base = _order(
      id: '88',
      orderId: 'ORD-QUOTE',
      paymentMethod: PaymentMethod.gridCredits,
      deliveryAddress: const OrderDeliveryAddress(
        fullAddress: 'Davao City',
        city: 'Davao City',
        latitude: 7.0,
        longitude: 125.0,
      ),
    );
    final quoted = base.copyWith(
      pricingStatus: PricingStatus.quoted,
      quotedTotalMinor: BigInt.from(7700),
      deliveryFeeMinor: BigInt.from(2700),
      promisedCompletionAt: DateTime.utc(2026, 8, 20),
      quoteAssignmentId: 901,
      orderStatus: OrderStatus.supplierAccepted,
    );

    await tester.pumpWidget(
      _wrap(const OrderDetailScreen(orderId: '88'), orders: [quoted]),
    );
    await tester.pump();

    expect(find.text('Supplier quote'), findsOneWidget);
    expect(find.text('₱77.00'), findsWidgets);
    await tester.pump(const Duration(milliseconds: 600));
    semantics.dispose();
  });
}
