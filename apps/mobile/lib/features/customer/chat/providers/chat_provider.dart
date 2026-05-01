import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:dio/dio.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

class ChatState {
  final List<Conversation> conversations;
  final bool isLoading;
  final String? error;
  final String? createError;

  static const _keep = Object();

  const ChatState({
    this.conversations = const [],
    this.isLoading = false,
    this.error,
    this.createError,
  });

  ChatState copyWith({
    List<Conversation>? conversations,
    bool? isLoading,
    Object? error = _keep,
    Object? createError = _keep,
  }) => ChatState(
    conversations: conversations ?? this.conversations,
    isLoading: isLoading ?? this.isLoading,
    error: identical(error, _keep) ? this.error : error as String?,
    createError: identical(createError, _keep)
        ? this.createError
        : createError as String?,
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
    state = state.copyWith(createError: null);
    try {
      final res = await _dio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: {'type': type.name, 'orderId': ?orderId},
      );
      final conv = Conversation.fromJson(res.data!);
      state = state.copyWith(conversations: [conv, ...state.conversations]);
      return conv;
    } catch (e) {
      state = state.copyWith(createError: e.toString());
      return null;
    }
  }
}

final chatProvider = StateNotifierProvider<ChatNotifier, ChatState>((ref) {
  return ChatNotifier(ref.read(dioProvider));
});

/// Total unread chat messages across all conversations.
final chatUnreadCountProvider = FutureProvider.autoDispose<int>((ref) async {
  final dio = ref.read(dioProvider);
  try {
    final res = await dio.get<Map<String, dynamic>>('/chat/unread-count');
    return (res.data?['count'] as int?) ?? 0;
  } catch (_) {
    return 0;
  }
});
