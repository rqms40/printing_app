import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

void main() {
  late WebSocketService service;

  setUp(() {
    service = WebSocketService.instance;
    service.disconnectLocation();
    service.clearDeliveryQueueListenersForTests();
  });

  tearDown(() {
    service.disconnectLocation();
    service.clearDeliveryQueueListenersForTests();
  });

  test('multicasts one location update to home and full tracking owners', () {
    final home = <Map<String, dynamic>>[];
    final full = <Map<String, dynamic>>[];
    final removeHome = service.listenForLocationUpdates(home.add);
    final removeFull = service.listenForLocationUpdates(full.add);

    service.subscribeToDeliveryPlan('42', 3);
    service.dispatchLocationSubscribedForTests({
      'assignmentId': '42',
      'planVersion': 3,
    });
    service.dispatchLocationUpdateForTests({
      'assignmentId': '42',
      'planVersion': 3,
      'latitude': 7.0648,
      'longitude': 125.6087,
      'timestamp': '2026-07-10T12:34:56.789Z',
    });

    expect(home, hasLength(1));
    expect(full, hasLength(1));
    expect(home.single, full.single);
    expect(home.single['timestamp'], '2026-07-10T12:34:56.789Z');
    removeHome();
    removeFull();
  });

  test('rejects location before acknowledgement and stale plan versions', () {
    final updates = <Map<String, dynamic>>[];
    final remove = service.listenForLocationUpdates(updates.add);

    service.subscribeToDeliveryPlan('42', 3);
    service.dispatchLocationUpdateForTests({
      'assignmentId': '42',
      'planVersion': 2,
      'latitude': 7.0648,
      'longitude': 125.6087,
      'timestamp': '2026-07-10T12:34:56.789Z',
    });
    service.dispatchLocationSubscribedForTests({
      'assignmentId': '42',
      'planVersion': 3,
    });
    service.dispatchLocationUpdateForTests({
      'assignmentId': '42',
      'planVersion': 2,
      'latitude': 7.0648,
      'longitude': 125.6087,
      'timestamp': '2026-07-10T12:34:56.789Z',
    });
    service.dispatchLocationUpdateForTests({
      'assignmentId': '99',
      'planVersion': 3,
      'latitude': 7.0648,
      'longitude': 125.6087,
      'timestamp': '2026-07-10T12:34:56.789Z',
    });

    expect(updates, isEmpty);
    expect(service.subscribedLocationPlanVersionForTests, 3);
    remove();
  });

  test('new subscription clears stale acknowledged identity', () {
    service.subscribeToDeliveryPlan('42', 3);
    service.dispatchLocationSubscribedForTests({
      'assignmentId': '42',
      'planVersion': 3,
    });
    expect(service.subscribedLocationAssignmentIdForTests, '42');

    service.subscribeToDeliveryPlan('43', 3);

    expect(service.pendingLocationDeliveryIdForTests, '43');
    expect(service.subscribedLocationAssignmentIdForTests, isNull);
    expect(service.subscribedLocationPlanVersionForTests, isNull);
  });

  test('ignores a late acknowledgement from the previous assignment', () {
    service.subscribeToDeliveryPlan('42', 2);
    service.subscribeToDeliveryPlan('43', 2);

    service.dispatchLocationSubscribedForTests({
      'assignmentId': '42',
      'planVersion': 2,
    });

    expect(service.subscribedLocationAssignmentIdForTests, isNull);

    service.dispatchLocationSubscribedForTests({
      'assignmentId': '43',
      'planVersion': 2,
    });
    expect(service.subscribedLocationAssignmentIdForTests, '43');
  });

  test('assignment switch requests a fresh socket room', () {
    service.subscribeToDeliveryPlan('42', 2);
    service.subscribeToDeliveryPlan('43', 2);

    expect(service.locationSocketRecreateRequestsForTests, 1);
    expect(service.pendingLocationDeliveryIdForTests, '43');
  });

  test(
    'same assignment plan bump clears ack and requests a fresh subscribe',
    () {
      service.subscribeToDeliveryPlan('42', 2);
      service.dispatchLocationSubscribedForTests({
        'assignmentId': '42',
        'planVersion': 2,
      });
      expect(service.subscribedLocationPlanVersionForTests, 2);

      service.subscribeToDeliveryPlan('42', 3);

      expect(service.subscribedLocationPlanVersionForTests, isNull);
      expect(service.pendingLocationPlanVersionForTests, 3);
      service.dispatchLocationSubscribedForTests({
        'assignmentId': '42',
        'planVersion': 2,
      });
      expect(service.subscribedLocationPlanVersionForTests, isNull);
    },
  );

  test('delivery queue promotion is multicast and assignment may be null', () {
    final first = <Map<String, dynamic>>[];
    final second = <Map<String, dynamic>>[];
    final removeFirst = service.listenForDeliveryQueueUpdates(first.add);
    final removeSecond = service.listenForDeliveryQueueUpdates(second.add);

    service.dispatchDeliveryQueueUpdatedForTests({
      'orderId': 7,
      'orderRef': 'ORD-10007',
      'queuePosition': 1,
      'queueSize': 2,
      'canTrackDelivery': false,
      'assignmentId': null,
      'planVersion': 4,
    });

    expect(first.single['assignmentId'], isNull);
    expect(second.single['orderId'], 7);
    removeFirst();
    removeSecond();
  });

  test('location socket reconnect policy is bounded', () {
    expect(service.locationReconnectAttempts, inInclusiveRange(1, 8));
  });

  test(
    'reconnect resubscribes pending identity then fails closed when exhausted',
    () {
      service.subscribeToDeliveryPlan('42', 2);
      service.dispatchLocationSocketConnectedForTests();
      final firstEmitCount = service.locationSubscribeEmitCountForTests;
      expect(firstEmitCount, 1);
      expect(service.locationHealthForTests, LocationSocketHealth.subscribing);

      service.dispatchLocationSocketConnectedForTests();
      expect(service.locationSubscribeEmitCountForTests, firstEmitCount + 1);

      service.dispatchLocationReconnectFailedForTests();
      expect(service.locationHealthForTests, LocationSocketHealth.disconnected);
      expect(service.pendingLocationDeliveryIdForTests, isNull);
      expect(service.subscribedLocationAssignmentIdForTests, isNull);
    },
  );
}
