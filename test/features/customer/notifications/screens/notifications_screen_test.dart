import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/notifications/screens/notifications_screen.dart';

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
  group('NotificationsScreen', () {
    testWidgets('renders notifications list', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      // Wait for skeleton + animations
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // The screen should render the AppBar title
      expect(find.text('Notifications'), findsOneWidget);

      // Should have the "Read all" button
      expect(find.text('Read all'), findsOneWidget);
    });

    testWidgets('shows grouped notifications with time headers', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Should render at least one time group header
      // Mock data has notifications from various dates
      expect(
        find.textContaining(RegExp(r'TODAY|YESTERDAY|THIS WEEK|EARLIER')),
        findsWidgets,
      );
    });

    testWidgets('renders notification messages', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Check that notification titles render
      expect(find.text('Order Placed'), findsOneWidget);
    });

    testWidgets('does not show notifications for other users', (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump(const Duration(milliseconds: 500));

      // Driver Juan's notification should not appear (usr_002)
      expect(
        find.text('You have been assigned to deliver ORD-10005 to Quezon City.'),
        findsNothing,
      );
    });
  });
}
