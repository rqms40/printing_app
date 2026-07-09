import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/home/providers/live_delivery_map_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';

// ── Helpers ──────────────────────────────────────────────────────────────────

Order _makeOrder({
  String id = 'ord_test',
  String orderId = 'ORD-TEST-001',
  OrderStatus status = OrderStatus.onTheWay,
  String? deliveryAddressId = 'addr_test',
  OrderDeliveryAddress? deliveryAddress,
  String? deliveryAssignmentId = 'da_test',
  int? queuePosition = 1,
  int? queueSize = 1,
  bool canTrackDelivery = true,
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
        orderStatus: OrderStatus.onTheWay,
      );

      expect(state.status, LiveMapStatus.active);
      expect(state.riderPoint, rider);
      expect(state.shopPoint, shop);
      expect(state.destPoint, dest);
      expect(state.routePoints, route);
      expect(state.orderId, 'ORD-001');
      expect(state.deliveryAssignmentId, 'da_001');
      expect(state.orderStatus, OrderStatus.onTheWay);
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
        orderStatus: OrderStatus.onTheWay,
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
        orderStatus: OrderStatus.onTheWay,
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

    test('returns idle when orders exist but none are onTheWay', () async {
      container = _container(
        orders: [
          _makeOrder(status: OrderStatus.orderPlaced),
          _makeOrder(
            id: 'ord_b',
            orderId: 'ORD-002',
            status: OrderStatus.printingInProgress,
          ),
        ],
        addresses: [_makeDavaoAddress()],
      );
      final state = await container.read(liveDeliveryMapProvider.future);
      expect(state.status, LiveMapStatus.idle);
    });

    test('returns idle when onTheWay order has no deliveryAddressId', () async {
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
      'returns active when onTheWay order + matching address exist',
      () async {
        container = _container(
          orders: [_makeOrder()],
          addresses: [_makeDavaoAddress()],
        );
        final state = await container.read(liveDeliveryMapProvider.future);

        expect(state.status, LiveMapStatus.active);
        expect(state.orderId, 'ORD-TEST-001');
        expect(state.deliveryAssignmentId, 'da_test');
        expect(state.queuePosition, 1);
        expect(state.queueSize, 1);
        expect(state.canTrackDelivery, isTrue);
        expect(state.orderStatus, OrderStatus.onTheWay);
        expect(state.destPoint.latitude, closeTo(7.0731, 0.001));
        expect(state.destPoint.longitude, closeTo(125.6128, 0.001));
        // Route fallback always returns non-empty list
        expect(state.routePoints, isNotEmpty);
      },
    );

    test('preserves queued state when assignment tracking id is withheld', () async {
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
    });

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
      'picks first onTheWay order when multiple active orders exist',
      () async {
        container = _container(
          orders: [
            _makeOrder(
              status: OrderStatus.printingInProgress,
              id: 'ord_a',
              orderId: 'ORD-A',
            ),
            _makeOrder(id: 'ord_b', orderId: 'ORD-B'), // onTheWay
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
