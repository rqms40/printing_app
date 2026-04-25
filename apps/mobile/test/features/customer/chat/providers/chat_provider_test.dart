import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mockito/annotations.dart';
import 'package:mockito/mockito.dart';
import 'package:dio/dio.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

@GenerateMocks([Dio, WebSocketService])
import 'chat_provider_test.mocks.dart';

void main() {
  group('ChatNotifier', () {
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

    test('initial state has empty conversations, not loading, no error', () {
      final state = container.read(chatProvider);
      expect(state.conversations, hasLength(0));
      expect(state.isLoading, false);
      expect(state.error, null);
    });

    test('loadConversations populates state.conversations', () async {
      when(mockDio.get<List<dynamic>>('/chat/conversations')).thenAnswer(
        (_) async => Response(
          data: [
            {
              'id': 1,
              'customerId': 5,
              'type': 'ai',
              'status': 'open',
              'createdAt': '2026-04-25T10:00:00.000Z',
              'updatedAt': '2026-04-25T10:00:00.000Z',
            },
          ],
          statusCode: 200,
          requestOptions: RequestOptions(path: '/chat/conversations'),
        ),
      );

      final notifier = container.read(chatProvider.notifier);
      await notifier.loadConversations();

      final state = container.read(chatProvider);
      expect(state.conversations, hasLength(1));
      expect(state.conversations.first.type, equals(ConversationType.ai));
      expect(state.isLoading, false);
      expect(state.error, null);
    });

    test('loadConversations sets error on exception', () async {
      when(mockDio.get<List<dynamic>>('/chat/conversations'))
          .thenThrow(DioException(
        requestOptions: RequestOptions(path: '/chat/conversations'),
        message: 'Network error',
      ));

      final notifier = container.read(chatProvider.notifier);
      await notifier.loadConversations();

      final state = container.read(chatProvider);
      expect(state.isLoading, false);
      expect(state.error, isNotNull);
      expect(state.conversations, hasLength(0));
    });

    test('createConversation adds to conversations list', () async {
      when(mockDio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: anyNamed('data'),
      )).thenAnswer(
        (_) async => Response(
          data: {
            'id': 2,
            'customerId': 5,
            'type': 'admin',
            'status': 'open',
            'createdAt': '2026-04-25T10:00:00.000Z',
            'updatedAt': '2026-04-25T10:00:00.000Z',
          },
          statusCode: 201,
          requestOptions: RequestOptions(path: '/chat/conversations'),
        ),
      );

      final notifier = container.read(chatProvider.notifier);
      final conv = await notifier.createConversation(ConversationType.admin);

      expect(conv, isNotNull);
      expect(conv!.type, equals(ConversationType.admin));
      expect(container.read(chatProvider).conversations, hasLength(1));
    });

    test('createConversation with orderId sends orderId in data', () async {
      when(mockDio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: anyNamed('data'),
      )).thenAnswer(
        (_) async => Response(
          data: {
            'id': 3,
            'customerId': 5,
            'type': 'admin',
            'orderId': 42,
            'status': 'open',
            'createdAt': '2026-04-25T10:00:00.000Z',
            'updatedAt': '2026-04-25T10:00:00.000Z',
          },
          statusCode: 201,
          requestOptions: RequestOptions(path: '/chat/conversations'),
        ),
      );

      final notifier = container.read(chatProvider.notifier);
      final conv = await notifier.createConversation(
        ConversationType.admin,
        orderId: 42,
      );

      expect(conv, isNotNull);
      expect(conv!.orderId, equals(42));
    });

    test('createConversation returns null on exception', () async {
      when(mockDio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: anyNamed('data'),
      )).thenThrow(DioException(
        requestOptions: RequestOptions(path: '/chat/conversations'),
        message: 'Network error',
      ));

      final notifier = container.read(chatProvider.notifier);
      final conv = await notifier.createConversation(ConversationType.ai);

      expect(conv, isNull);
      expect(container.read(chatProvider).conversations, hasLength(0));
    });

    test('createConversation prepends to existing conversations', () async {
      // First load some conversations
      when(mockDio.get<List<dynamic>>('/chat/conversations')).thenAnswer(
        (_) async => Response(
          data: [
            {
              'id': 1,
              'customerId': 5,
              'type': 'ai',
              'status': 'open',
              'createdAt': '2026-04-25T10:00:00.000Z',
              'updatedAt': '2026-04-25T10:00:00.000Z',
            },
          ],
          statusCode: 200,
          requestOptions: RequestOptions(path: '/chat/conversations'),
        ),
      );
      await container.read(chatProvider.notifier).loadConversations();
      expect(container.read(chatProvider).conversations, hasLength(1));

      // Then create a new one
      when(mockDio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: anyNamed('data'),
      )).thenAnswer(
        (_) async => Response(
          data: {
            'id': 2,
            'customerId': 5,
            'type': 'admin',
            'status': 'open',
            'createdAt': '2026-04-25T11:00:00.000Z',
            'updatedAt': '2026-04-25T11:00:00.000Z',
          },
          statusCode: 201,
          requestOptions: RequestOptions(path: '/chat/conversations'),
        ),
      );
      final conv = await container.read(chatProvider.notifier).createConversation(
        ConversationType.admin,
      );

      final conversations = container.read(chatProvider).conversations;
      expect(conversations, hasLength(2));
      expect(conversations.first.id, equals(conv!.id)); // new one is first
    });
  });
}
