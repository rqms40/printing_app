import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/orders/screens/orders_screen.dart';

/// Wraps a widget in a minimal MaterialApp with ProviderScope for testing.
Widget _wrap(Widget child) {
  return ProviderScope(
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
  });
}
