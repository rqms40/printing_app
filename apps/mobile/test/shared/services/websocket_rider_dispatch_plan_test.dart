import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(WebSocketService.instance.disconnect);
  tearDown(WebSocketService.instance.disconnect);

  test('dispatch-plan updates are normalized, validated, and removable', () {
    final received = <Map<String, dynamic>>[];
    final remove = WebSocketService.instance.listenForRiderDispatchPlanUpdates(
      received.add,
    );

    WebSocketService.instance.dispatchRiderDispatchPlanUpdatedForTests({
      'riderProfileId': '10',
      'planId': 501,
      'planVersion': 4,
      'change': 'created',
    });
    for (final malformed in [
      {
        'riderProfileId': 0,
        'planId': 501,
        'planVersion': 4,
        'change': 'created',
      },
      {
        'riderProfileId': 10,
        'planId': -1,
        'planVersion': 4,
        'change': 'created',
      },
      {
        'riderProfileId': 10,
        'planId': 501,
        'planVersion': 0,
        'change': 'created',
      },
      {
        'riderProfileId': 10,
        'planId': 501,
        'planVersion': 4,
        'change': 'deleted',
      },
    ]) {
      WebSocketService.instance.dispatchRiderDispatchPlanUpdatedForTests(
        malformed,
      );
    }

    expect(received, [
      {
        'riderProfileId': 10,
        'planId': 501,
        'planVersion': 4,
        'change': 'created',
      },
    ]);

    remove();
    WebSocketService.instance.dispatchRiderDispatchPlanUpdatedForTests({
      'riderProfileId': 10,
      'planId': 502,
      'planVersion': 5,
      'change': 'reoptimized',
    });
    expect(received, hasLength(1));
  });
}
