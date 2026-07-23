import 'dart:async';

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
import 'package:printing_app/features/customer/home/widgets/next_batch_dialog.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/features/customer/tracking/providers/live_rider_location_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/location_update.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

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

/// A minimal in-flight order: enough for the tile to treat the customer as
/// having a delivery on the way (pre-dispatch).
Order _activeOrder() => Order(
  id: '1',
  orderId: 'ORD-TEST-1',
  userId: 'u1',
  category: 'paper',
  quantity: 1,
  totalPrice: 100,
  deliveryFee: 0,
  paymentMethod: PaymentMethod.gridCredits,
  paymentStatus: PaymentStatus.paid,
  orderStatus: OrderStatus.orderPlaced,
  deliveryOption: 'delivery',
  createdAt: DateTime(2026, 1, 1),
  updatedAt: DateTime(2026, 1, 1),
);

_TileHarness _harness({
  required LiveDeliveryMapState state,
  List<DeliverySlot> slots = const [],
  LocationUpdate? location,
  LocationSocketHealth socketHealth = LocationSocketHealth.connected,
  BookedSlotInfo? booked,
  NextBatchInfo? nextBatch,
  List<Order> activeOrders = const [],
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
  when(mockWs.listenForLocationHealth(any)).thenAnswer((invocation) {
    final callback =
        invocation.positionalArguments.first as Function(LocationSocketHealth);
    callback(socketHealth);
  });
  final container = ProviderContainer(
    overrides: [
      dioProvider.overrideWithValue(MockDio()),
      webSocketServiceProvider.overrideWithValue(mockWs),
      liveDeliveryMapProvider.overrideWith((_) async => state),
      bookedDeliverySlotProvider.overrideWith((_) => booked),
      nextBatchInfoProvider.overrideWith((_) => nextBatch),
      activeOrdersProvider.overrideWith((_) => activeOrders),
    ],
  );
  final keepAlive = container.listen(deliverySlotProvider(_today()), (_, _) {});
  container
      .read(deliverySlotProvider(_today()).notifier)
      .debugSeedSlotsForTest(slots);
  container.read(liveRiderLocationProvider.notifier).state = location;
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
  List<Order> activeOrders = const [],
}) {
  return _harness(
    state: state,
    slots: slots,
    location: location,
    activeOrders: activeOrders,
  ).widget;
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

Finder _semanticsLabel(String label) => find.byWidgetPredicate(
  (widget) => widget is Semantics && widget.properties.label == label,
);

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

const _extraDailySlots = [
  ..._dailySlots,
  DeliverySlot(
    templateId: 4,
    startTime: '20:00:00',
    endTime: '21:00:00',
    capacity: 10,
    bookedCount: 1,
  ),
  DeliverySlot(
    templateId: 5,
    startTime: '21:00:00',
    endTime: '22:00:00',
    capacity: 10,
    bookedCount: 0,
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
      _wrap(
        LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        activeOrders: [_activeOrder()],
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Delivery Status'), findsOneWidget);
    expect(find.text('9:30 - 11:30 AM'), findsOneWidget);
    expect(find.text('2/10'), findsOneWidget);
    expect(find.text('2:00 - 4:00 PM'), findsOneWidget);
    expect(find.text('4/10'), findsOneWidget);
    expect(find.text('6:00 - 8:00 PM'), findsOneWidget);
    expect(find.text('10/10'), findsOneWidget);
    expect(find.text('Live map starts after rider dispatch.'), findsOneWidget);
    expect(find.byType(FlutterMap), findsOneWidget);
  });

  testWidgets('invites ordering when idle with no order in flight', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(LiveDeliveryMapState.idle(), slots: _dailySlots),
    );
    await tester.pumpAndSettle();
    expect(
      find.text('No delivery in progress — track your rider here once you order.'),
      findsOneWidget,
    );
    expect(find.text('Live map starts after rider dispatch.'), findsNothing);
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

  testWidgets('compacts idle delivery status so no empty card gap remains', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrapConstrained(
        LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        height: 290,
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

    expect(statusBottom, lessThan(165));
    expect(mapTop, closeTo(statusBottom + AppSpacing.sm, 0.1));
  });

  testWidgets('gives the delivery status panel comfortable interior padding', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrapConstrained(
        LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        height: 290,
      ),
    );
    await tester.pumpAndSettle();

    final panel = find.byKey(const Key('delivery-status-panel'));
    final paddedContainer = find.descendant(
      of: panel,
      matching: find.byWidgetPredicate(
        (widget) => widget is Container && widget.padding != null,
      ),
    );

    final container = tester.widget<Container>(paddedContainer.first);
    final padding = container.padding! as EdgeInsets;
    expect(padding.left, greaterThanOrEqualTo(AppSpacing.md));
    expect(padding.top, greaterThanOrEqualTo(AppSpacing.md));
  });

  testWidgets('keeps breathing room between title and first delivery slot', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrapConstrained(
        LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        height: 310,
      ),
    );
    await tester.pumpAndSettle();

    final titleBottom = tester.getBottomLeft(find.text('Delivery Status')).dy;
    final firstSlotTop = tester.getTopLeft(find.text('9:30 - 11:30 AM')).dy;

    expect(firstSlotTop - titleBottom, greaterThanOrEqualTo(AppSpacing.md));
  });

  testWidgets('offers view more instead of cramming extra delivery slots', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrapConstrained(
        LiveDeliveryMapState.idle(),
        slots: _extraDailySlots,
        height: 290,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('View more'), findsOneWidget);
    expect(find.text('8:00 - 9:00 PM'), findsNothing);
    expect(find.text('9:00 - 10:00 PM'), findsNothing);

    await tester.tap(find.text('View more'));
    await tester.pumpAndSettle();

    expect(find.text("Today's delivery slots"), findsOneWidget);
    expect(find.text('8:00 - 9:00 PM'), findsOneWidget);
    expect(find.text('9:00 - 10:00 PM'), findsOneWidget);
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
    'prioritizes dispatch status when active order has no matching live location',
    (tester) async {
      final active = LiveDeliveryMapState.active(
        riderPoint: const LatLng(7.20, 125.46),
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
            planVersion: 1,
            latitude: 7.20,
            longitude: 125.46,
            timestamp: DateTime.now(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('LIVE MAP'), findsNothing);
      expect(find.text('Order Dispatched'), findsOneWidget);
      expect(find.text('Rider is on the way'), findsOneWidget);
      expect(find.text('9:30 - 11:30 AM'), findsNothing);
    },
  );

  testWidgets('later route stop shows queue position without tracking access', (
    tester,
  ) async {
    final queued = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: const [LatLng(7.19, 125.45), LatLng(7.21, 125.47)],
      orderId: 'ORD-SECOND',
      deliveryAssignmentId: null,
      orderStatus: OrderStatus.onTheWay,
      queuePosition: 2,
      queueSize: 2,
      canTrackDelivery: false,
    );
    final harness = _harness(state: queued, slots: _dailySlots);

    await tester.pumpWidget(harness.widget);
    await tester.pumpAndSettle();

    expect(find.text('2nd of 2 in queue'), findsOneWidget);
    expect(find.text('Standby for your turn'), findsOneWidget);
    expect(find.text('Order Dispatched'), findsOneWidget);
    expect(find.text('Live map starts after Stop 1!'), findsOneWidget);
    expect(find.text('Open live tracking'), findsNothing);
    expect(find.byKey(const Key('pending-route-preview-map')), findsNothing);
    expect(_semanticsLabel('Live delivery map'), findsNothing);
    expect(_semanticsLabel('Rider current location marker'), findsNothing);
    expect(find.byKey(const Key('live-delivery-map')), findsNothing);
    expect(
      find.byKey(const Key('rider-current-location-marker')),
      findsNothing,
    );
    verifyNever(harness.webSocket.subscribeToDeliveryPlan('assign-001', 1));
  });

  testWidgets('queued tile keeps the queue label visible at tile height', (
    tester,
  ) async {
    final queued = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: const [LatLng(7.19, 125.45), LatLng(7.21, 125.47)],
      orderId: 'ORD-SECOND',
      deliveryAssignmentId: null,
      orderStatus: OrderStatus.onTheWay,
      queuePosition: 2,
      queueSize: 2,
      canTrackDelivery: false,
    );
    await tester.pumpWidget(
      _wrapConstrained(queued, slots: _dailySlots, height: 380),
    );
    await tester.pumpAndSettle();

    expect(tester.takeException(), isNull);
    expect(find.text('2nd of 2 in queue'), findsOneWidget);
    expect(find.text('Order Dispatched'), findsOneWidget);
  });

  testWidgets(
    'uses pending space for a route preview map when GPS is pending',
    (tester) async {
      final active = LiveDeliveryMapState.active(
        riderPoint: const LatLng(7.20, 125.46),
        shopPoint: const LatLng(7.19, 125.45),
        destPoint: const LatLng(7.21, 125.47),
        routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
        orderId: 'ORD-001',
        deliveryAssignmentId: 'assign-001',
        orderStatus: OrderStatus.onTheWay,
      );

      await tester.pumpWidget(
        _wrapConstrained(active, slots: _dailySlots, height: 290),
      );
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('delivery-status-panel')), findsOneWidget);
      expect(find.byKey(const Key('delivery-map-panel')), findsNothing);
      expect(
        find.byKey(const Key('pending-route-preview-map')),
        findsOneWidget,
      );
      expect(find.text('Waiting for rider location...'), findsNothing);
      expect(find.text('Rider GPS reconnecting'), findsOneWidget);
      expect(find.text('Open live tracking'), findsOneWidget);
      expect(_semanticsLabel('Open live tracking'), findsOneWidget);
      expect(
        tester
            .widget<Semantics>(_semanticsLabel('Open live tracking'))
            .container,
        isTrue,
      );
      expect(
        tester
            .widget<Semantics>(
              _semanticsLabel('Open current delivery details'),
            )
            .explicitChildNodes,
        isTrue,
      );
      expect(
        tester
            .getSize(find.byKey(const Key('open-live-tracking-button')))
            .height,
        greaterThanOrEqualTo(44),
      );

      final tileTop = tester.getTopLeft(find.byType(MapTrackingTile)).dy;
      final statusBottom =
          tester
              .getBottomLeft(find.byKey(const Key('delivery-status-panel')))
              .dy -
          tileTop;

      expect(statusBottom, closeTo(290, 0.1));
    },
  );

  testWidgets(
    'shows LIVE MAP badge in active state with matching live location',
    (tester) async {
      final active = LiveDeliveryMapState.active(
        riderPoint: const LatLng(7.20, 125.46),
        shopPoint: const LatLng(7.19, 125.45),
        destPoint: const LatLng(7.21, 125.47),
        routePoints: [const LatLng(7.19, 125.45), const LatLng(7.21, 125.47)],
        orderId: 'ORD-001',
        deliveryAssignmentId: 'assign-001',
        orderStatus: OrderStatus.onTheWay,
        queuePosition: 1,
        queueSize: 2,
      );
      await tester.pumpWidget(
        _wrap(
          active,
          slots: _dailySlots,
          location: LocationUpdate(
            id: 'live',
            deliveryAssignmentId: 'assign-001',
            planVersion: 1,
            latitude: 7.20,
            longitude: 125.46,
            timestamp: DateTime.now(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('LIVE MAP'), findsOneWidget);
      expect(find.textContaining('1st of 2 in queue'), findsOneWidget);
      expect(find.text('Order Dispatched'), findsOneWidget);
      expect(find.text('Rider is on the way'), findsOneWidget);
      expect(
        _semanticsLabel(
          'Rider is on the way. Live · location updating',
        ),
        findsOneWidget,
      );
      expect(find.text('Live map starts after rider dispatch.'), findsNothing);
      final mapSemantics = tester.widget<Semantics>(
        _semanticsLabel('Live delivery map'),
      );
      expect(mapSemantics.excludeSemantics, isTrue);
      expect(
        mapSemantics.properties.hint,
        'Shows the rider current location and delivery route',
      );
      expect(
        _semanticsLabel('Open current delivery details'),
        findsOneWidget,
      );
      expect(_semanticsLabel('Rider current location marker'), findsNothing);
      expect(find.byKey(const Key('live-delivery-map')), findsOneWidget);
      expect(
        tester.widget<MarkerLayer>(find.byType(MarkerLayer)).markers,
        hasLength(3),
      );
    },
  );

  testWidgets('shows distance-based ETA for dense live routes', (tester) async {
    final route = List.generate(
      40,
      (i) => LatLng(7.0640 + (i * 0.00001), 125.6079),
    );
    final active = LiveDeliveryMapState.active(
      riderPoint: route.first,
      shopPoint: route.first,
      destPoint: route.last,
      routePoints: route,
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
          planVersion: 1,
          latitude: route.first.latitude,
          longitude: route.first.longitude,
          timestamp: DateTime.now(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('~1 min'), findsOneWidget);
    expect(find.text('~40 min'), findsNothing);
  });

  testWidgets('prefers server leg duration over the geometry estimate', (
    tester,
  ) async {
    final route = List.generate(
      40,
      (i) => LatLng(7.0640 + (i * 0.00001), 125.6079),
    );
    final active = LiveDeliveryMapState.active(
      riderPoint: route.first,
      shopPoint: route.first,
      destPoint: route.last,
      routePoints: route,
      orderId: 'ORD-001',
      deliveryAssignmentId: 'assign-001',
      orderStatus: OrderStatus.onTheWay,
      legDurationSeconds: 540,
    );

    await tester.pumpWidget(
      _wrap(
        active,
        slots: _dailySlots,
        location: LocationUpdate(
          id: 'live',
          deliveryAssignmentId: 'assign-001',
          planVersion: 1,
          latitude: route.first.latitude,
          longitude: route.first.longitude,
          timestamp: DateTime.now(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('~9 min'), findsOneWidget);
    expect(find.text('~1 min'), findsNothing);
  });

  testWidgets('malformed live route does not display a computed ETA', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: const [],
      orderId: 'ORD-001',
      deliveryAssignmentId: 'assign-001',
      orderStatus: OrderStatus.onTheWay,
      routingHealth: RoutingHealth.malformed,
      legDurationSeconds: 120,
    );

    await tester.pumpWidget(
      _wrap(
        active,
        slots: _dailySlots,
        location: LocationUpdate(
          id: 'live',
          deliveryAssignmentId: 'assign-001',
          planVersion: 1,
          latitude: 7.20,
          longitude: 125.46,
          timestamp: DateTime.now(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Route geometry degraded'), findsOneWidget);
    expect(find.textContaining(' min'), findsNothing);
  });

  testWidgets('subscribes even when a fresh matching location is cached', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
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
        planVersion: 1,
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
    verify(
      harness.webSocket.subscribeToDeliveryPlan('assign-001', 1),
    ).called(1);
  });

  testWidgets('connect completion subscribes the newest map identity', (
    tester,
  ) async {
    final first = LiveDeliveryMapState.active(
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: const [LatLng(7.19, 125.45), LatLng(7.21, 125.47)],
      orderId: 'ORD-001',
      deliveryAssignmentId: 'assign-001',
      planVersion: 1,
      orderStatus: OrderStatus.onTheWay,
    );
    final second = LiveDeliveryMapState.active(
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.22, 125.48),
      routePoints: const [LatLng(7.19, 125.45), LatLng(7.22, 125.48)],
      orderId: 'ORD-002',
      deliveryAssignmentId: 'assign-002',
      planVersion: 2,
      orderStatus: OrderStatus.onTheWay,
    );
    final desiredMapState = StateProvider<LiveDeliveryMapState>((_) => first);
    final connectGate = Completer<void>();
    final socket = MockWebSocketService();
    when(
      socket.connectLocation(onLocationUpdate: anyNamed('onLocationUpdate')),
    ).thenAnswer((_) => connectGate.future);
    when(socket.listenForLocationHealth(any)).thenAnswer((invocation) {
      final callback =
          invocation.positionalArguments.first
              as Function(LocationSocketHealth);
      callback(LocationSocketHealth.connecting);
    });
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(MockDio()),
        webSocketServiceProvider.overrideWithValue(socket),
        liveDeliveryMapProvider.overrideWith(
          (ref) async => ref.watch(desiredMapState),
        ),
      ],
    );
    addTearDown(container.dispose);

    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: MaterialApp.router(routerConfig: _router()),
      ),
    );
    await tester.pump();
    await tester.pump();

    container.read(desiredMapState.notifier).state = second;
    await tester.pump();
    await tester.pump();
    connectGate.complete();
    await tester.pumpAndSettle();

    verify(socket.subscribeToDeliveryPlan('assign-002', 2)).called(1);
    verifyNever(socket.subscribeToDeliveryPlan('assign-001', 1));
  });

  testWidgets('discards socket payload when assignment identity is missing', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
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
      'planVersion': 1,
      'latitude': 7.20,
      'longitude': 125.46,
      'timestamp': DateTime.now().toIso8601String(),
    });
    await tester.pumpAndSettle();

    expect(find.text('LIVE MAP'), findsNothing);
    expect(find.byKey(const Key('delivery-map-panel')), findsNothing);
  });

  testWidgets('preserves the last socket marker when it becomes offline', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
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
      'planVersion': 1,
      'latitude': 7.20,
      'longitude': 125.46,
      'timestamp': DateTime.now()
          .subtract(const Duration(minutes: 15))
          .toIso8601String(),
    });
    await tester.pumpAndSettle();

    expect(find.text('LIVE MAP'), findsNothing);
    expect(find.text('GPS OFFLINE'), findsOneWidget);
    expect(find.byKey(const Key('delivery-map-panel')), findsOneWidget);
    expect(find.text('Order Dispatched'), findsOneWidget);
    expect(find.text('Rider is on the way'), findsOneWidget);
  });

  testWidgets('keeps dispatch status when matching live location is stale', (
    tester,
  ) async {
    final active = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
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
          planVersion: 1,
          latitude: 7.20,
          longitude: 125.46,
          timestamp: DateTime.now().subtract(const Duration(minutes: 15)),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('LIVE MAP'), findsNothing);
    expect(find.text('GPS OFFLINE'), findsOneWidget);
    expect(find.byKey(const Key('delivery-map-panel')), findsOneWidget);
    expect(find.text('Order Dispatched'), findsOneWidget);
    expect(find.text('Rider is on the way'), findsOneWidget);
  });

  testWidgets('idle tile pins the customer booked slot above the list', (
    tester,
  ) async {
    final booked = BookedSlotInfo(
      orderId: 'ORD-100',
      slot: AssignedDeliverySlot(
        slotTemplateId: 1,
        date: _today(),
        startTime: '09:30:00',
        endTime: '11:30:00',
      ),
    );
    await tester.pumpWidget(
      _harness(
        state: LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        booked: booked,
      ).widget,
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('booked-slot-block')), findsOneWidget);
    expect(find.text('YOUR BATCH · TODAY'), findsOneWidget);
    // The pinned block owns the booked window; the availability list
    // drops its duplicate row.
    expect(find.text('9:30 - 11:30 AM'), findsOneWidget);
    expect(find.text('2/10'), findsOneWidget);
    expect(find.text('2:00 - 4:00 PM'), findsOneWidget);
    expect(find.text('4/10'), findsOneWidget);
  });

  testWidgets('idle tile pinned slot shows its day when booked ahead', (
    tester,
  ) async {
    final booked = BookedSlotInfo(
      orderId: 'ORD-101',
      slot: const AssignedDeliverySlot(
        slotTemplateId: 9,
        date: '2099-07-17',
        startTime: '14:00:00',
        endTime: '16:00:00',
      ),
    );
    await tester.pumpWidget(
      _harness(
        state: LiveDeliveryMapState.idle(),
        slots: _dailySlots,
        booked: booked,
      ).widget,
    );
    await tester.pumpAndSettle();

    // Window still renders from the booking itself even though that day's
    // fill counts are not loaded. Today's 2-4 PM availability row also shows
    // the same window text, so it appears twice.
    expect(find.text('YOUR BATCH · FRI, JUL 17'), findsOneWidget);
    expect(find.text('2:00 - 4:00 PM'), findsNWidgets(2));
  });

  testWidgets('idle tile rolls over to the next batch when today is empty', (
    tester,
  ) async {
    const nextBatch = NextBatchInfo(
      reason: NextBatchReason.weekend,
      todayDate: '2099-07-18',
      relevantDate: '2099-07-20',
      relevantIsToday: false,
      upcoming: [
        UpcomingSlot(
          startTime: '09:30:00',
          endTime: '11:30:00',
          bookedCount: 2,
          capacity: 10,
        ),
      ],
      nextSlotStart: '09:30:00',
      nextSlotEnd: '11:30:00',
    );
    await tester.pumpWidget(
      _harness(
        state: LiveDeliveryMapState.idle(),
        nextBatch: nextBatch,
      ).widget,
    );
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('next-batch-block')), findsOneWidget);
    expect(find.text('NEXT BATCH · MON, JUL 20'), findsOneWidget);
    expect(find.text('9:30 - 11:30 AM'), findsOneWidget);
    expect(find.text('2/10'), findsOneWidget);
    expect(find.text('No active delivery'), findsNothing);
    expect(find.text('No batches scheduled today'), findsNothing);
  });

  testWidgets('queued tile shows the booked window with live slot fill', (
    tester,
  ) async {
    final queued = LiveDeliveryMapState.active(
      riderPoint: const LatLng(7.20, 125.46),
      shopPoint: const LatLng(7.19, 125.45),
      destPoint: const LatLng(7.21, 125.47),
      routePoints: const [LatLng(7.19, 125.45), LatLng(7.21, 125.47)],
      orderId: 'ORD-QUEUED',
      deliveryAssignmentId: null,
      orderStatus: OrderStatus.onTheWay,
      assignedSlot: AssignedDeliverySlot(
        slotTemplateId: 1,
        date: _today(),
        startTime: '09:30:00',
        endTime: '11:30:00',
      ),
      queuePosition: 2,
      queueSize: 4,
      canTrackDelivery: false,
    );
    await tester.pumpWidget(_wrap(queued, slots: _dailySlots));
    await tester.pumpAndSettle();

    expect(find.text('YOUR BATCH · TODAY'), findsOneWidget);
    expect(find.text('9:30 - 11:30 AM'), findsOneWidget);
    expect(find.text('2/10'), findsOneWidget);
    expect(find.text('Order Dispatched'), findsOneWidget);
    expect(find.text('2nd of 4 in queue'), findsOneWidget);
  });
}
