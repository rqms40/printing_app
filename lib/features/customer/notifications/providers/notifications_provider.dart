import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

class NotificationsNotifier extends StateNotifier<List<AppNotification>> {
  NotificationsNotifier()
      : super(
          MockData.notifications
              .where((n) => n.userId == 'usr_001')
              .toList()
            ..sort((a, b) => b.createdAt.compareTo(a.createdAt)),
        );

  int get unreadCount => state.where((n) => !n.isRead).length;

  void markAsRead(String id) {
    state = [
      for (final n in state)
        if (n.id == id) n.copyWith(isRead: true) else n,
    ];
  }

  void markAllAsRead() {
    state = [
      for (final n in state) n.copyWith(isRead: true),
    ];
  }
}

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, List<AppNotification>>(
  (ref) => NotificationsNotifier(),
);

/// Convenience provider for unread count.
final unreadNotificationsCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).where((n) => !n.isRead).length;
});
