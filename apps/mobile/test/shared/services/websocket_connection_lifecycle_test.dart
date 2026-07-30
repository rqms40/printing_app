import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const secureStorage = MethodChannel(
    'plugins.it_nomads.com/flutter_secure_storage',
  );
  final service = WebSocketService.instance;

  setUp(() {
    service.disconnect();
    service.resetConnectionTestCountersForTests();
    WebSocketService.disableOrdersSocketForTests = false;
    WebSocketService.disableNotificationsSocketForTests = false;
  });

  tearDown(() {
    service.disconnect();
    WebSocketService.disableOrdersSocketForTests = true;
    WebSocketService.disableNotificationsSocketForTests = true;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorage, (call) async => null);
  });

  tearDownAll(() {
    WebSocketService.disableOrdersSocketForTests = false;
    WebSocketService.disableNotificationsSocketForTests = false;
  });

  test('simultaneous order owners share one in-flight token read', () async {
    final token = Completer<String?>();
    var tokenReads = 0;
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(secureStorage, (call) {
          if (call.method != 'read') return Future.value(null);
          tokenReads++;
          return token.future;
        });

    final authConnect = service.connectOrders();
    final ordersConnect = service.connectOrders();
    await Future<void>.delayed(Duration.zero);

    expect(tokenReads, 1);
    WebSocketService.disableOrdersSocketForTests = true;
    token.complete('shared-token');
    await Future.wait([authConnect, ordersConnect]);
    expect(service.ordersSocketCreateCountForTests, 0);
  });

  test(
    'simultaneous notification owners share one in-flight token read',
    () async {
      final token = Completer<String?>();
      var tokenReads = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(secureStorage, (call) {
            if (call.method != 'read') return Future.value(null);
            tokenReads++;
            return token.future;
          });

      final authConnect = service.connectNotifications();
      final notifierConnect = service.connectNotifications();
      await Future<void>.delayed(Duration.zero);

      expect(tokenReads, 1);
      WebSocketService.disableNotificationsSocketForTests = true;
      token.complete('shared-token');
      await Future.wait([authConnect, notifierConnect]);
      expect(service.notificationsSocketCreateCountForTests, 0);
    },
  );

  test(
    'logout invalidates pending order and notification token reads',
    () async {
      final orderToken = Completer<String?>();
      final notificationToken = Completer<String?>();
      var tokenReads = 0;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(secureStorage, (call) {
            if (call.method != 'read') return Future.value(null);
            tokenReads++;
            return tokenReads == 1
                ? orderToken.future
                : notificationToken.future;
          });

      final orderConnect = service.connectOrders();
      final notificationConnect = service.connectNotifications();
      await Future<void>.delayed(Duration.zero);
      expect(tokenReads, 2);

      service.disconnect();
      WebSocketService.disableOrdersSocketForTests = true;
      WebSocketService.disableNotificationsSocketForTests = true;
      orderToken.complete('logged-out-order-token');
      notificationToken.complete('logged-out-notification-token');
      await Future.wait([orderConnect, notificationConnect]);

      expect(service.ordersSocketCreateCountForTests, 0);
      expect(service.notificationsSocketCreateCountForTests, 0);
    },
  );

  test('notification and credit listeners have explicit ownership', () {
    void notification(Map<String, dynamic> _) {}
    void credits(Map<String, dynamic> _) {}

    final removeNotification = service.listenForNewNotifications(notification);
    final removeCredits = service.listenForCreditsUpdate(credits);
    expect(service.notificationListenerCountForTests, 1);
    expect(service.creditsUpdateListenerCountForTests, 1);

    removeNotification();
    removeCredits();
    expect(service.notificationListenerCountForTests, 0);
    expect(service.creditsUpdateListenerCountForTests, 0);
  });
}
