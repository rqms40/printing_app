import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

enum LiveMapStatus { loading, active, idle }

class LiveDeliveryMapState {
  const LiveDeliveryMapState._({
    required this.status,
    required this.shopPoint,
    required this.destPoint,
    this.driverPoint,
    this.routePoints = const [],
    this.orderId,
    this.orderStatus,
  });

  final LiveMapStatus status;
  final LatLng shopPoint;
  final LatLng destPoint;
  final LatLng? driverPoint;
  final List<LatLng> routePoints;
  final String? orderId;
  final OrderStatus? orderStatus;

  factory LiveDeliveryMapState.loading() => const LiveDeliveryMapState._(
        status: LiveMapStatus.loading,
        shopPoint: MapHelpers.davaoCenter,
        destPoint: MapHelpers.davaoCenter,
      );

  factory LiveDeliveryMapState.idle() => const LiveDeliveryMapState._(
        status: LiveMapStatus.idle,
        shopPoint: MapHelpers.davaoCenter,
        destPoint: MapHelpers.davaoCenter,
      );

  factory LiveDeliveryMapState.active({
    required LatLng driverPoint,
    required LatLng shopPoint,
    required LatLng destPoint,
    required List<LatLng> routePoints,
    required String orderId,
    required OrderStatus orderStatus,
  }) =>
      LiveDeliveryMapState._(
        status: LiveMapStatus.active,
        shopPoint: shopPoint,
        destPoint: destPoint,
        driverPoint: driverPoint,
        routePoints: routePoints,
        orderId: orderId,
        orderStatus: orderStatus,
      );

  /// Index of the route point nearest to [driverPoint].
  int get nearestRouteIndex {
    if (driverPoint == null || routePoints.isEmpty) return 0;
    const distance = Distance();
    var nearest = 0;
    var minDist = double.infinity;
    for (var i = 0; i < routePoints.length; i++) {
      final d = distance(driverPoint!, routePoints[i]);
      if (d < minDist) {
        minDist = d;
        nearest = i;
      }
    }
    return nearest;
  }

  /// Estimated minutes remaining (1 point ≈ 1 minute).
  int get etaMinutes =>
      routePoints.isEmpty ? 0 : routePoints.length - nearestRouteIndex;
}

/// Fixed shop/branch location in Davao City.
const _shopPoint = LatLng(7.0640, 125.6079);

/// Shared provider — reads active order + OSRM route.
/// Does NOT watch locationProvider — consumers watch that directly so location
/// updates never trigger the expensive FutureProvider recompute cycle.
final liveDeliveryMapProvider =
    FutureProvider.autoDispose<LiveDeliveryMapState>((ref) async {
  final orders = ref.watch(activeOrdersProvider);
  final addresses = ref.watch(addressProvider);

  // Find first order that is actively on the way
  final onTheWayOrder = orders
      .where((o) => o.orderStatus == OrderStatus.onTheWay)
      .firstOrNull;

  if (onTheWayOrder == null) return LiveDeliveryMapState.idle();

  // Resolve delivery address lat/lng
  final address = onTheWayOrder.deliveryAddressId != null
      ? addresses
          .where((a) => a.id == onTheWayOrder.deliveryAddressId)
          .firstOrNull
      : null;

  if (address == null) return LiveDeliveryMapState.idle();
  if (address.latitude == 0 && address.longitude == 0) {
    return LiveDeliveryMapState.idle();
  }

  final destPoint = LatLng(address.latitude, address.longitude);

  // Fetch route (cached by RoutingService). driverPoint is resolved by
  // consumers watching locationProvider directly.
  final routePoints = await RoutingService.getRoute(_shopPoint, destPoint);

  return LiveDeliveryMapState.active(
    driverPoint: _shopPoint, // placeholder; overridden by consumers
    shopPoint: _shopPoint,
    destPoint: destPoint,
    routePoints: routePoints,
    orderId: onTheWayOrder.orderId,
    orderStatus: onTheWayOrder.orderStatus,
  );
});
