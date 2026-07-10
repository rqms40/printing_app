import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/features/customer/tracking/widgets/delivery_map.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

import '../../order/providers/delivery_slot_provider_test.mocks.dart';

class _Harness {
  const _Harness(this.container, this.socket, this.clock, this.widget);

  final ProviderContainer container;
  final MockWebSocketService socket;
  final _TestClock clock;
  final Widget widget;
}

class _TestClock {
  DateTime value = DateTime.utc(2026, 7, 10, 12);

  DateTime call() => value;

  void advance(Duration duration) {
    value = value.add(duration);
  }
}

_Harness _harness(
  LiveDeliveryMapState state, {
  Duration? locationAge,
  LocationSocketHealth health = LocationSocketHealth.connected,
}) {
  final clock = _TestClock();
  final socket = MockWebSocketService();
  when(
    socket.connectLocation(onLocationUpdate: anyNamed('onLocationUpdate')),
  ).thenAnswer((_) async {});
  when(socket.listenForLocationHealth(any)).thenAnswer((invocation) {
    final callback =
        invocation.positionalArguments.first as Function(LocationSocketHealth);
    callback(health);
  });
  final container = ProviderContainer(
    overrides: [
      dioProvider.overrideWithValue(MockDio()),
      webSocketServiceProvider.overrideWithValue(socket),
      deliveryTrackingNowProvider.overrideWithValue(clock.call),
      liveDeliveryMapProvider.overrideWith((_) async => state),
    ],
  );
  container.read(liveRiderLocationProvider.notifier).state = locationAge == null
      ? null
      : _location(locationAge, clock.value);
  addTearDown(container.dispose);
  return _Harness(
    container,
    socket,
    clock,
    UncontrolledProviderScope(
      container: container,
      child: const MaterialApp(home: Scaffold(body: DeliveryMap())),
    ),
  );
}

Future<void> _settle(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 50));
}

LiveDeliveryMapState _active() => LiveDeliveryMapState.active(
  shopPoint: const LatLng(7.064, 125.608),
  destPoint: const LatLng(7.073, 125.613),
  routePoints: const [
    LatLng(7.064, 125.608),
    LatLng(7.068, 125.610),
    LatLng(7.073, 125.613),
  ],
  orderId: 'ORD-TEST-001',
  deliveryAssignmentId: '101',
  planVersion: 4,
  orderStatus: OrderStatus.onTheWay,
  legDurationSeconds: 120,
);

LocationUpdate _location(Duration age, DateTime now) => LocationUpdate(
  id: 'live',
  deliveryAssignmentId: '101',
  planVersion: 4,
  latitude: 7.07,
  longitude: 125.61,
  timestamp: now.subtract(age),
);

void main() {
  group('DeliveryMap widget', () {
    testWidgets('shows loading indicator without an active delivery', (
      tester,
    ) async {
      final harness = _harness(LiveDeliveryMapState.idle());
      await tester.pumpWidget(harness.widget);
      await _settle(tester);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('subscribes with exact assignment and plan version', (
      tester,
    ) async {
      final harness = _harness(_active(), locationAge: Duration.zero);
      await tester.pumpWidget(harness.widget);
      await _settle(tester);

      verify(harness.socket.subscribeToDeliveryPlan('101', 4)).called(1);
      expect(find.text('Live Tracking'), findsOneWidget);
    });

    testWidgets('reevaluates live location into stale while retaining marker', (
      tester,
    ) async {
      final harness = _harness(
        _active(),
        locationAge: const Duration(seconds: 14),
      );
      await tester.pumpWidget(harness.widget);
      await _settle(tester);
      expect(find.text('Live Tracking'), findsOneWidget);

      harness.clock.advance(const Duration(seconds: 2));
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('Location stale'), findsOneWidget);
      expect(find.byType(FlutterMap), findsOneWidget);
    });

    testWidgets('reevaluates stale location into offline and retains marker', (
      tester,
    ) async {
      final harness = _harness(
        _active(),
        locationAge: const Duration(seconds: 60),
      );
      await tester.pumpWidget(harness.widget);
      await _settle(tester);
      expect(find.text('Location stale'), findsOneWidget);

      harness.clock.advance(const Duration(seconds: 2));
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('GPS offline'), findsOneWidget);
      expect(find.byType(FlutterMap), findsOneWidget);
    });

    testWidgets('explicit disconnect is offline even for a fresh marker', (
      tester,
    ) async {
      final harness = _harness(
        _active(),
        locationAge: Duration.zero,
        health: LocationSocketHealth.disconnected,
      );
      await tester.pumpWidget(harness.widget);
      await _settle(tester);

      expect(find.text('GPS offline'), findsOneWidget);
      expect(find.byType(FlutterMap), findsOneWidget);
    });
  });
}
