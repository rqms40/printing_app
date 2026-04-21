import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter/foundation.dart';
import 'package:printing_app/config/api_config.dart';
import 'token_storage.dart';

/// Recursively converts `Map<dynamic, dynamic>` and `List<dynamic>` trees
/// (as delivered by socket.io on Flutter web) into fully-typed
/// `Map<String, dynamic>` / `List<dynamic>` so callers can safely cast.
dynamic _normalize(dynamic data) {
  if (data is Map) {
    return Map<String, dynamic>.fromEntries(
      data.entries.map(
        (e) => MapEntry(e.key.toString(), _normalize(e.value)),
      ),
    );
  }
  if (data is List) return data.map(_normalize).toList();
  return data;
}

/// Centralized WebSocket service for real-time order and location updates.
class WebSocketService {
  static final instance = WebSocketService._();
  WebSocketService._();

  io.Socket? _ordersSocket;
  io.Socket? _locationSocket;
  io.Socket? _notificationsSocket;

  // Callbacks registered before the notifications socket is created
  final List<Function(Map<String, dynamic>)> _pendingNotifListeners = [];

  String get _baseUrl => kServerUrl;

  Future<void> connectOrders({
    required Function(dynamic) onOrderUpdate,
    VoidCallback? onConnect,
  }) async {
    final token = await TokenStorage.getToken();
    _ordersSocket = io.io(
      '$_baseUrl/ws/orders',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .build(),
    );
    _ordersSocket!.on('orderUpdate', (data) => onOrderUpdate(_normalize(data)));
    _ordersSocket!.on('connect', (_) {
      debugPrint('WS Orders connected');
      onConnect?.call();
    });
    _ordersSocket!
        .on('connect_error', (e) => debugPrint('WS Orders error: $e'));
  }

  void subscribeToOrder(String orderId) {
    _ordersSocket?.emit('subscribe', orderId);
  }

  Future<void> connectLocation(
      {required Function(dynamic) onLocationUpdate}) async {
    final token = await TokenStorage.getToken();
    _locationSocket = io.io(
      '$_baseUrl/ws/location',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .build(),
    );
    _locationSocket!.on('locationUpdate', onLocationUpdate);
    _locationSocket!
        .on('connect', (_) => debugPrint('WS Location connected'));
    _locationSocket!
        .on('connect_error', (e) => debugPrint('WS Location error: $e'));
  }

  void subscribeToDelivery(String assignmentId) {
    _locationSocket?.emit('subscribe', assignmentId);
  }

  void sendDriverLocation(Map<String, dynamic> location) {
    _locationSocket?.emit('updateLocation', location);
  }

  void disconnectLocation() {
    _locationSocket?.disconnect();
    _locationSocket = null;
  }

  Future<void> connectNotifications({
    required Function(Map<String, dynamic>) onCreditsUpdate,
  }) async {
    // Already connected — nothing to do
    if (_notificationsSocket?.connected == true) return;
    // Socket exists but disconnected — flush pending listeners then reconnect
    if (_notificationsSocket != null) {
      for (final cb in _pendingNotifListeners) {
        _notificationsSocket!.on('newNotification', (data) {
          final d = _normalize(data);
          if (d is Map<String, dynamic>) cb(d);
        });
      }
      _pendingNotifListeners.clear();
      _notificationsSocket!.connect();
      return;
    }
    final token = await TokenStorage.getToken();
    _notificationsSocket = io.io(
      '$_baseUrl/ws/notifications',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .disableAutoConnect()
          .build(),
    );
    _notificationsSocket!.on('creditsUpdate', (data) {
      final d = _normalize(data);
      if (d is Map<String, dynamic>) onCreditsUpdate(d);
    });
    // Apply any listeners registered before the socket was created
    for (final cb in _pendingNotifListeners) {
      _notificationsSocket!.on('newNotification', (data) {
        final d = _normalize(data);
        if (d is Map<String, dynamic>) cb(d);
      });
    }
    _pendingNotifListeners.clear();
    _notificationsSocket!
        .on('connect', (_) => debugPrint('WS Notifications connected'));
    _notificationsSocket!
        .on('connect_error', (e) => debugPrint('WS Notifications error: $e'));
    _notificationsSocket!.connect();
  }

  /// Register a callback for incoming `newNotification` events.
  /// Safe to call before [connectNotifications] — the listener is queued
  /// and applied once the socket is created.
  void listenForNewNotifications(Function(Map<String, dynamic>) callback) {
    if (_notificationsSocket != null) {
      _notificationsSocket!.on('newNotification', (data) {
        final d = _normalize(data);
        if (d is Map<String, dynamic>) callback(d);
      });
    } else {
      _pendingNotifListeners.add(callback);
    }
  }

  void disconnect() {
    _ordersSocket?.disconnect();
    _locationSocket?.disconnect();
    _notificationsSocket?.disconnect();
    // Null out so the next connectNotifications() creates a fresh socket
    // with a new JWT — prevents stale-token room membership after logout.
    _notificationsSocket = null;
  }
}
