import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'notifications_api.dart';

export 'notifications_api.dart';

String _stringValue(dynamic value) => value?.toString() ?? '';

AppNotification _parseNotification(Map<String, dynamic> json) {
  return AppNotification(
    id: _stringValue(json['id']).isNotEmpty
        ? _stringValue(json['id'])
        : _stringValue(json['_id']),
    userId: _stringValue(json['userId']),
    orderId: _stringValue(json['orderId']).isNotEmpty
        ? _stringValue(json['orderId'])
        : null,
    title: _stringValue(json['title']),
    message: _stringValue(json['message']),
    type: _stringValue(json['type']).isNotEmpty ? _stringValue(json['type']) : 'info',
    isRead: json['isRead'] as bool? ?? false,
    createdAt: json['createdAt'] is String
        ? DateTime.parse(json['createdAt'] as String)
        : DateTime.now(),
  );
}

class NotificationsNotifier extends StateNotifier<List<AppNotification>> {
  NotificationsNotifier({NotificationsApi? api})
      : _api = api ?? NotificationsApiImpl(),
        super([]) {
    _fetchNotifications();
    _listenToFcmMessages();
    _listenToWsNotifications();
  }

  final NotificationsApi _api;

  StreamSubscription<Map<String, dynamic>>? _fcmSub;

  bool _loadedFromApi = false;

  void _listenToFcmMessages() {
    _fcmSub?.cancel();
    _fcmSub = NotificationService.messageStream.listen((_) {
      _fetchNotifications();
    });
  }

  void _listenToWsNotifications() {
    WebSocketService.instance.listenForNewNotifications((data) {
      final notif = _parseNotification(data);
      // Deduplicate: don't add if already present
      if (!state.any((n) => n.id == notif.id)) {
        state = [notif, ...state];
      }
    });
  }

  @override
  void dispose() {
    _fcmSub?.cancel();
    super.dispose();
  }

  int get unreadCount => state.where((n) => !n.isRead).length;

  bool get usesApiFallback => !_loadedFromApi;

  Future<void> _fetchNotifications() async {
    try {
      final data = await _api.fetchNotifications();
      _loadedFromApi = true;
      state = data.map(_parseNotification).toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    } catch (_) {
      // Offline fallback
      _loadedFromApi = false;
      state = MockData.notifications
          .where((n) => n.userId == 'usr_001')
          .toList()
        ..sort((a, b) => b.createdAt.compareTo(a.createdAt));
    }
  }

  Future<void> refreshNotifications() async => _fetchNotifications();

  Future<void> markAsRead(String id) async {
    if (_loadedFromApi) {
      try {
        await _api.markAsRead(id);
      } catch (_) {}
    }
    state = state.map((n) => n.id == id ? n.copyWith(isRead: true) : n).toList();
  }

  Future<void> markAllAsRead() async {
    if (_loadedFromApi) {
      try {
        await _api.markAllAsRead();
      } catch (_) {}
    }
    state = state.map((n) => n.copyWith(isRead: true)).toList();
  }

  Future<void> clearNotifications() async {
    try {
      await _api.markAllAsRead();
    } catch (_) {}
    state = [];
  }
}

final notificationsApiProvider = Provider<NotificationsApi>(
  (ref) => NotificationsApiImpl(),
);

final notificationsProvider =
    StateNotifierProvider<NotificationsNotifier, List<AppNotification>>(
  (ref) => NotificationsNotifier(api: ref.read(notificationsApiProvider)),
);

/// Convenience provider for unread count.
final unreadNotificationsCountProvider = Provider<int>((ref) {
  return ref.watch(notificationsProvider).where((n) => !n.isRead).length;
});
