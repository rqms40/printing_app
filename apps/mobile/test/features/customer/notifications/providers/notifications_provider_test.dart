import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';

import '../../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
  });

  group('NotificationsNotifier', () {
    late NotificationsNotifier notifier;

    setUp(() async {
      notifier = NotificationsNotifier();
      // Wait for async _fetchNotifications to complete (falls back to MockData)
      await Future.delayed(const Duration(milliseconds: 200));
    });

    test('initializes with notifications for usr_001 (API fallback)', () {
      expect(notifier.state, isNotEmpty);
      // MockData filters for userId == 'usr_001'
      for (final n in notifier.state) {
        expect(n.userId, 'usr_001');
      }
    });

    test('notifications are sorted newest first', () {
      for (var i = 0; i < notifier.state.length - 1; i++) {
        expect(
          notifier.state[i].createdAt.isAfter(notifier.state[i + 1].createdAt) ||
              notifier.state[i].createdAt.isAtSameMomentAs(notifier.state[i + 1].createdAt),
          true,
          reason: 'Notification at index $i should be >= notification at index ${i + 1}',
        );
      }
    });

    test('unreadCount returns correct count', () {
      final expectedUnread = notifier.state.where((n) => !n.isRead).length;
      expect(notifier.unreadCount, expectedUnread);
      expect(notifier.unreadCount, greaterThan(0));
    });

    test('markAsRead sets specific notification as read', () async {
      // Find an unread notification
      final unread = notifier.state.firstWhere((n) => !n.isRead);
      final initialUnreadCount = notifier.unreadCount;

      await notifier.markAsRead(unread.id);

      final updated = notifier.state.firstWhere((n) => n.id == unread.id);
      expect(updated.isRead, true);
      expect(notifier.unreadCount, initialUnreadCount - 1);
    });

    test('markAsRead on already-read notification is no-op', () async {
      final alreadyRead = notifier.state.firstWhere((n) => n.isRead);
      final countBefore = notifier.unreadCount;

      await notifier.markAsRead(alreadyRead.id);

      expect(notifier.unreadCount, countBefore);
    });

    test('markAllAsRead sets all notifications as read', () async {
      expect(notifier.unreadCount, greaterThan(0));

      await notifier.markAllAsRead();

      expect(notifier.unreadCount, 0);
      for (final n in notifier.state) {
        expect(n.isRead, true);
      }
    });

    test('refreshNotifications reloads from MockData', () async {
      // Mark all as read first
      await notifier.markAllAsRead();
      expect(notifier.unreadCount, 0);

      // Refresh reloads original data with some unread
      await notifier.refreshNotifications();
      expect(notifier.unreadCount, greaterThan(0));
    });

    test('notification count stays consistent after operations', () async {
      final totalBefore = notifier.state.length;

      // Mark one as read
      final unread = notifier.state.firstWhere((n) => !n.isRead);
      await notifier.markAsRead(unread.id);

      // Total count should not change (only isRead changes)
      expect(notifier.state.length, totalBefore);
    });
  });
}
