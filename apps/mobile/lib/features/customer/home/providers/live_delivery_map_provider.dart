import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/services/routing_service.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

enum LiveMapStatus { loading, active, idle }

const _urbanDeliveryMetersPerMinute = 220.0;

int nearestRouteIndexForPoint(LatLng point, List<LatLng> routePoints) {
  if (routePoints.isEmpty) return 0;
  const distance = Distance();
  var nearest = 0;
  var minDist = double.infinity;
  for (var i = 0; i < routePoints.length; i++) {
    final d = distance(point, routePoints[i]);
    if (d < minDist) {
      minDist = d;
      nearest = i;
    }
  }
  return nearest;
}

double routeProgressRatioForPoint(LatLng point, List<LatLng> routePoints) {
  if (routePoints.length < 2) return 0;
  final nearest = nearestRouteIndexForPoint(point, routePoints);
  return (nearest / (routePoints.length - 1)).clamp(0.0, 1.0).toDouble();
}

double remainingRouteDistanceMeters(LatLng point, List<LatLng> routePoints) {
  if (routePoints.isEmpty) return 0;
  const distance = Distance();
  final nearest = nearestRouteIndexForPoint(point, routePoints);
  var meters = distance(point, routePoints[nearest]);
  for (var i = nearest; i < routePoints.length - 1; i++) {
    meters += distance(routePoints[i], routePoints[i + 1]);
  }
  return meters;
}

int estimateRouteEtaMinutes(
  LatLng point,
  List<LatLng> routePoints, {
  double metersPerMinute = _urbanDeliveryMetersPerMinute,
}) {
  if (routePoints.isEmpty || metersPerMinute <= 0) return 0;
  final remainingMeters = remainingRouteDistanceMeters(point, routePoints);
  if (remainingMeters <= 20) return 1;
  return (remainingMeters / metersPerMinute).ceil().clamp(1, 99).toInt();
}

class LiveDeliveryMapState {
  const LiveDeliveryMapState._({
    required this.status,
    required this.shopPoint,
    required this.destPoint,
    this.riderPoint,
    this.routePoints = const [],
    this.orderId,
    this.deliveryAssignmentId,
    this.orderStatus,
    this.assignedSlot,
    this.queuePosition,
    this.queueSize,
    this.canTrackDelivery = false,
  });

  final LiveMapStatus status;
  final LatLng shopPoint;
  final LatLng destPoint;
  final LatLng? riderPoint;
  final List<LatLng> routePoints;
  final String? orderId;
  final String? deliveryAssignmentId;
  final OrderStatus? orderStatus;
  final AssignedDeliverySlot? assignedSlot;
  final int? queuePosition;
  final int? queueSize;
  final bool canTrackDelivery;

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
    required LatLng riderPoint,
    required LatLng shopPoint,
    required LatLng destPoint,
    required List<LatLng> routePoints,
    required String orderId,
    String? deliveryAssignmentId,
    required OrderStatus orderStatus,
    AssignedDeliverySlot? assignedSlot,
    int? queuePosition = 1,
    int? queueSize = 1,
    bool canTrackDelivery = true,
  }) => LiveDeliveryMapState._(
    status: LiveMapStatus.active,
    shopPoint: shopPoint,
    destPoint: destPoint,
    riderPoint: riderPoint,
    routePoints: routePoints,
    orderId: orderId,
    deliveryAssignmentId: deliveryAssignmentId,
    orderStatus: orderStatus,
    assignedSlot: assignedSlot,
    queuePosition: queuePosition,
    queueSize: queueSize,
    canTrackDelivery: canTrackDelivery,
  );

  /// Index of the route point nearest to [riderPoint].
  int get nearestRouteIndex {
    if (riderPoint == null || routePoints.isEmpty) return 0;
    return nearestRouteIndexForPoint(riderPoint!, routePoints);
  }

  /// Estimated minutes remaining based on route distance, not polyline density.
  int get etaMinutes => riderPoint == null
      ? 0
      : estimateRouteEtaMinutes(riderPoint!, routePoints);
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
      final temporaryAddress = onTheWayOrder.deliveryAddress;
      final address =
          temporaryAddress == null && onTheWayOrder.deliveryAddressId != null
          ? addresses
                .where((a) => a.id == onTheWayOrder.deliveryAddressId)
                .firstOrNull
          : null;

      final latitude = temporaryAddress?.latitude ?? address?.latitude;
      final longitude = temporaryAddress?.longitude ?? address?.longitude;

      if (latitude == null || longitude == null) {
        return LiveDeliveryMapState.idle();
      }
      if (latitude == 0 && longitude == 0) {
        return LiveDeliveryMapState.idle();
      }

      final destPoint = LatLng(latitude, longitude);

      // Fetch route (cached by RoutingService). riderPoint is resolved by
      // consumers watching locationProvider directly.
      final routePoints = await RoutingService.getRoute(_shopPoint, destPoint);

      return LiveDeliveryMapState.active(
        riderPoint: _shopPoint, // placeholder; overridden by consumers
        shopPoint: _shopPoint,
        destPoint: destPoint,
        routePoints: routePoints,
        orderId: onTheWayOrder.orderId,
        deliveryAssignmentId: onTheWayOrder.deliveryAssignmentId,
        orderStatus: onTheWayOrder.orderStatus,
        assignedSlot: onTheWayOrder.assignedSlot,
        queuePosition: onTheWayOrder.deliveryQueuePosition,
        queueSize: onTheWayOrder.deliveryQueueSize,
        canTrackDelivery: onTheWayOrder.canTrackDelivery,
      );
    });
