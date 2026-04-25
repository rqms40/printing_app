import 'package:socket_io_client/socket_io_client.dart' as io;
import 'package:flutter/foundation.dart';
import 'package:printing_app/config/api_config.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'token_storage.dart';

/// Recursively converts `Map<dynamic, dynamic>` and `List<dynamic>` trees
/// (as delivered by socket.io on Flutter web) into fully-typed
/// `Map<String, dynamic>` / `List<dynamic>` so callers can safely cast.
dynamic _normalize(dynamic data) {
  if (data is Map) {
    return Map<String, dynamic>.fromEntries(
      data.entries.map((e) => MapEntry(e.key.toString(), _normalize(e.value))),
    );
  }
  if (data is List) return data.map(_normalize).toList();
  return data;
}

/// Centralized WebSocket service for real-time order and location updates.
class WebSocketService {
  static final instance = WebSocketService._();
  WebSocketService._();

  /// When true, [connectDailyGrid] is a no-op. Set in widget tests that pump
  /// [DailyGridSection] to prevent real socket connection attempts.
  /// MUST be reset to false in tearDownAll to avoid polluting other test files.
  @visibleForTesting
  static bool disableDailyGridSocketForTests = false;

  io.Socket? _ordersSocket;
  io.Socket? _locationSocket;
  io.Socket? _notificationsSocket;
  io.Socket? _dailyGridSocket;
  io.Socket? _chatSocket;
  final Map<int, List<Function(ChatMessage)>> _chatMessageListeners = {};
  final List<Function(int)> _botTypingListeners = [];

  // Callbacks registered before the notifications socket is created
  final List<Function(Map<String, dynamic>)> _pendingNotifListeners = [];

  // Callbacks registered for order updates
  final List<Function(dynamic)> _orderListeners = [];

  String get _baseUrl => kServerUrl;

  Future<void> connectOrders({VoidCallback? onConnect}) async {
    if (_ordersSocket?.connected == true) return;
    if (_ordersSocket != null) {
      _ordersSocket!.connect();
      return;
    }

    final token = await TokenStorage.getToken();
    _ordersSocket = io.io(
      '$_baseUrl/ws/orders',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .disableAutoConnect()
          .build(),
    );
    _ordersSocket!.on('orderUpdate', (data) {
      final normalized = _normalize(data);
      for (final cb in _orderListeners) {
        try {
          cb(normalized);
        } catch (e) {
          debugPrint('WS orderUpdate handler error: $e');
        }
      }
    });
    _ordersSocket!.on('connect', (_) {
      debugPrint('WS Orders connected');
      onConnect?.call();
    });
    _ordersSocket!.on(
      'connect_error',
      (e) => debugPrint('WS Orders error: $e'),
    );
    _ordersSocket!.connect();
  }

  /// Register a callback for incoming `orderUpdate` events.
  void listenForOrderUpdates(Function(dynamic) callback) {
    if (!_orderListeners.contains(callback)) {
      _orderListeners.add(callback);
    }
  }

  void subscribeToOrder(String orderId) {
    _ordersSocket?.emit('subscribe', orderId);
  }

  Future<void> connectLocation({Function(dynamic)? onLocationUpdate}) async {
    final token = await TokenStorage.getToken();
    _locationSocket = io.io(
      '$_baseUrl/ws/location',
      io.OptionBuilder().setTransports(['websocket']).setAuth({
        'token': token ?? '',
      }).build(),
    );
    if (onLocationUpdate != null) {
      _locationSocket!.on('locationUpdate', (data) {
        try {
          onLocationUpdate(_normalize(data));
        } catch (e) {
          debugPrint('WS locationUpdate handler error: $e');
        }
      });
    }
    _locationSocket!.on('connect', (_) => debugPrint('WS Location connected'));
    _locationSocket!.on(
      'connect_error',
      (e) => debugPrint('WS Location error: $e'),
    );
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
    _notificationsSocket!.on(
      'connect',
      (_) => debugPrint('WS Notifications connected'),
    );
    _notificationsSocket!.on(
      'connect_error',
      (e) => debugPrint('WS Notifications error: $e'),
    );
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

  /// Connects to the /ws/daily-grid namespace and listens for [dailyGridUpdated] events.
  ///
  /// [onUpdated] is registered only on the first connection. Subsequent calls
  /// while the socket exists (even if disconnected) reuse the original handler.
  /// Call [disconnectDailyGrid] first to force a fresh connection with a new callback.
  Future<void> connectDailyGrid({required VoidCallback onUpdated}) async {
    if (disableDailyGridSocketForTests) return;
    if (_dailyGridSocket?.connected == true) return;
    if (_dailyGridSocket != null) {
      _dailyGridSocket!.connect();
      return;
    }
    try {
      // No auth required — daily-grid is a public namespace (same as GET /daily-grid).
      _dailyGridSocket = io.io(
        '$_baseUrl/ws/daily-grid',
        io.OptionBuilder()
            .setTransports(['websocket'])
            .disableAutoConnect()
            .build(),
      );
      _dailyGridSocket!.on('dailyGridUpdated', (_) {
        try {
          onUpdated();
        } catch (e) {
          debugPrint('WS dailyGridUpdated handler error: $e');
        }
      });
      _dailyGridSocket!.on(
        'connect',
        (_) => debugPrint('WS DailyGrid connected'),
      );
      _dailyGridSocket!.on(
        'connect_error',
        (e) => debugPrint('WS DailyGrid error: $e'),
      );
      _dailyGridSocket!.connect();
    } catch (e) {
      debugPrint('WS DailyGrid connection error: $e');
      // Connection failure should not crash the app
    }
  }

  void disconnectDailyGrid() {
    _dailyGridSocket?.disconnect();
    _dailyGridSocket = null;
  }

  Future<void> connectChat() async {
    if (_chatSocket?.connected == true) return;
    if (_chatSocket != null) {
      _chatSocket!.connect();
      return;
    }
    final token = await TokenStorage.getToken();
    _chatSocket = io.io(
      '$_baseUrl/ws/chat',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .disableAutoConnect()
          .build(),
    );
    _chatSocket!.on('message-received', (data) {
      _dispatchChatMessage(_normalize(data));
    });
    _chatSocket!.on('bot-response', (data) {
      _dispatchChatMessage(_normalize(data));
    });
    _chatSocket!.on('bot-typing', (data) {
      final d = _normalize(data) as Map<String, dynamic>;
      final convId = d['conversationId'] as int;
      for (final cb in List.of(_botTypingListeners)) {
        try {
          cb(convId);
        } catch (e) {
          debugPrint('WS botTyping error: $e');
        }
      }
    });
    _chatSocket!.on('connect', (_) => debugPrint('WS Chat connected'));
    _chatSocket!.on('connect_error', (e) => debugPrint('WS Chat error: $e'));
    _chatSocket!.connect();
  }

  void _dispatchChatMessage(dynamic data) {
    try {
      final msg = ChatMessage.fromJson(data as Map<String, dynamic>);
      final listeners = _chatMessageListeners[msg.conversationId] ?? [];
      for (final cb in List.of(listeners)) {
        try {
          cb(msg);
        } catch (e) {
          debugPrint('WS chatMsg error: $e');
        }
      }
    } catch (e) {
      debugPrint('WS chat message parse error: $e');
    }
  }

  void joinConversation(int conversationId) {
    _chatSocket?.emit('join-conversation', {'conversationId': conversationId});
  }

  void leaveConversation(int conversationId) {
    _chatSocket?.emit('leave-conversation', {'conversationId': conversationId});
    _chatMessageListeners.remove(conversationId);
  }

  void sendChatMessage(int conversationId, String content) {
    _chatSocket?.emit('send-message', {
      'conversationId': conversationId,
      'content': content,
    });
  }

  void emitTyping(int conversationId) {
    _chatSocket?.emit('typing', {'conversationId': conversationId});
  }

  void emitReadMessages(int conversationId) {
    _chatSocket?.emit('read-messages', {'conversationId': conversationId});
  }

  void listenForChatMessages(
    int conversationId,
    Function(ChatMessage) callback,
  ) {
    _chatMessageListeners.putIfAbsent(conversationId, () => []);
    if (!(_chatMessageListeners[conversationId]!.contains(callback))) {
      _chatMessageListeners[conversationId]!.add(callback);
    }
  }

  void listenForBotTyping(Function(int conversationId) callback) {
    if (!_botTypingListeners.contains(callback)) {
      _botTypingListeners.add(callback);
    }
  }

  void disconnectChat() {
    _chatSocket?.disconnect();
    _chatSocket = null;
    _chatMessageListeners.clear();
    _botTypingListeners.clear();
  }

  void disconnect() {
    _ordersSocket?.disconnect();
    _locationSocket?.disconnect();
    _notificationsSocket?.disconnect();
    _dailyGridSocket?.disconnect();
    _chatSocket?.disconnect();
    _chatSocket = null;
    // Null out so the next connection creates a fresh socket
    // with a new JWT — prevents stale-token room membership after logout.
    _notificationsSocket = null;
    _ordersSocket = null;
    _dailyGridSocket = null;
    _locationSocket = null;
    _chatMessageListeners.clear();
    _botTypingListeners.clear();
  }
}
