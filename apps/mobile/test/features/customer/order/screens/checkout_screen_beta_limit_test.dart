import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/screens/checkout_screen.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/delivery_slot_provider_test.mocks.dart';

class _ThrowingOrdersNotifier extends OrdersNotifier {
  _ThrowingOrdersNotifier(this._error) : super(skipBootstrap: true);

  final Object _error;

  @override
  Future<List<Order>> placeCheckout(CheckoutState state) async {
    throw _error;
  }
}

Future<void> _pumpCheckout(WidgetTester tester, Object error) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  final container = ProviderContainer(
    overrides: [
      dioProvider.overrideWithValue(MockDio()),
      webSocketServiceProvider.overrideWithValue(MockWebSocketService()),
      ordersProvider.overrideWith((ref) => _ThrowingOrdersNotifier(error)),
    ],
  );
  addTearDown(container.dispose);
  final today = DateTime.now();
  final todayStr =
      '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
  container.read(deliverySlotProvider(todayStr).notifier).debugSeedSlotsForTest(
    const [
      DeliverySlot(
        templateId: 1,
        startTime: '00:00:00',
        endTime: '23:59:00',
        capacity: 10,
        bookedCount: 0,
      ),
    ],
  );
  container.read(checkoutProvider.notifier).addItem(
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
  container.read(checkoutProvider.notifier).setMode(DeliveryMode.pickup);
  container
      .read(checkoutProvider.notifier)
      .setPaymentMethod(PaymentMethod.cod);
  final router = GoRouter(
    routes: [
      GoRoute(path: '/', builder: (_, _) => const CheckoutScreen()),
    ],
  );
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  final checkout = container.read(checkoutProvider);
  expect(checkout.items, isNotEmpty, reason: 'cart item missing');
  expect(checkout.paymentMethod, isNotNull, reason: 'payment method missing');
  await tester.tap(find.text('Place Order'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('order-limit 403 shows the friendly beta sheet', (tester) async {
    await _pumpCheckout(tester, const BetaOrderLimitException());
    expect(find.text("You've used your beta order"), findsOneWidget);
    expect(find.textContaining('BetaOrderLimitException'), findsNothing);
  });

  testWidgets('beta_credits_only 403 shows translated copy', (tester) async {
    await _pumpCheckout(
      tester,
      DioException(
        requestOptions: RequestOptions(path: '/orders'),
        response: Response(
          requestOptions: RequestOptions(path: '/orders'),
          statusCode: 403,
          data: {'code': 'beta_credits_only'},
        ),
      ),
    );
    expect(
      find.text(
        'Beta checkout uses Pilot Credits only. '
        'Switch your payment method to Pilot Credits.',
      ),
      findsOneWidget,
    );
  });
}
