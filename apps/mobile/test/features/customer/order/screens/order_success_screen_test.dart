import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/screens/order_success_screen.dart';

void main() {
  testWidgets('single-order primary action opens order details directly', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    var ordersListBuilds = 0;
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const OrderSuccessScreen(
            orderRefs: ['ORD-10042'],
            firstOrderId: 42,
          ),
        ),
        GoRoute(
          path: '/customer/orders',
          builder: (_, _) {
            ordersListBuilds++;
            return const Scaffold(body: Text('Orders list'));
          },
        ),
        GoRoute(
          path: '/customer/orders/:id',
          builder: (_, state) => Scaffold(
            body: Text('Order details ${state.pathParameters['id']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(child: MaterialApp.router(routerConfig: router)),
    );
    await tester.pumpAndSettle();

    expect(find.text('View order'), findsOneWidget);

    await tester.tap(find.text('View order'));
    await tester.pumpAndSettle();

    expect(find.text('Order details 42'), findsOneWidget);
    expect(ordersListBuilds, 0);
  });
}
