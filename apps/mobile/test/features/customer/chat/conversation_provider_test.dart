import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockito/mockito.dart';
import 'package:dio/dio.dart';
import 'package:printing_app/features/customer/chat/providers/conversation_provider.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import 'chat_provider_test.mocks.dart'; // reuse MockDio

void main() {
  group('ConversationState', () {
    test('default state has correct initial values', () {
      const state = ConversationState();
      expect(state.messages, hasLength(0));
      expect(state.isLoading, false);
      expect(state.isBotTyping, false);
      expect(state.isConnected, false);
      expect(state.error, null);
    });

    test('copyWith updates only specified fields', () {
      const state = ConversationState();
      final updated = state.copyWith(isLoading: true, isBotTyping: true);
      expect(updated.isLoading, true);
      expect(updated.isBotTyping, true);
      expect(updated.messages, hasLength(0));
      expect(updated.isConnected, false);
      expect(updated.error, null);
    });

    test('copyWith clears error when null passed explicitly via error field', () {
      const state = ConversationState(error: 'some error');
      final updated = state.copyWith(error: null);
      expect(updated.error, null);
    });
  });

  group('ConversationNotifier state logic', () {
    late MockDio mockDio;

    setUp(() {
      mockDio = MockDio();
    });

    test('_onMessage appends message to state and clears isBotTyping', () {
      final notifier = ConversationNotifier(1, mockDio);
      final msg = ChatMessage(
        id: 20,
        conversationId: 1,
        senderRole: SenderRole.bot,
        content: 'Hi there!',
        isRead: false,
        createdAt: DateTime.now(),
      );

      // First set isBotTyping true
      notifier.onBotTypingForTest(1);
      expect(notifier.state.isBotTyping, true);

      // Then a message arrives — should append and clear isBotTyping
      notifier.onMessageForTest(msg);

      expect(notifier.state.messages, hasLength(1));
      expect(notifier.state.messages.first.content, equals('Hi there!'));
      expect(notifier.state.messages.first.senderRole, equals(SenderRole.bot));
      expect(notifier.state.isBotTyping, false);
    });

    test('_onMessage appends multiple messages in order', () {
      final notifier = ConversationNotifier(1, mockDio);

      final msg1 = ChatMessage(
        id: 1,
        conversationId: 1,
        senderRole: SenderRole.customer,
        content: 'Hello',
        isRead: false,
        createdAt: DateTime.now(),
      );
      final msg2 = ChatMessage(
        id: 2,
        conversationId: 1,
        senderRole: SenderRole.bot,
        content: 'World',
        isRead: false,
        createdAt: DateTime.now(),
      );

      notifier.onMessageForTest(msg1);
      notifier.onMessageForTest(msg2);

      expect(notifier.state.messages, hasLength(2));
      expect(notifier.state.messages[0].content, equals('Hello'));
      expect(notifier.state.messages[1].content, equals('World'));
    });

    test('_onBotTyping sets isBotTyping true for matching conversation', () {
      final notifier = ConversationNotifier(1, mockDio);
      notifier.onBotTypingForTest(1);
      expect(notifier.state.isBotTyping, true);
    });

    test('_onBotTyping ignores non-matching conversation', () {
      final notifier = ConversationNotifier(1, mockDio);
      notifier.onBotTypingForTest(99);
      expect(notifier.state.isBotTyping, false);
    });

    test('_loadHistory populates messages from API', () async {
      when(mockDio.get<List<dynamic>>(
        '/chat/conversations/1/messages',
      )).thenAnswer(
        (_) async => Response(
          data: [
            {
              'id': 10,
              'conversationId': 1,
              'senderId': 5,
              'senderRole': 'customer',
              'content': 'Hello',
              'isRead': false,
              'createdAt': '2026-04-25T10:00:00.000Z',
            },
          ],
          statusCode: 200,
          requestOptions:
              RequestOptions(path: '/chat/conversations/1/messages'),
        ),
      );

      final notifier = ConversationNotifier(1, mockDio);
      await notifier.loadHistoryForTest();

      expect(notifier.state.messages, hasLength(1));
      expect(notifier.state.messages.first.content, equals('Hello'));
      expect(
        notifier.state.messages.first.senderRole,
        equals(SenderRole.customer),
      );
    });

    test('_loadHistory sets error on exception', () async {
      when(mockDio.get<List<dynamic>>(
        '/chat/conversations/1/messages',
      )).thenThrow(DioException(
        requestOptions:
            RequestOptions(path: '/chat/conversations/1/messages'),
        message: 'Network error',
      ));

      final notifier = ConversationNotifier(1, mockDio);
      await notifier.loadHistoryForTest();

      expect(notifier.state.messages, hasLength(0));
      expect(notifier.state.error, isNotNull);
    });
  });

  group('ConversationNotifier via provider container', () {
    late MockDio mockDio;
    late ProviderContainer container;

    setUp(() {
      mockDio = MockDio();
      container = ProviderContainer(
        overrides: [
          dioProvider.overrideWithValue(mockDio),
        ],
      );
    });

    tearDown(() => container.dispose());

    test('provider family creates separate notifiers per conversationId', () {
      final notifier1 = container.read(conversationProvider(1).notifier);
      final notifier2 = container.read(conversationProvider(2).notifier);

      // They should be different instances
      expect(identical(notifier1, notifier2), false);
    });

    test('state updates via provider container', () {
      final state = container.read(conversationProvider(1));
      expect(state.messages, hasLength(0));
      expect(state.isConnected, false);
    });
  });
}
