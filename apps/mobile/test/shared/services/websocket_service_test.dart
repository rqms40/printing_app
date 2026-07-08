import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

void main() {
  tearDown(() {
    WebSocketService.instance.disconnectLocation();
  });

  test('subscribeToDelivery remembers room while location socket connects', () {
    WebSocketService.instance.subscribeToDelivery('42');

    expect(WebSocketService.instance.pendingLocationDeliveryIdForTests, '42');
  });

  test('disconnectLocation clears pending delivery subscription', () {
    WebSocketService.instance.subscribeToDelivery('42');

    WebSocketService.instance.disconnectLocation();

    expect(WebSocketService.instance.pendingLocationDeliveryIdForTests, isNull);
  });
}
