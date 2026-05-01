import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/chat/screens/chat_list_screen.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../providers/chat_provider_test.mocks.dart';

void main() {
  Future<void> pumpChatList(WidgetTester tester, MockDio mockDio) async {
    when(mockDio.get<List<dynamic>>('/chat/conversations')).thenAnswer(
      (_) async => Response(
        data: [],
        statusCode: 200,
        requestOptions: RequestOptions(path: '/chat/conversations'),
      ),
    );

    final router = GoRouter(
      initialLocation: '/customer/chat',
      routes: [
        GoRoute(
          path: '/customer/home',
          builder: (_, _) => const Scaffold(body: Text('home')),
        ),
        GoRoute(
          path: '/customer/chat',
          builder: (_, _) => const ChatListScreen(),
        ),
        GoRoute(
          path: '/customer/chat/new',
          builder: (_, _) => const Scaffold(body: Text('new chat')),
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

  testWidgets('shows a back action with home fallback', (tester) async {
    final mockDio = MockDio();

    await pumpChatList(tester, mockDio);
    expect(find.text('Conversations'), findsOneWidget);

    await tester.tap(find.byTooltip('Back'));
    await tester.pumpAndSettle();

    expect(find.text('home'), findsOneWidget);
  });

  testWidgets('renders the new chat action and conversations title', (
    tester,
  ) async {
    final mockDio = MockDio();

    await pumpChatList(tester, mockDio);

    expect(find.byTooltip('New chat'), findsOneWidget);
    expect(find.text('Conversations'), findsOneWidget);
  });
}
