import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/chat/screens/chat_select_screen.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/chat_provider_test.mocks.dart';

void main() {
  Future<void> pumpChatSelect(WidgetTester tester, MockDio mockDio) async {
    final router = GoRouter(
      initialLocation: '/customer/chat/new',
      routes: [
        GoRoute(
          path: '/customer/home',
          builder: (_, _) => const Scaffold(body: Text('home')),
        ),
        GoRoute(
          path: '/customer/chat/new',
          builder: (_, _) => const ChatSelectScreen(orderId: 42),
        ),
        GoRoute(
          path: '/customer/chat/:id',
          builder: (_, state) => Scaffold(
            body: Text('conversation ${state.pathParameters['id']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [dioProvider.overrideWithValue(mockDio)],
        child: MaterialApp.router(routerConfig: router),
      ),
    );
    await tester.pumpAndSettle();
  }

  testWidgets('back navigation is disabled while a chat is being created', (
    tester,
  ) async {
    final mockDio = MockDio();
    final createCompleter = Completer<Response<Map<String, dynamic>>>();
    when(
      mockDio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: anyNamed('data'),
      ),
    ).thenAnswer((_) => createCompleter.future);

    await pumpChatSelect(tester, mockDio);
    await tester.tap(find.text('Human Support'));
    await tester.pump();
    expect(find.text('Starting chat…'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await tester.pump();
    expect(find.text('Start a conversation'), findsOneWidget);
    expect(find.text('home'), findsNothing);

    await tester.binding.handlePopRoute();
    await tester.pump();
    expect(find.text('Start a conversation'), findsOneWidget);
    expect(find.text('home'), findsNothing);

    createCompleter.complete(
      Response(
        data: {
          'id': 9,
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
    await tester.pumpAndSettle();
    expect(find.text('conversation 9'), findsOneWidget);
  });

  testWidgets('order-linked chat offers rider support', (tester) async {
    final mockDio = MockDio();

    await pumpChatSelect(tester, mockDio);

    expect(find.text('GridBot AI'), findsOneWidget);
    expect(find.text('Human Support'), findsOneWidget);
    expect(find.text('Rider Support'), findsOneWidget);
  });

  testWidgets('create failure shows a friendly retry message', (tester) async {
    final mockDio = MockDio();
    when(
      mockDio.post<Map<String, dynamic>>(
        '/chat/conversations',
        data: anyNamed('data'),
      ),
    ).thenThrow(
      DioException(
        requestOptions: RequestOptions(path: '/chat/conversations'),
        message: 'SocketException: raw transport details',
      ),
    );

    await pumpChatSelect(tester, mockDio);
    await tester.tap(find.text('GridBot AI'));
    await tester.pumpAndSettle();

    expect(
      find.text('Could not start chat. Please try again.'),
      findsOneWidget,
    );
    expect(find.textContaining('SocketException'), findsNothing);
  });
}
