import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/widgets/map_helpers.dart';

enum LiveMapStatus { loading, active, idle }

enum RoutingHealth { current, stale, malformed, unavailable }

enum LocationHealth { live, stale, offline }

final deliveryTrackingNowProvider = Provider<DateTime Function()>(
  (ref) => DateTime.now,
);

/// Active-trip location freshness (Task 7.2).
/// Live: &lt;15s · Stale: 15–120s · Offline / missing: &gt;120s.
const Duration kLocationLiveThreshold = Duration(seconds: 15);
const Duration kLocationStaleThreshold = Duration(seconds: 120);

LocationHealth classifyLocationHealth({
  required DateTime updatedAt,
  required DateTime now,
  required bool connected,
}) {
  final age = now.difference(updatedAt);
  // A fresh update is proof of life even while the socket handshake state
  // lags behind (reconnect churn must not flash "GPS offline" mid-stream).
  if (age < kLocationLiveThreshold) return LocationHealth.live;
  if (!connected) return LocationHealth.offline;
  if (age <= kLocationStaleThreshold) return LocationHealth.stale;
  return LocationHealth.offline;
}

/// Rider-facing copy for location age / missing GPS during active trip.
String locationHealthMessage(
  LocationHealth health, {
  bool hasLastKnown = false,
}) {
  return switch (health) {
    LocationHealth.live => 'Live · location updating',
    LocationHealth.stale => hasLastKnown
        ? 'Location stale · last known shown (no update >15s)'
        : 'Location stale · waiting for GPS',
    LocationHealth.offline => hasLastKnown
        ? 'GPS offline · last known shown (no update >120s)'
        : 'Waiting for rider GPS',
  };
}

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
    this.planVersion,
    this.routingHealth = RoutingHealth.unavailable,
    this.legDurationSeconds,
    this.legDistanceMeters,
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
  final int? planVersion;
  final RoutingHealth routingHealth;
  final int? legDurationSeconds;
  final int? legDistanceMeters;

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
    LatLng? riderPoint,
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
    int? planVersion = 1,
    RoutingHealth routingHealth = RoutingHealth.current,
    int? legDurationSeconds,
    int? legDistanceMeters,
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
    planVersion: planVersion,
    routingHealth: routingHealth,
    legDurationSeconds: legDurationSeconds,
    legDistanceMeters: legDistanceMeters,
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

/// Shared provider — reads the customer-safe persisted route from the order.
/// Does NOT watch locationProvider — consumers watch that directly so location
/// updates never trigger the expensive FutureProvider recompute cycle.
final liveDeliveryMapProvider =
    FutureProvider.autoDispose<LiveDeliveryMapState>((ref) async {
      final orders = ref.watch(activeOrdersProvider);
      final addresses = ref.watch(addressProvider);

      final onTheWayOrder = orders
          .where(
            (o) =>
                o.orderStatus == OrderStatus.outForDelivery,
          )
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

      final geometry = onTheWayOrder.deliveryRouteGeometry;
      final routePoints = onTheWayOrder.canTrackDelivery && geometry != null
          ? geometry.points
          : const <LatLng>[];
      final routingHealth = !onTheWayOrder.canTrackDelivery
          ? RoutingHealth.unavailable
          : onTheWayOrder.deliveryRouteGeometryMalformed || geometry == null
          ? RoutingHealth.malformed
          : onTheWayOrder.deliveryRoutingDataStale == true
          ? RoutingHealth.stale
          : RoutingHealth.current;

      return LiveDeliveryMapState.active(
        riderPoint: null,
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
        planVersion: onTheWayOrder.deliveryPlanVersion,
        routingHealth: routingHealth,
        legDurationSeconds: onTheWayOrder.deliveryLegDurationSeconds,
        legDistanceMeters: onTheWayOrder.deliveryLegDistanceMeters,
      );
    });
