import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/customer/notifications/notification_route.dart';
import 'package:printing_app/shared/services/notification_service.dart';

void main() {
  group('riderMessageRouteForPayload', () {
    test(
      'builds the same rider chat route from numeric and FCM string metadata',
      () {
        expect(
          riderMessageRouteForPayload({
            'type': 'rider_message',
            'conversationId': 5,
            'conversationType': 'rider',
          }),
          '/customer/chat/5?type=rider',
        );
        expect(
          riderMessageRouteForPayload({
            'type': 'rider_message',
            'conversationId': '5',
            'conversationType': 'rider',
          }),
          '/customer/chat/5?type=rider',
        );
      },
    );

    test('rejects malformed or unrelated notification metadata', () {
      expect(
        riderMessageRouteForPayload({
          'type': 'rider_message',
          'conversationId': 'bad',
        }),
        isNull,
      );
      expect(
        riderMessageRouteForPayload({
          'type': 'delivery_status',
          'conversationId': 5,
        }),
        isNull,
      );
    });
  });

  test('FCM tap publishes the shared rider conversation route', () async {
    final route = NotificationService.routeStream.first;

    NotificationService.handleNotificationTap({
      'type': 'rider_message',
      'conversationId': '5',
      'conversationType': 'rider',
      'orderId': '42',
      'orderRef': 'ORD-10042',
    });

    await expectLater(route, completion('/customer/chat/5?type=rider'));
  });

  test('terminated-app FCM tap is retained until the router starts', () {
    NotificationService.handleNotificationTap({
      'type': 'rider_message',
      'conversationId': '9',
      'conversationType': 'rider',
    });

    expect(
      NotificationService.takePendingRoute(),
      '/customer/chat/9?type=rider',
    );
    expect(NotificationService.takePendingRoute(), isNull);
  });
}
