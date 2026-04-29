import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/chat/widgets/floating_chat_button.dart';

void main() {
  testWidgets('order-scoped chat opens the order-aware chat selector', (
    tester,
  ) async {
    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (_, _) => const Scaffold(
            body: Center(child: FloatingChatButton(orderId: 42)),
          ),
        ),
        GoRoute(
          path: '/customer/chat',
          builder: (_, _) => const Scaffold(body: Text('generic chat')),
        ),
        GoRoute(
          path: '/customer/chat/new',
          builder: (_, state) => Scaffold(
            body: Text('order ${state.uri.queryParameters['orderId']}'),
          ),
        ),
      ],
    );

    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    // Floating button is icon-only — tap the FloatingChatButton itself.
    await tester.tap(find.byType(FloatingChatButton));
    await tester.pumpAndSettle();

    expect(find.text('order 42'), findsOneWidget);
    expect(find.text('generic chat'), findsNothing);
  });
}
