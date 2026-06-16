import 'dart:async';

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

  /// When true, [connectOrders] is a no-op. Set in tests that exercise order
  /// listeners without opening a real socket.
  @visibleForTesting
  static bool disableOrdersSocketForTests = false;

  io.Socket? _ordersSocket;
  io.Socket? _locationSocket;
  io.Socket? _notificationsSocket;
  io.Socket? _dailyGridSocket;
  io.Socket? _chatSocket;
  io.Socket? _slotsSocket;
  final Map<int, List<Function(ChatMessage)>> _chatMessageListeners = {};
  final List<Function(int)> _botTypingListeners = [];
  final List<Function(int)> _messagesReadListeners = [];
  final List<Function(Map<String, dynamic>)> _slotUpdatedListeners = [];

  bool get isNotificationsConnected => _notificationsSocket?.connected == true;
  bool get isChatConnected => _chatSocket?.connected == true;

  // Persistent callbacks for notification events. Kept outside the socket so
  // reconnects and token refreshes do not lose UI listeners.
  final List<Function(Map<String, dynamic>)> _notificationListeners = [];

  // Callbacks registered for survey-required events
  final List<Function(Map<String, dynamic>)> _surveyRequiredListeners = [];

  // Callbacks registered for order updates
  final List<Function(dynamic)> _orderListeners = [];

  String get _baseUrl => kServerUrl;

  Future<void> connectOrders({VoidCallback? onConnect}) async {
    if (disableOrdersSocketForTests) {
      onConnect?.call();
      return;
    }
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
      _dispatchOrderUpdate(data);
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

  void _dispatchOrderUpdate(dynamic data) {
    final normalized = _normalize(data);
    for (final cb in List.of(_orderListeners)) {
      try {
        cb(normalized);
      } catch (e) {
        debugPrint('WS orderUpdate handler error: $e');
      }
    }
  }

  @visibleForTesting
  int get orderListenerCountForTests => _orderListeners.length;

  @visibleForTesting
  void dispatchOrderUpdateForTests(dynamic data) {
    _dispatchOrderUpdate(data);
  }

  /// Returns a removal handle — call it in dispose() to unregister the callback.
  VoidCallback listenForOrderUpdates(Function(dynamic) callback) {
    if (!_orderListeners.contains(callback)) {
      _orderListeners.add(callback);
    }
    return () => _orderListeners.remove(callback);
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

  void sendRiderLocation(Map<String, dynamic> location) {
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
    _notificationsSocket!.on('newNotification', _dispatchNotification);
    _notificationsSocket!.on('survey-required', _dispatchSurveyRequired);
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
  /// Safe to call before [connectNotifications] and across reconnects.
  void listenForNewNotifications(Function(Map<String, dynamic>) callback) {
    if (!_notificationListeners.contains(callback)) {
      _notificationListeners.add(callback);
    }
  }

  void _dispatchNotification(dynamic data) {
    final d = _normalize(data);
    if (d is! Map<String, dynamic>) return;
    for (final cb in _notificationListeners) {
      try {
        cb(d);
      } catch (e) {
        debugPrint('WS newNotification handler error: $e');
      }
    }
  }

  void _dispatchSurveyRequired(dynamic data) {
    final d = _normalize(data);
    if (d is! Map<String, dynamic>) return;
    for (final cb in List.of(_surveyRequiredListeners)) {
      try {
        cb(d);
      } catch (e) {
        debugPrint('WS survey-required handler error: $e');
      }
    }
  }

  /// Register a callback for incoming `survey-required` events.
  /// Returns a removal handle — call it to unregister the callback.
  VoidCallback listenForSurveyRequired(Function(Map<String, dynamic>) callback) {
    if (!_surveyRequiredListeners.contains(callback)) {
      _surveyRequiredListeners.add(callback);
    }
    return () => _surveyRequiredListeners.remove(callback);
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

  Future<bool> connectChat() async {
    if (_chatSocket?.connected == true) return true;
    if (_chatSocket != null) {
      final connected = _waitForChatConnection(_chatSocket!);
      _chatSocket!.connect();
      return connected;
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
      try {
        final d = _normalize(data) as Map<String, dynamic>;
        final convId = d['conversationId'] as int;
        for (final cb in List.of(_botTypingListeners)) {
          try {
            cb(convId);
          } catch (e) {
            debugPrint('WS botTyping cb error: $e');
          }
        }
      } catch (e) {
        debugPrint('WS bot-typing parse error: $e');
      }
    });
    _chatSocket!.on('messages-read', (data) {
      try {
        final d = _normalize(data) as Map<String, dynamic>;
        final convId = d['conversationId'] as int;
        for (final cb in List.of(_messagesReadListeners)) {
          try {
            cb(convId);
          } catch (e) {
            debugPrint('WS messagesRead cb error: $e');
          }
        }
      } catch (e) {
        debugPrint('WS messages-read parse error: $e');
      }
    });
    _chatSocket!.on('connect', (_) => debugPrint('WS Chat connected'));
    _chatSocket!.on('connect_error', (e) => debugPrint('WS Chat error: $e'));
    final connected = _waitForChatConnection(_chatSocket!);
    _chatSocket!.connect();
    return connected;
  }

  Future<bool> _waitForChatConnection(io.Socket socket) {
    if (socket.connected) return Future.value(true);

    final completer = Completer<bool>();

    void complete(bool value) {
      if (!completer.isCompleted) completer.complete(value);
    }

    socket.once('connect', (_) => complete(true));
    socket.once('connect_error', (_) => complete(false));

    return completer.future.timeout(
      const Duration(seconds: 5),
      onTimeout: () => socket.connected,
    );
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

  void sendChatMessage(
    int conversationId,
    String content, {
    int? attachmentFileId,
    String? attachmentMimeType,
  }) {
    _chatSocket?.emit('send-message', {
      'conversationId': conversationId,
      'content': content,
      'attachmentFileId': ?attachmentFileId,
      'attachmentMimeType': ?attachmentMimeType,
    });
  }

  void emitTyping(int conversationId) {
    _chatSocket?.emit('typing', {'conversationId': conversationId});
  }

  void emitReadMessages(int conversationId) {
    _chatSocket?.emit('read-messages', {'conversationId': conversationId});
  }

  /// Returns a removal handle — call it in dispose() to unregister the callback.
  VoidCallback listenForChatMessages(
    int conversationId,
    Function(ChatMessage) callback,
  ) {
    _chatMessageListeners.putIfAbsent(conversationId, () => []);
    _chatMessageListeners[conversationId]!.add(callback);
    return () => _chatMessageListeners[conversationId]?.remove(callback);
  }

  /// Returns a removal handle — call it in dispose() to unregister the callback.
  VoidCallback listenForBotTyping(Function(int conversationId) callback) {
    _botTypingListeners.add(callback);
    return () => _botTypingListeners.remove(callback);
  }

  /// Returns a removal handle — call it in dispose() to unregister the callback.
  VoidCallback listenForMessagesRead(Function(int conversationId) callback) {
    _messagesReadListeners.add(callback);
    return () => _messagesReadListeners.remove(callback);
  }

  Future<bool> connectDeliverySlots() async {
    if (_slotsSocket?.connected == true) return true;
    if (_slotsSocket != null) {
      _slotsSocket!.connect();
      return true;
    }
    final token = await TokenStorage.getToken();
    _slotsSocket = io.io(
      '$_baseUrl/ws/delivery-slots',
      io.OptionBuilder()
          .setTransports(['websocket'])
          .setAuth({'token': token ?? ''})
          .disableAutoConnect()
          .build(),
    );
    _slotsSocket!.on('slot-updated', (data) {
      try {
        final d = _normalize(data) as Map<String, dynamic>;
        for (final cb in List.of(_slotUpdatedListeners)) {
          try {
            cb(d);
          } catch (e) {
            debugPrint('WS slot-updated cb error: $e');
          }
        }
      } catch (e) {
        debugPrint('WS slot-updated parse error: $e');
      }
    });
    _slotsSocket!.on('connect', (_) => debugPrint('WS Slots connected'));
    _slotsSocket!.on('connect_error', (e) => debugPrint('WS Slots error: $e'));
    _slotsSocket!.connect();
    return true;
  }

  void subscribeSlots(String date) {
    _slotsSocket?.emit('subscribe-slots', {'date': date});
  }

  void unsubscribeSlots(String date) {
    _slotsSocket?.emit('unsubscribe-slots', {'date': date});
  }

  VoidCallback listenForSlotUpdates(Function(Map<String, dynamic>) cb) {
    _slotUpdatedListeners.add(cb);
    return () => _slotUpdatedListeners.remove(cb);
  }

  void disconnectDeliverySlots() {
    _slotsSocket?.disconnect();
    _slotsSocket = null;
    _slotUpdatedListeners.clear();
  }

  void disconnectChat() {
    _chatSocket?.disconnect();
    _chatSocket = null;
    _chatMessageListeners.clear();
    _botTypingListeners.clear();
    _messagesReadListeners.clear();
  }

  void disconnect() {
    _ordersSocket?.disconnect();
    _locationSocket?.disconnect();
    _notificationsSocket?.disconnect();
    _dailyGridSocket?.disconnect();
    _chatSocket?.disconnect();
    _chatSocket = null;
    _slotsSocket?.disconnect();
    _slotsSocket = null;
    // Null out so the next connection creates a fresh socket
    // with a new JWT — prevents stale-token room membership after logout.
    _notificationsSocket = null;
    _ordersSocket = null;
    _dailyGridSocket = null;
    _locationSocket = null;
    _chatMessageListeners.clear();
    _botTypingListeners.clear();
    _messagesReadListeners.clear();
    _slotUpdatedListeners.clear();
    _orderListeners.clear();
    _surveyRequiredListeners.clear();
  }
}
