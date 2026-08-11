import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
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

      // Should have the "Mark all as read" button
      expect(find.text('Mark all as read'), findsOneWidget);
    });

    testWidgets('shows grouped notifications with time headers', (
      tester,
    ) async {
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

      // Rider Juan's notification should not appear (usr_002)
      expect(
        find.text(
          'You have been assigned to deliver ORD-10005 to Quezon City.',
        ),
        findsNothing,
      );
    });

    testWidgets('rider message tap marks read and opens the rider conversation', (
      tester,
    ) async {
      final api = _ScreenNotificationsApi();
      final notifier = NotificationsNotifier(api: api);
      final router = GoRouter(
        initialLocation: '/notifications',
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (_, _) => const NotificationsScreen(),
          ),
          GoRoute(
            path: '/customer/chat/:id',
            builder: (_, state) => Text(
              'chat-${state.pathParameters['id']}-${state.uri.queryParameters['type']}',
            ),
          ),
        ],
      );
      addTearDown(router.dispose);

      await tester.pumpWidget(
        ProviderScope(
          overrides: [notificationsProvider.overrideWith((_) => notifier)],
          child: MaterialApp.router(routerConfig: router),
        ),
      );
      await tester.pump(const Duration(seconds: 1));

      await tester.tap(find.text('New message from your rider'));
      await tester.pumpAndSettle();

      expect(api.markedReadIds, ['301']);
      expect(find.text('chat-5-rider'), findsOneWidget);
    });

    testWidgets(
      'malformed rider message metadata remains readable without navigation',
      (tester) async {
        final api = _ScreenNotificationsApi(malformed: true);
        final notifier = NotificationsNotifier(api: api);

        await tester.pumpWidget(
          ProviderScope(
            overrides: [notificationsProvider.overrideWith((_) => notifier)],
            child: MaterialApp(home: const NotificationsScreen()),
          ),
        );
        await tester.pump(const Duration(seconds: 1));

        await tester.tap(find.text('New message from your rider'));
        await tester.pumpAndSettle();

        expect(find.text('New message from your rider'), findsOneWidget);
        expect(api.markedReadIds, ['301']);
        expect(tester.takeException(), isNull);
      },
    );
  });
}

class _ScreenNotificationsApi implements NotificationsApi {
  _ScreenNotificationsApi({this.malformed = false});

  final bool malformed;
  final markedReadIds = <String>[];

  @override
  Future<List<Map<String, dynamic>>> fetchNotifications() async => [
    {
      'id': 301,
      'userId': 7,
      'orderRef': 'ORD-10042',
      'title': 'New message from your rider',
      'message': 'At the gate',
      'type': 'rider_message',
      'isRead': false,
      'createdAt': '2026-07-27T10:00:00.000Z',
      'metadata': {
        'conversationId': malformed ? 'bad' : 5,
        'conversationType': 'rider',
        'orderId': 42,
        'orderRef': 'ORD-10042',
      },
    },
  ];

  @override
  Future<void> markAllAsRead() async {}

  @override
  Future<void> markAsRead(String id) async {
    markedReadIds.add(id);
  }
}
