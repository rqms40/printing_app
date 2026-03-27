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
      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pumpAndSettle();

      // The screen should render the AppBar title
      expect(find.text('Notifications'), findsOneWidget);

      // Should have the "Mark All Read" button
      expect(find.text('Mark All Read'), findsOneWidget);

      // Should render at least one notification from mock data
      // Maria (usr_001) has several notifications
      expect(find.text('Order Placed'), findsOneWidget);
    });

    testWidgets('shows unread indicators', (tester) async {
      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pumpAndSettle();

      // Unread notifications should display their titles
      // "Printing Started" is unread in mock data
      expect(find.text('Printing Started'), findsOneWidget);

      // "Driver On the Way" is unread in mock data
      expect(find.text('Driver On the Way'), findsOneWidget);
    });

    testWidgets('renders notification messages', (tester) async {
      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pumpAndSettle();

      // Check that notification messages render
      expect(
        find.textContaining('ORD-10001 has been placed'),
        findsOneWidget,
      );
    });

    testWidgets('does not show notifications for other users', (tester) async {
      await tester.pumpWidget(_wrap(const NotificationsScreen()));
      await tester.pumpAndSettle();

      // Driver Juan's notification should not appear (usr_002)
      expect(
        find.text('You have been assigned to deliver ORD-10005 to Quezon City.'),
        findsNothing,
      );
    });
  });
}
