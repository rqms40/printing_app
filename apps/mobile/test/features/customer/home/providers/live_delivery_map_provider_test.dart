import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

// ── Helpers ──────────────────────────────────────────────────────────────────

Order _makeOrder({
  String id = 'ord_test',
  String orderId = 'ORD-TEST-001',
  OrderStatus status = OrderStatus.outForDelivery,
  String? deliveryAddressId = 'addr_test',
  OrderDeliveryAddress? deliveryAddress,
  String? deliveryAssignmentId = 'da_test',
  int? queuePosition = 1,
  int? queueSize = 1,
  bool canTrackDelivery = true,
  int? planVersion = 1,
  GeoJsonLineString? routeGeometry,
  bool routeGeometryMalformed = false,
  bool routingDataStale = false,
}) => Order(
  id: id,
  orderId: orderId,
  userId: 'usr_001',
  category: 'Poster',
  quantity: 1,
  totalPrice: 500.0,
  deliveryFee: 80.0,
  paymentMethod: PaymentMethod.gcash,
  paymentStatus: PaymentStatus.paid,
  orderStatus: status,
  deliveryOption: 'delivery',
  deliveryAddressId: deliveryAddressId,
  deliveryAddress: deliveryAddress,
  deliveryAssignmentId: deliveryAssignmentId,
  deliveryQueuePosition: queuePosition,
  deliveryQueueSize: queueSize,
  canTrackDelivery: canTrackDelivery,
  deliveryPlanVersion: planVersion,
  deliveryRouteGeometry: routeGeometry,
  deliveryRouteGeometryMalformed: routeGeometryMalformed,
  deliveryRoutingDataStale: routingDataStale,
  createdAt: DateTime(2026, 4, 21),
  updatedAt: DateTime(2026, 4, 21),
);

Address _makeDavaoAddress({
  String id = 'addr_test',
  double latitude = 7.0731,
  double longitude = 125.6128,
}) => Address(
  id: id,
  userId: 'usr_001',
  label: 'Test Davao Address',
  fullAddress: '123 CM Recto Avenue, Davao City',
  city: 'Davao City',
  latitude: latitude,
  longitude: longitude,
  isDefault: false,
  createdAt: DateTime(2026, 4, 21),
  updatedAt: DateTime(2026, 4, 21),
);

ProviderContainer _container({
  List<Order> orders = const [],
  List<Address> addresses = const [],
}) => ProviderContainer(
  overrides: [
    ordersProvider.overrideWith(
      (_) => OrdersNotifier(initialState: orders, skipBootstrap: true),
    ),
    addressProvider.overrideWith(
      (_) => AddressNotifier(initialState: addresses, skipBootstrap: true),
    ),
  ],
);

// ── State factory unit tests ──────────────────────────────────────────────────

void main() {
  group('location health boundaries', () {
    final now = DateTime.utc(2026, 7, 10, 12);

    test('14 seconds is live and 15 seconds is stale', () {
      expect(
        classifyLocationHealth(
          updatedAt: now.subtract(const Duration(seconds: 14)),
          now: now,
          connected: true,
        ),
        LocationHealth.live,
      );
      expect(
        classifyLocationHealth(
          updatedAt: now.subtract(const Duration(seconds: 15)),
          now: now,
          connected: true,
        ),
        LocationHealth.stale,
      );
    });

    test('120 seconds is stale and 121 seconds is offline', () {
      expect(
        classifyLocationHealth(
          updatedAt: now.subtract(const Duration(seconds: 120)),
          now: now,
          connected: true,
        ),
        LocationHealth.stale,
      );
      expect(
        classifyLocationHealth(
          updatedAt: now.subtract(const Duration(seconds: 121)),
          now: now,
          connected: true,
        ),
        LocationHealth.offline,
      );
      // A fresh fix proves updates are flowing even while the socket health
      // flag lags (reconnect/resubscribe churn) — never flash offline.
      expect(
        classifyLocationHealth(
          updatedAt: now.subtract(const Duration(seconds: 1)),
          now: now,
          connected: false,
        ),
        LocationHealth.live,
      );
      // Once the last fix ages past the live window, a disconnected socket
      // downgrades straight to offline instead of lingering on stale.
      expect(
        classifyLocationHealth(
          updatedAt: now.subtract(const Duration(seconds: 20)),
          now: now,
          connected: false,
        ),
        LocationHealth.offline,
      );
    });
  });

  group('LiveDeliveryMapState factories', () {
    test('idle() uses Davao center and empty route', () {
      final state = LiveDeliveryMapState.idle();
      expect(state.status, LiveMapStatus.idle);
      expect(state.riderPoint, isNull);
      expect(state.routePoints, isEmpty);
      expect(state.orderId, isNull);
      expect(state.shopPoint.latitude, closeTo(7.1907, 0.001));
    });

    test('active() sets all fields', () {
      const rider = LatLng(7.20, 125.46);
      const shop = LatLng(7.19, 125.45);
      const dest = LatLng(7.21, 125.47);
      final route = [shop, rider, dest];

      final state = LiveDeliveryMapState.active(
        riderPoint: rider,
        shopPoint: shop,
        destPoint: dest,
        routePoints: route,
        orderId: 'ORD-001',
        deliveryAssignmentId: 'da_001',
        orderStatus: OrderStatus.outForDelivery,
      );

      expect(state.status, LiveMapStatus.active);
      expect(state.riderPoint, rider);
      expect(state.shopPoint, shop);
      expect(state.destPoint, dest);
      expect(state.routePoints, route);
      expect(state.orderId, 'ORD-001');
      expect(state.deliveryAssignmentId, 'da_001');
      expect(state.orderStatus, OrderStatus.outForDelivery);
    });

    test('loading() has loading status', () {
      final state = LiveDeliveryMapState.loading();
      expect(state.status, LiveMapStatus.loading);
    });

    test('etaMinutes returns remaining route points count', () {
      const rider = LatLng(7.20, 125.46);
      const shop = LatLng(7.19, 125.45);
      const dest = LatLng(7.21, 125.47);
      final route = List.generate(30, (i) => LatLng(7.19 + i * 0.001, 125.45));

      final state = LiveDeliveryMapState.active(
        riderPoint: rider,
        shopPoint: shop,
        destPoint: dest,
        routePoints: route,
        orderId: 'ORD-001',
        deliveryAssignmentId: 'da_001',
        orderStatus: OrderStatus.outForDelivery,
      );

      expect(state.etaMinutes, greaterThanOrEqualTo(0));
    });

    test('etaMinutes uses remaining distance instead of route point count', () {
      const rider = LatLng(7.0640, 125.6079);
      const dest = LatLng(7.0644, 125.6079);
      final denseRoute = List.generate(
        40,
        (i) => LatLng(7.0640 + (i * 0.00001), 125.6079),
      );

      final state = LiveDeliveryMapState.active(
        riderPoint: rider,
        shopPoint: rider,
        destPoint: dest,
        routePoints: denseRoute,
        orderId: 'ORD-001',
        deliveryAssignmentId: 'da_001',
        orderStatus: OrderStatus.outForDelivery,
      );

      expect(state.etaMinutes, 1);
    });

    test('route helpers clamp completed route progress and ETA', () {
      const rider = LatLng(7.0731, 125.6128);
      final route = [
        const LatLng(7.0640, 125.6079),
        const LatLng(7.0680, 125.6100),
        rider,
      ];

      expect(routeProgressRatioForPoint(rider, route), 1);
      expect(estimateRouteEtaMinutes(rider, route), 1);
    });
  });

  // ── Provider integration tests ──────────────────────────────────────────────

  group('liveDeliveryMapProvider integration', () {
    late ProviderContainer container;

    tearDown(() => container.dispose());

    test('returns idle when no orders exist', () async {
      container = _container(orders: [], addresses: []);
      final state = await container.read(liveDeliveryMapProvider.future);
      expect(state.status, LiveMapStatus.idle);
    });

    test(
      'returns idle when orders exist but none are out for delivery',
      () async {
        container = _container(
          orders: [
            _makeOrder(status: OrderStatus.submitted),
            _makeOrder(
              id: 'ord_b',
              orderId: 'ORD-002',
              status: OrderStatus.production,
            ),
          ],
          addresses: [_makeDavaoAddress()],
        );
        final state = await container.read(liveDeliveryMapProvider.future);
        expect(state.status, LiveMapStatus.idle);
      },
    );

    test('returns idle after delivery is complete', () async {
      container = _container(
        orders: [_makeOrder(status: OrderStatus.delivered)],
        addresses: [_makeDavaoAddress()],
      );

      final state = await container.read(liveDeliveryMapProvider.future);
      expect(state.status, LiveMapStatus.idle);
    });

    test('returns idle when out-for-delivery order has no address', () async {
      container = _container(
        orders: [_makeOrder(deliveryAddressId: null)],
        addresses: [_makeDavaoAddress()],
      );
      final state = await container.read(liveDeliveryMapProvider.future);
      expect(state.status, LiveMapStatus.idle);
    });

    test('returns idle when address cannot be resolved', () async {
      container = _container(
        orders: [_makeOrder(deliveryAddressId: 'addr_missing')],
        addresses: [_makeDavaoAddress(id: 'addr_other')],
      );
      final state = await container.read(liveDeliveryMapProvider.future);
      expect(state.status, LiveMapStatus.idle);
    });

    test(
      'returns active when out-for-delivery order + matching address exist',
      () async {
        final geometry = GeoJsonLineString.tryParse({
          'type': 'LineString',
          'coordinates': [
            [125.6079, 7.064],
            [125.6128, 7.0731],
          ],
        });
        container = _container(
          orders: [_makeOrder(routeGeometry: geometry)],
          addresses: [_makeDavaoAddress()],
        );
        final state = await container.read(liveDeliveryMapProvider.future);

        expect(state.status, LiveMapStatus.active);
        expect(state.orderId, 'ORD-TEST-001');
        expect(state.deliveryAssignmentId, 'da_test');
        expect(state.queuePosition, 1);
        expect(state.queueSize, 1);
        expect(state.canTrackDelivery, isTrue);
        expect(state.orderStatus, OrderStatus.outForDelivery);
        expect(state.destPoint.latitude, closeTo(7.0731, 0.001));
        expect(state.destPoint.longitude, closeTo(125.6128, 0.001));
        expect(state.routePoints, geometry!.points);
        expect(state.routingHealth, RoutingHealth.current);
      },
    );

    test('never creates a client route for a private later stop', () async {
      container = _container(
        orders: [
          _makeOrder(
            deliveryAssignmentId: null,
            queuePosition: 2,
            queueSize: 2,
            canTrackDelivery: false,
          ),
        ],
        addresses: [_makeDavaoAddress()],
      );

      final state = await container.read(liveDeliveryMapProvider.future);

      expect(state.routePoints, isEmpty);
      expect(state.routingHealth, RoutingHealth.unavailable);
    });

    test(
      'malformed persisted geometry is degraded without a fake line',
      () async {
        container = _container(
          orders: [
            _makeOrder(routeGeometryMalformed: true, routingDataStale: false),
          ],
          addresses: [_makeDavaoAddress()],
        );

        final state = await container.read(liveDeliveryMapProvider.future);

        expect(state.routePoints, isEmpty);
        expect(state.routingHealth, RoutingHealth.malformed);
      },
    );

    test('missing current geometry is degraded without a fake line', () async {
      container = _container(
        orders: [_makeOrder(routeGeometry: null)],
        addresses: [_makeDavaoAddress()],
      );

      final state = await container.read(liveDeliveryMapProvider.future);

      expect(state.routePoints, isEmpty);
      expect(state.routingHealth, RoutingHealth.malformed);
    });

    test(
      'preserves queued state when assignment tracking id is withheld',
      () async {
        container = _container(
          orders: [
            _makeOrder(
              deliveryAssignmentId: null,
              queuePosition: 2,
              queueSize: 3,
              canTrackDelivery: false,
            ),
          ],
          addresses: [_makeDavaoAddress()],
        );

        final state = await container.read(liveDeliveryMapProvider.future);

        expect(state.status, LiveMapStatus.active);
        expect(state.deliveryAssignmentId, isNull);
        expect(state.queuePosition, 2);
        expect(state.queueSize, 3);
        expect(state.canTrackDelivery, isFalse);
      },
    );

    test(
      'returns active from temporary delivery address snapshot without saved id',
      () async {
        container = _container(
          orders: [
            _makeOrder(
              deliveryAddressId: null,
              deliveryAddress: const OrderDeliveryAddress(
                label: 'Temporary drop',
                fullAddress: 'Unit 12, Jacinto Extension, Davao City',
                city: 'Davao City',
                latitude: 7.0731,
                longitude: 125.6128,
              ),
            ),
          ],
          addresses: const [],
        );
        final state = await container.read(liveDeliveryMapProvider.future);

        expect(state.status, LiveMapStatus.active);
        expect(state.orderId, 'ORD-TEST-001');
        expect(state.destPoint.latitude, closeTo(7.0731, 0.001));
        expect(state.destPoint.longitude, closeTo(125.6128, 0.001));
      },
    );

    test('active state shopPoint is the Davao branch location', () async {
      container = _container(
        orders: [_makeOrder()],
        addresses: [_makeDavaoAddress()],
      );
      final state = await container.read(liveDeliveryMapProvider.future);
      // Shop is fixed branch location in Davao City
      expect(state.shopPoint.latitude, closeTo(7.064, 0.01));
      expect(state.shopPoint.longitude, closeTo(125.608, 0.01));
    });

    test(
      'picks first out-for-delivery order when multiple active orders exist',
      () async {
        container = _container(
          orders: [
            _makeOrder(
              status: OrderStatus.production,
              id: 'ord_a',
              orderId: 'ORD-A',
            ),
            _makeOrder(id: 'ord_b', orderId: 'ORD-B'),
            _makeOrder(
              status: OrderStatus.readyForDispatch,
              id: 'ord_c',
              orderId: 'ORD-C',
            ),
          ],
          addresses: [_makeDavaoAddress()],
        );
        final state = await container.read(liveDeliveryMapProvider.future);
        expect(state.status, LiveMapStatus.active);
        expect(state.orderId, 'ORD-B');
      },
    );
  });
}
