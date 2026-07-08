import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/chat/models/conversation.dart';
import 'package:printing_app/features/customer/chat/providers/conversation_provider.dart';
import 'package:printing_app/features/customer/chat/screens/conversation_screen.dart';

import '../providers/chat_provider_test.mocks.dart';

void main() {
  testWidgets('shows reconnect action after initial socket join failure', (
    tester,
  ) async {
    final mockWs = MockWebSocketService();
    final mockDio = MockDio();
    var connectAttempts = 0;

    when(mockWs.connectChat()).thenAnswer((_) async {
      connectAttempts += 1;
      return connectAttempts > 1;
    });
    when(mockWs.joinConversation(7)).thenReturn(null);
    when(mockWs.listenForChatMessages(7, any)).thenReturn(() {});
    when(mockWs.listenForBotTyping(any)).thenReturn(() {});
    when(mockWs.emitReadMessages(7)).thenReturn(null);
    when(mockWs.leaveConversation(7)).thenReturn(null);

    when(
      mockDio.get<List<dynamic>>('/chat/conversations/7/messages'),
    ).thenAnswer(
      (_) async => Response(
        data: [],
        statusCode: 200,
        requestOptions: RequestOptions(path: '/chat/conversations/7/messages'),
      ),
    );

    final router = GoRouter(
      initialLocation: '/customer/chat/7',
      routes: [
        GoRoute(
          path: '/customer/chat',
          builder: (_, _) => const Scaffold(body: Text('chat list')),
        ),
        GoRoute(
          path: '/customer/chat/:id',
          builder: (_, _) => const ConversationScreen(
            conversationId: 7,
            conversationType: ConversationType.admin,
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          conversationProvider(
            7,
          ).overrideWith((_) => ConversationNotifier(7, mockWs, mockDio)),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Chat is reconnecting'), findsOneWidget);
    verifyNever(mockWs.joinConversation(7));

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();

    verify(mockWs.joinConversation(7)).called(1);
    verify(mockWs.listenForChatMessages(7, any)).called(1);
    verify(mockWs.listenForBotTyping(any)).called(1);
  });

  testWidgets('composer exposes labeled controls and sends text', (
    tester,
  ) async {
    final mockWs = MockWebSocketService();
    final mockDio = MockDio();

    when(mockWs.connectChat()).thenAnswer((_) async => true);
    when(mockWs.isChatConnected).thenReturn(true);
    when(mockWs.joinConversation(7)).thenReturn(null);
    when(mockWs.listenForChatMessages(7, any)).thenReturn(() {});
    when(mockWs.listenForBotTyping(any)).thenReturn(() {});
    when(mockWs.listenForMessagesRead(any)).thenReturn(() {});
    when(mockWs.emitReadMessages(7)).thenReturn(null);
    when(mockWs.emitTyping(7)).thenReturn(null);
    when(mockWs.sendChatMessage(7, 'Hi GridBot')).thenReturn(null);
    when(mockWs.leaveConversation(7)).thenReturn(null);

    when(
      mockDio.get<List<dynamic>>('/chat/conversations/7/messages'),
    ).thenAnswer(
      (_) async => Response(
        data: [],
        statusCode: 200,
        requestOptions: RequestOptions(path: '/chat/conversations/7/messages'),
      ),
    );

    final router = GoRouter(
      initialLocation: '/customer/chat/7',
      routes: [
        GoRoute(
          path: '/customer/chat/:id',
          builder: (_, _) => const ConversationScreen(
            conversationId: 7,
            conversationType: ConversationType.ai,
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          conversationProvider(
            7,
          ).overrideWith((_) => ConversationNotifier(7, mockWs, mockDio)),
        ],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byTooltip('Attach image'), findsOneWidget);
    expect(find.byTooltip('Send message'), findsOneWidget);

    await tester.enterText(find.byType(TextField), 'Hi GridBot');
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Send message'));
    await tester.pump();

    verify(mockWs.sendChatMessage(7, 'Hi GridBot')).called(1);
  });
}
