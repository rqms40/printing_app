import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

class ChatState {
  final List<Conversation> conversations;
  final bool isLoading;
  final String? error;

  static const _keep = Object();

  const ChatState({
    this.conversations = const [],
    this.isLoading = false,
    this.error,
  });

  ChatState copyWith({
    List<Conversation>? conversations,
    bool? isLoading,
    Object? error = _keep,
  }) =>
      ChatState(
        conversations: conversations ?? this.conversations,
        isLoading: isLoading ?? this.isLoading,
        error: identical(error, _keep) ? this.error : error as String?,
      );
}

class ChatNotifier extends StateNotifier<ChatState> {
  ChatNotifier(this._dio) : super(const ChatState());
  final Dio _dio;

  Future<void> loadConversations() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final res = await _dio.get<List<dynamic>>('/chat/conversations');
      final convs = ((res.data) ?? [])
          .map((e) => Conversation.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(conversations: convs, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<Conversation?> createConversation(
    ConversationType type, {
    int? orderId,
  }) async {
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: {
          'type': type.name,
          'orderId': ?orderId,
        },
      );
      final conv = Conversation.fromJson(res.data!);
      state = state.copyWith(conversations: [conv, ...state.conversations]);
      return conv;
    } catch (_) {
      return null;
    }
  }
}

final chatProvider =
    StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  return ChatNotifier(ref.read(dioProvider));
});
