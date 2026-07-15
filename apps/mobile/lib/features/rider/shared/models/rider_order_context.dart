import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

enum RiderDispatchStopStatus { pending, completed, skipped }

class RiderDispatchPlanStop {
  const RiderDispatchPlanStop({
    required this.assignmentId,
    required this.sequence,
    required this.status,
    required this.destinationLatitude,
    required this.destinationLongitude,
    required this.legDurationSeconds,
    required this.legDistanceMeters,
    required this.geometry,
    required this.geometryMalformed,
  });

  final String assignmentId;
  final int sequence;
  final RiderDispatchStopStatus status;
  final double destinationLatitude;
  final double destinationLongitude;
  final int legDurationSeconds;
  final int legDistanceMeters;
  final GeoJsonLineString? geometry;
  final bool geometryMalformed;

  LatLng get destination => LatLng(destinationLatitude, destinationLongitude);
}

class RiderDispatchPlan {
  const RiderDispatchPlan({
    required this.version,
    required this.origin,
    required this.provider,
    required this.profile,
    required this.routingDataStale,
    required this.stops,
    this.totalDurationSeconds,
    this.totalDistanceMeters,
  });

  final int version;
  final LatLng origin;
  final String provider;
  final String profile;
  final int? totalDurationSeconds;
  final int? totalDistanceMeters;
  final bool routingDataStale;
  final List<RiderDispatchPlanStop> stops;
}

/// Destination snapshot for a rider assignment.
class RiderDestinationContext {
  const RiderDestinationContext({
    this.fullAddress,
    this.landmark,
    this.barangay,
    this.city,
    this.latitude,
    this.longitude,
  });

  final String? fullAddress;
  final String? landmark;
  final String? barangay;
  final String? city;
  final double? latitude;
  final double? longitude;

  bool get hasCoordinates =>
      latitude != null && longitude != null && latitude != 0 && longitude != 0;

  LatLng? get latLng => hasCoordinates ? LatLng(latitude!, longitude!) : null;

  String get shortLabel {
    if (barangay != null && city != null) return '$barangay, $city';
    return fullAddress ?? 'Delivery address';
  }
}

/// Order + customer context attached to a delivery assignment.
class RiderOrderContext {
  const RiderOrderContext({
    required this.orderRef,
    required this.orderInternalId,
    required this.category,
    required this.quantity,
    required this.totalPrice,
    required this.deliveryFee,
    this.customerName,
    this.customerPhone,
    this.destination,
  });

  final String orderRef;
  final String orderInternalId;
  final String category;
  final int quantity;
  final double totalPrice;
  final double deliveryFee;
  final String? customerName;
  final String? customerPhone;
  final RiderDestinationContext? destination;
}

/// Full rider-facing view of an assignment.
class RiderAssignmentView {
  const RiderAssignmentView({
    required this.assignment,
    required this.order,
    this.routePosition,
    this.planVersion,
    this.planState = 'unplanned',
    this.planStop,
    this.routingDataStale = false,
  });

  final DeliveryAssignment assignment;
  final RiderOrderContext order;
  final int? routePosition;
  final int? planVersion;
  final String planState;
  final RiderDispatchPlanStop? planStop;
  final bool routingDataStale;

  int? get planSequence => planStop?.sequence;
  bool get isPlanned => planStop != null;
  bool get isCurrentPlanStop =>
      planStop?.status == RiderDispatchStopStatus.pending && routePosition == 1;

  String get id => assignment.id;
  DeliveryStatus get status => assignment.status;

  bool get isAssigned => status == DeliveryStatus.assigned;
  bool get isInProgress => const [
    DeliveryStatus.accepted,
    DeliveryStatus.pickedUp,
    DeliveryStatus.onTheWay,
    DeliveryStatus.arrived,
  ].contains(status);
  bool get isTerminal =>
      status == DeliveryStatus.delivered || status == DeliveryStatus.declined;

  bool get shouldTrackLocation =>
      status == DeliveryStatus.onTheWay || status == DeliveryStatus.arrived;
}
