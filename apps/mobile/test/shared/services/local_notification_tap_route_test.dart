import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/notification_service.dart';

void main() {
  setUp(NotificationService.takePendingRoute);
  tearDown(NotificationService.takePendingRoute);

  test('a tapped foreground rider message routes to its conversation', () {
    NotificationService.handleLocalNotificationResponse(
      jsonEncode({
        'type': 'rider_message',
        'conversationType': 'rider',
        'conversationId': '512',
        'orderId': '77',
      }),
    );

    expect(
      NotificationService.takePendingRoute(),
      '/customer/chat/512?type=rider',
    );
  });

  test('a non-rider notification produces no route', () {
    NotificationService.handleLocalNotificationResponse(
      jsonEncode({'type': 'order_status', 'orderId': '77'}),
    );

    expect(NotificationService.takePendingRoute(), isNull);
  });

  test('malformed payloads are ignored without throwing', () {
    for (final payload in <String?>[null, '', 'not-json', '[]', '"text"']) {
      expect(
        () => NotificationService.handleLocalNotificationResponse(payload),
        returnsNormally,
      );
      expect(NotificationService.takePendingRoute(), isNull);
    }
  });
}
