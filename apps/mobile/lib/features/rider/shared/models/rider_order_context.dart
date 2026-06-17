import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';

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
      latitude != null &&
      longitude != null &&
      latitude != 0 &&
      longitude != 0;

  LatLng? get latLng =>
      hasCoordinates ? LatLng(latitude!, longitude!) : null;

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
  });

  final DeliveryAssignment assignment;
  final RiderOrderContext order;
  final int? routePosition;

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