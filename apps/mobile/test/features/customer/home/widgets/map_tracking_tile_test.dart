import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';
import 'package:mockito/mockito.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_driver_location_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

import '../../order/providers/delivery_slot_provider_test.mocks.dart';

GoRouter _router() => GoRouter(
  routes: [
    GoRoute(path: '/', builder: (_, _) => const MapTrackingTile()),
    GoRoute(path: '/customer/tracking', builder: (_, _) => const Scaffold()),
  ],
);

String _today() {
  final now = DateTime.now();
  return '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
}

class _TileHarness {
  const _TileHarness({
    required this.container,
    required this.webSocket,
    required this.widget,
    required this.locationHandler,
  });

  final ProviderContainer container;
  final MockWebSocketService webSocket;
  final Widget widget;
  final Function(dynamic)? Function() locationHandler;
}

_TileHarness _harness({
  required LiveDeliveryMapState state,
  List<DeliverySlot> slots = const [],
  LocationUpdate? location,
  Widget Function(Widget child)? childBuilder,
}) {
  final mockWs = MockWebSocketService();
  Function(dynamic)? capturedLocationHandler;
  when(
    mockWs.connectLocation(onLocationUpdate: anyNamed('onLocationUpdate')),
  ).thenAnswer((invocation) async {
    capturedLocationHandler =
        invocation.namedArguments[#onLocationUpdate] as Function(dynamic)?;
  });
  final container = ProviderContainer(
    overrides: [
      dioProvider.overrideWithValue(MockDio()),
      webSocketServiceProvider.overrideWithValue(mockWs),
      liveDeliveryMapProvider.overrideWith((_) async => state),
    ],
  );
  final keepAlive = container.listen(deliverySlotProvider(_today()), (_, _) {});
  container
      .read(deliverySlotProvider(_today()).notifier)
      .debugSeedSlotsForTest(slots);
  container.read(liveDriverLocationProvider.notifier).state = location;
  addTearDown(keepAlive.close);
  addTearDown(container.dispose);
  return _TileHarness(
    container: container,
    webSocket: mockWs,
    widget: UncontrolledProviderScope(
      container: container,
      child: childBuilder == null
          ? MaterialApp.router(routerConfig: _router())
          : MaterialApp(home: childBuilder(const MapTrackingTile())),
    ),
    locationHandler: () => capturedLocationHandler,
  );
}

Widget _wrap(
  LiveDeliveryMapState state, {
  List<DeliverySlot> slots = const [],
  LocationUpdate? location,
}) {
  return _harness(state: state, slots: slots, location: location).widget;
}

Widget _wrapConstrained(
  LiveDeliveryMapState state, {
  List<DeliverySlot> slots = const [],
  LocationUpdate? location,
  double height = 290,
}) {
  return _harness(
    state: state,
    slots: slots,
    location: location,
    childBuilder: (child) => Scaffold(
      body: Align(
        alignment: Alignment.topLeft,
        child: SizedBox(width: 180, height: height, child: child),
      ),
    ),
  ).widget;
}

const _dailySlots = [
  DeliverySlot(
    templateId: 1,
    startTime: '09:30:00',
    endTime: '11:30:00',
    capacity: 10,
    bookedCount: 2,
  ),
  DeliverySlot(
    templateId: 2,
    startTime: '14:00:00',
    endTime: '16:00:00',
    capacity: 10,
    bookedCount: 4,
  ),
  DeliverySlot(
    templateId: 3,
    startTime: '18:00:00',
    endTime: '20:00:00',
    capacity: 10,
    bookedCount: 10,
  ),
];

void main() {
  testWidgets('shows CircularProgressIndicator when loading', (tester) async {
    await tester.pumpWidget(_wrap(LiveDeliveryMapState.loading()));
    await tester.pump(); // let FutureProvider settle
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('shows daily batch progress rows in idle state', (tester) async {
    await tester.pumpWidget(
      _wrap(LiveDeliveryMapState.idle(), slots: _dailySlots),
    );
    await tester.pumpAndSettle();
    expect(find.text('Delivery Status'), findsOneWidget);
    expect(find.text('9:30 - 11:30 AM: 2/10'), findsOneWidget);
    expect(find.text('2:00 - 4:00 PM: 4/10'), findsOneWidget);
    expect(find.text('6:00 - 8:00 PM: 10/10'), findsOneWidget);
    expect(find.text('Live map starts after rider dispatch.'), findsOneWidget);
    expect(find.byType(FlutterMap), findsOneWidget);
  });

  testWidgets('stacks delivery status and map preview as separate panels', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(LiveDeliveryMapState.idle(), slots: _dailySlots),
    );
    await tester.pumpAndSettle();

    final statusPanel = find.byKey(const Key('delivery-status-panel'));
    final mapPanel = find.byKey(const Key('delivery-map-panel'));

    expect(statusPanel, findsOneWidget);
    expect(mapPanel, findsOneWidget);
    expect(
      tester.getTopLeft(mapPanel).dy,
      greaterThan(tester.getBottomLeft(statusPanel).dy),
    );
  });

  testWidgets('aligns panels with the right column Data Grid and Feed bands', (
    tester,
  ) async {
    const tileHeight = 290.0;
    const rightColumnGap = AppSpacing.xs + 2;
    const rightColumnUnit = (tileHeight - (rightColumnGap * 2)) / 7;
    const expectedDataGridBottom = (rightColumnUnit * 4) + rightColumnGap;
    const expectedFeedTop = expectedDataGridBottom + rightColumnGap;

    await tester.pumpWidget(
      _wrapConstrained(
        LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        height: tileHeight,
      ),
    );
    await tester.pumpAndSettle();

    final tileTop = tester.getTopLeft(find.byType(MapTrackingTile)).dy;
    final statusBottom =
        tester
            .getBottomLeft(find.byKey(const Key('delivery-status-panel')))
            .dy -
        tileTop;
    final mapTop =
        tester.getTopLeft(find.byKey(const Key('delivery-map-panel'))).dy -
        tileTop;

    expect(statusBottom, closeTo(expectedDataGridBottom, 0.1));
    expect(mapTop, closeTo(expectedFeedTop, 0.1));
  });

  testWidgets('shows map preview when no batches are scheduled', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(LiveDeliveryMapState.idle()));
    await tester.pumpAndSettle();
    expect(find.text('Delivery Status'), findsOneWidget);
    expect(find.text('No batches scheduled today'), findsOneWidget);
    expect(find.byType(FlutterMap), findsOneWidget);
  });

  testWidgets(
    'keeps batch rows when active order has no matching live location',
    (tester) async {
      final active = LiveDeliveryMapState.active(
        driverPoint: const LatLng(7.20, 125.46),
        shopPoint: const LatLng(7.19, 125.45),
        destPoint: const LatLng(7.21, 125.47),
        routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
        orderId: 'ORD-001',
        deliveryAssignmentId: 'assign-001',
        orderStatus: OrderStatus.onTheWay,
      );
      await tester.pumpWidget(
        _wrap(
          active,
          slots: _dailySlots,
          location: LocationUpdate(
            id: 'live',
            deliveryAssignmentId: 'other-assignment',
            latitude: 7.20,
            longitude: 125.46,
            timestamp: DateTime.now(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('LIVE MAP'), findsNothing);
      expect(find.text('9:30 - 11:30 AM: 2/10'), findsOneWidget);
    },
  );

  testWidgets(
    'shows LIVE MAP badge in active state with matching live location',
    (tester) async {
      final active = LiveDeliveryMapState.active(
        driverPoint: const LatLng(7.20, 125.46),
        shopPoint: const LatLng(7.19, 125.45),
        destPoint: const LatLng(7.21, 125.47),
        routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
        orderId: 'ORD-001',
        deliveryAssignmentId: 'assign-001',
        orderStatus: OrderStatus.onTheWay,
      );
      await tester.pumpWidget(
        _wrap(
          active,
          slots: _dailySlots,
          location: LocationUpdate(
            id: 'live',
            deliveryAssignmentId: 'assign-001',
            latitude: 7.20,
            longitude: 125.46,
            timestamp: DateTime.now(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('LIVE MAP'), findsOneWidget);
      expect(find.text('Order Dispatched'), findsOneWidget);
    },
  );

  testWidgets('subscribes even when a fresh matching location is cached', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      driverPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
      orderId: 'ORD-001',
      deliveryAssignmentId: 'assign-001',
      orderStatus: OrderStatus.onTheWay,
    );
    final harness = _harness(
      state: active,
      slots: _dailySlots,
      location: LocationUpdate(
        id: 'live',
        deliveryAssignmentId: 'assign-001',
        latitude: 7.20,
        longitude: 125.46,
        timestamp: DateTime.now(),
      ),
    );

    await tester.pumpWidget(harness.widget);
    await tester.pumpAndSettle();

    verify(
      harness.webSocket.connectLocation(
        onLocationUpdate: anyNamed('onLocationUpdate'),
      ),
    ).called(1);
    verify(harness.webSocket.subscribeToDelivery('assign-001')).called(1);
  });

  testWidgets(
    'uses subscribed assignment when socket payload omits assignment id',
    (tester) async {
      final active = LiveDeliveryMapState.active(
        driverPoint: const LatLng(7.20, 125.46),
        shopPoint: const LatLng(7.19, 125.45),
        destPoint: const LatLng(7.21, 125.47),
        routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
        orderId: 'ORD-001',
        deliveryAssignmentId: 'assign-001',
        orderStatus: OrderStatus.onTheWay,
      );
      final harness = _harness(state: active, slots: _dailySlots);

      await tester.pumpWidget(harness.widget);
      await tester.pumpAndSettle();
      harness.locationHandler()?.call({
        'latitude': 7.20,
        'longitude': 125.46,
        'timestamp': DateTime.now().toIso8601String(),
      });
      await tester.pumpAndSettle();

      expect(find.text('LIVE MAP'), findsOneWidget);
    },
  );

  testWidgets('rejects stale socket payload timestamps', (tester) async {
    final active = LiveDeliveryMapState.active(
      driverPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
      orderId: 'ORD-001',
      deliveryAssignmentId: 'assign-001',
      orderStatus: OrderStatus.onTheWay,
    );
    final harness = _harness(state: active, slots: _dailySlots);

    await tester.pumpWidget(harness.widget);
    await tester.pumpAndSettle();
    harness.locationHandler()?.call({
      'assignmentId': 'assign-001',
      'latitude': 7.20,
      'longitude': 125.46,
      'timestamp': DateTime.now()
          .subtract(const Duration(minutes: 15))
          .toIso8601String(),
    });
    await tester.pumpAndSettle();

    expect(find.text('LIVE MAP'), findsNothing);
    expect(find.text('9:30 - 11:30 AM: 2/10'), findsOneWidget);
  });

  testWidgets('keeps batch rows when matching live location is stale', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      driverPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
      orderId: 'ORD-001',
      deliveryAssignmentId: 'assign-001',
      orderStatus: OrderStatus.onTheWay,
    );
    await tester.pumpWidget(
      _wrap(
        active,
        slots: _dailySlots,
        location: LocationUpdate(
          id: 'live',
          deliveryAssignmentId: 'assign-001',
          latitude: 7.20,
          longitude: 125.46,
          timestamp: DateTime.now().subtract(const Duration(minutes: 15)),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('LIVE MAP'), findsNothing);
    expect(find.text('9:30 - 11:30 AM: 2/10'), findsOneWidget);
  });
}
