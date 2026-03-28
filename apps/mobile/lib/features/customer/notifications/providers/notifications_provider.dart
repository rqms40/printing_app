import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

AppNotification _parseNotification(Map<String, dynamic> json) {
  return AppNotification(
    id: json['id'] as String? ?? json['_id'] as String? ?? '',
    userId: json['userId'] as String? ?? '',
    orderId: json['orderId'] as String?,
    title: json['title'] as String? ?? '',
    message: json['message'] as String? ?? '',
    type: json['type'] as String? ?? 'info',
    isRead: json['isRead'] as bool? ?? false,
    createdAt: json['createdAt'] is String
        ? DateTime.parse(json['createdAt'] as String)
        : DateTime.now(),
  );
}

class NotificationsNotifier extends StateNotifier<List<AppNotification>> {
  NotificationsNotifier() : super([]) {
    _fetchNotifications();
  }

  int get unreadCount => state.where((n) => !n.isRead).length;

  Future<void> _fetchNotifications() async {
    try {
      final response = await ApiClient.instance.get('/notifications');
      final data = response.data as List<dynamic>;
      state = data
          .map((json) => _parseNotification(json as Map<String, dynamic>))
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (_) {
      // Offline fallback
      state = MockData.notifications
          .where((n) => n.userId == 'usr_001')
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }
  }

  Future<void> refreshNotifications() async => _fetchNotifications();

  Future<void> markAsRead(String id) async {
    try {
      await ApiClient.instance.patch('/notifications/$id/read');
    } catch (_) {}
    // Update local state regardless
    state = [
      for (final n in state)
        if (n.id == id) n.copyWith(isRead: true) else n,
    ];
  }

  Future<void> markAllAsRead() async {
    try {
      await ApiClient.instance.patch('/notifications/read-all');
    } catch (_) {}
    // Update local state regardless
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
