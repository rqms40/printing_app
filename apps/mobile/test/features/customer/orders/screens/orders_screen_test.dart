import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/orders/screens/orders_screen.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// Wraps a widget in a minimal MaterialApp with ProviderScope for testing.
Widget _wrap(Widget child, {List<Override>? overrides}) {
  return ProviderScope(
    overrides: overrides ?? const [],
    child: MaterialApp(
      theme: ThemeData(brightness: Brightness.light),
      home: child,
    ),
  );
}

void main() {
  group('OrdersScreen', () {
    testWidgets('renders Active and Completed tabs', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const OrdersScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Active'), findsOneWidget);
      expect(find.text('Completed'), findsOneWidget);
    });

    testWidgets('shows order cards with mock data in Active tab',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const OrdersScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Active tab is shown by default and should contain active order IDs.
      expect(find.text('ORD-10001'), findsOneWidget);
      expect(find.text('ORD-10003'), findsOneWidget);
    });

    testWidgets('shows completed orders when Completed tab is tapped',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const OrdersScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.text('Completed'));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Delivered and cancelled orders should appear.
      expect(find.text('ORD-10006'), findsOneWidget);
      expect(find.text('ORD-10009'), findsOneWidget);
    });

    testWidgets('displays My Orders title', (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const OrdersScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('My Orders'), findsOneWidget);
    });

    testWidgets('moves an order to Completed when its status becomes cancelled',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 1920);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final initialOrders = List<Order>.from(MockData.orders);
      final notifier = OrdersNotifier(
        initialState: initialOrders,
        skipBootstrap: true,
      );

      await tester.pumpWidget(
        _wrap(
          const OrdersScreen(),
          overrides: [
            ordersProvider.overrideWith((_) => notifier),
          ],
        ),
      );
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('ORD-10001'), findsOneWidget);

      notifier.state = [
        for (final order in notifier.state)
          if (order.orderId == 'ORD-10001')
            order.copyWith(
              orderStatus: OrderStatus.cancelled,
              cancelledAt: DateTime.now(),
              updatedAt: DateTime.now(),
            )
          else
            order,
      ];
      await tester.pumpAndSettle();

      expect(find.text('ORD-10001'), findsNothing);

      await tester.tap(find.text('Completed'));
      await tester.pumpAndSettle();

      expect(find.text('ORD-10001'), findsOneWidget);
    });
  });
}
