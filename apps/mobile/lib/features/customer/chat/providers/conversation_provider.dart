import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

class ConversationState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final bool isBotTyping;
  final bool isConnected;
  final String? error;

  const ConversationState({
    this.messages = const [],
    this.isLoading = false,
    this.isBotTyping = false,
    this.isConnected = false,
    this.error,
  });

  ConversationState copyWith({
    List<ChatMessage>? messages,
    bool? isLoading,
    bool? isBotTyping,
    bool? isConnected,
    String? error,
  }) =>
      ConversationState(
        messages: messages ?? this.messages,
        isLoading: isLoading ?? this.isLoading,
        isBotTyping: isBotTyping ?? this.isBotTyping,
        isConnected: isConnected ?? this.isConnected,
        error: error,
      );
}

class ConversationNotifier extends StateNotifier<ConversationState> {
  ConversationNotifier(this._conversationId, this._dio)
      : super(const ConversationState());

  final int _conversationId;
  final Dio _dio;
  final _ws = WebSocketService.instance;
  VoidCallback? _removeBotTypingListener;

  Future<void> initialize() async {
    state = state.copyWith(isLoading: true);
    await _ws.connectChat();
    _ws.joinConversation(_conversationId);
    _ws.listenForChatMessages(_conversationId, _onMessage);
    _removeBotTypingListener = _ws.listenForBotTyping(_onBotTyping);
    await _loadHistory();
    state = state.copyWith(isLoading: false, isConnected: true);
    _ws.emitReadMessages(_conversationId);
  }

  Future<void> _loadHistory() async {
    try {
      final res = await _dio.get<List<dynamic>>(
        '/chat/conversations/$_conversationId/messages',
      );
      final msgs = ((res.data) ?? [])
          .map((e) => ChatMessage.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(messages: msgs);
    } catch (e) {
      state = state.copyWith(error: e.toString());
    }
  }

  void _onMessage(ChatMessage msg) {
    state = state.copyWith(
      messages: [...state.messages, msg],
      isBotTyping: false,
    );
  }

  void _onBotTyping(int conversationId) {
    if (conversationId == _conversationId) {
      state = state.copyWith(isBotTyping: true);
    }
  }

  void sendMessage(String content) {
    if (content.trim().isEmpty) return;
    _ws.sendChatMessage(_conversationId, content.trim());
  }

  void emitTyping() => _ws.emitTyping(_conversationId);

  @visibleForTesting
  Future<void> loadHistoryForTest() => _loadHistory();

  @visibleForTesting
  void onMessageForTest(ChatMessage msg) => _onMessage(msg);

  @visibleForTesting
  void onBotTypingForTest(int conversationId) => _onBotTyping(conversationId);

  @override
  void dispose() {
    _removeBotTypingListener?.call();
    _ws.leaveConversation(_conversationId);
    super.dispose();
  }
}

final conversationProvider = StateNotifierProvider.family<
    ConversationNotifier, ConversationState, int>(
  (ref, conversationId) => ConversationNotifier(
    conversationId,
    ref.read(dioProvider),
  ),
);
