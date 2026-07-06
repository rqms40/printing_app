import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:printing_app/shared/models/app_notification.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/notification_service.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'notifications_api.dart';

export 'notifications_api.dart';

String _stringValue(dynamic value) => value?.toString() ?? '';

dynamic _readJsonValue(
  Map<String, dynamic> json,
  String camelKey, [
  String? snakeKey,
]) {
  return json[camelKey] ?? (snakeKey != null ? json[snakeKey] : null);
}

AppNotification _parseNotification(Map<String, dynamic> json) {
  final metadata = json['metadata'] is Map
      ? Map<String, dynamic>.from(json['metadata'] as Map)
      : const <String, dynamic>{};
  final orderRef =
      _readJsonValue(json, 'orderId', 'order_id') ??
      _readJsonValue(json, 'orderRef', 'order_ref') ??
      metadata['orderRef'] ??
      metadata['orderId'];

  return AppNotification(
    id: _stringValue(_readJsonValue(json, 'id')).isNotEmpty
        ? _stringValue(_readJsonValue(json, 'id'))
        : _stringValue(_readJsonValue(json, '_id')),
    userId: _stringValue(_readJsonValue(json, 'userId', 'user_id')),
    orderId: _stringValue(orderRef).isNotEmpty ? _stringValue(orderRef) : null,
    title: _stringValue(_readJsonValue(json, 'title')),
    message: _stringValue(_readJsonValue(json, 'message')),
    type: _stringValue(_readJsonValue(json, 'type')).isNotEmpty
        ? _stringValue(_readJsonValue(json, 'type'))
        : 'info',
    isRead: _readJsonValue(json, 'isRead', 'is_read') as bool? ?? false,
    createdAt: _readJsonValue(json, 'createdAt', 'created_at') is String
        ? DateTime.parse(
            _readJsonValue(json, 'createdAt', 'created_at') as String,
          )
        : DateTime.now(),
    metadata: metadata,
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
  final AudioPlayer _audioPlayer = AudioPlayer();

  StreamSubscription<Map<String, dynamic>>? _fcmSub;

  Future<void> _playNotificationSound() async {
    try {
      await _audioPlayer.play(AssetSource('audio/notification_user.mp3'));
    } catch (_) {}
  }

  bool _loadedFromApi = false;

  void _listenToFcmMessages() {
    _fcmSub?.cancel();
    _fcmSub = NotificationService.messageStream.listen((_) {
      // When WS is active it delivers notifications in real time — suppress
      // FCM foreground handling to prevent duplicate sound + state churn.
      if (WebSocketService.instance.isNotificationsConnected) return;
      _fetchNotifications();
      _playNotificationSound();
    });
  }

  void _listenToWsNotifications() {
    WebSocketService.instance.connectNotifications();
    WebSocketService.instance.listenForNewNotifications((data) {
      final notif = _parseNotification(data);
      // Deduplicate: don't add if already present
      if (!state.any((n) => n.id == notif.id)) {
        state = [notif, ...state];
        _playNotificationSound();
      }
    });
  }

  @override
  void dispose() {
    _fcmSub?.cancel();
    _audioPlayer.dispose();
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
      state =
          MockData.notifications.where((n) => n.userId == 'usr_001').toList()
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
    state = state
        .map((n) => n.id == id ? n.copyWith(isRead: true) : n)
        .toList();
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
