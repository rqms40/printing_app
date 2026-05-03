import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/chat/models/chat_message.dart';
import 'package:printing_app/features/customer/chat/widgets/message_bubble.dart';

void main() {
  testWidgets('treats rider messages as outgoing for driver viewers', (
    tester,
  ) async {
    final message = ChatMessage(
      id: 1,
      conversationId: 7,
      senderRole: SenderRole.rider,
      senderId: 12,
      content: 'I am nearby.',
      isRead: false,
      createdAt: DateTime(2026, 5, 2, 10),
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          home: Scaffold(
            body: MessageBubble(
              message: message,
              currentUserRole: SenderRole.rider,
            ),
          ),
        ),
      ),
    );

    expect(
      find.byWidgetPredicate(
        (widget) =>
            widget is Row && widget.mainAxisAlignment == MainAxisAlignment.end,
      ),
      findsWidgets,
    );
  });
}
