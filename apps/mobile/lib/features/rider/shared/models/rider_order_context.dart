import 'package:latlong2/latlong.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

enum RiderDispatchStopStatus { pending, completed, skipped }

enum RiderDispatchStopKind { pickup, dropoff }

class RiderSupplierPickup {
  const RiderSupplierPickup({
    required this.supplierId,
    required this.businessName,
    this.address,
    required this.latitude,
    required this.longitude,
  });

  final String supplierId;
  final String businessName;
  final String? address;
  final double latitude;
  final double longitude;

  LatLng get latLng => LatLng(latitude, longitude);
}

class RiderDispatchPlanStop {
  const RiderDispatchPlanStop({
    required this.assignmentId,
    required this.sequence,
    required this.status,
    this.kind = RiderDispatchStopKind.dropoff,
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
  final RiderDispatchStopKind kind;
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
    this.deliveryFeeMinor,
    this.customerName,
    this.customerPhone,
    this.destination,
    this.paymentMethod,
    this.finalTotalMinor,
    this.codCollectionStatus,
  });

  final String orderRef;
  final String orderInternalId;
  final String category;
  final int quantity;
  final double totalPrice;
  final double deliveryFee;
  /// Delivery fee in PHP centavos when the API sends marketplace money.
  final String? deliveryFeeMinor;
  final String? customerName;
  final String? customerPhone;
  final RiderDestinationContext? destination;

  /// Wire payment method (`cod`, `pilot_credit`, …).
  final String? paymentMethod;

  /// Final amount in PHP centavos when provided by API.
  final String? finalTotalMinor;

  /// COD collection lifecycle when loaded: pending / collected / failed.
  final String? codCollectionStatus;

  bool get isCod {
    final method = (paymentMethod ?? '').toLowerCase().trim();
    return method == 'cod' ||
        method == 'cash' ||
        method == 'cash_on_delivery' ||
        method == 'cashondelivery';
  }

  /// Rider pay for this drop-off in pesos. Prefers minor units when present.
  double get deliveryFeePesos {
    final minor = int.tryParse(deliveryFeeMinor ?? '');
    if (minor != null && minor > 0) return minor / 100.0;
    return deliveryFee;
  }

  /// Exact COD amount in major units (pesos) for display.
  double get codAmountMajor {
    final minor = int.tryParse(finalTotalMinor ?? '');
    if (minor != null) return minor / 100.0;
    return totalPrice + deliveryFee;
  }

  bool get codCollected =>
      codCollectionStatus == 'collected' ||
      codCollectionStatus == 'reconciled';

  bool get codFailed => codCollectionStatus == 'failed';
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
    this.planStops = const [],
    this.supplierPickup,
    this.routingDataStale = false,
  });

  final DeliveryAssignment assignment;
  final RiderOrderContext order;
  final int? routePosition;
  final int? planVersion;
  final String planState;
  final RiderDispatchPlanStop? planStop;
  final List<RiderDispatchPlanStop> planStops;
  final RiderSupplierPickup? supplierPickup;
  final bool routingDataStale;

  int? get planSequence => planStop?.sequence;
  bool get isPlanned => planStop != null || planStops.isNotEmpty;
  bool get isCurrentPlanStop =>
      planStop?.status == RiderDispatchStopStatus.pending && routePosition == 1;

  List<RiderDispatchPlanStop> get legs {
    if (planStops.isNotEmpty) return planStops;
    if (planStop != null) return [planStop!];
    return const [];
  }

  bool get isPickupActive {
    if (status == DeliveryStatus.pickedUp ||
        status == DeliveryStatus.onTheWay ||
        status == DeliveryStatus.arrived) {
      return false;
    }
    if (planStop != null) {
      return planStop!.kind == RiderDispatchStopKind.pickup;
    }
    return supplierPickup != null &&
        (status == DeliveryStatus.assigned ||
            status == DeliveryStatus.accepted);
  }

  String get activeStopTitle {
    if (isPickupActive) {
      return supplierPickup?.businessName ?? 'Supplier';
    }
    return order.customerName ?? 'Customer';
  }

  String get activeStopSubtitle {
    if (isPickupActive) {
      final address = supplierPickup?.address?.trim();
      if (address != null && address.isNotEmpty) return 'Pickup · $address';
      return 'Pickup';
    }
    return order.destination?.shortLabel ?? 'Delivery address';
  }

  /// Pin used on rider maps — same coordinates as the order destination shown
  /// in delivery info. Prefer the live order snapshot over a stale plan stop
  /// so the pin always matches the address text.
  LatLng? get pinDestination =>
      order.destination?.latLng ??
      legs
          .where((stop) => stop.kind == RiderDispatchStopKind.dropoff)
          .firstOrNull
          ?.destination ??
      planStop?.destination;

  LatLng? get supplierPin =>
      supplierPickup?.latLng ??
      legs
          .where((stop) => stop.kind == RiderDispatchStopKind.pickup)
          .firstOrNull
          ?.destination;

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
      status == DeliveryStatus.delivered ||
      status == DeliveryStatus.declined ||
      status == DeliveryStatus.failed;

  /// Marketplace jobs share GPS from assignment (ride to supplier) through
  /// handoff. Beta / shop-origin jobs stay pickup-through-arrived.
  bool get shouldTrackLocation {
    return status == DeliveryStatus.assigned ||
        status == DeliveryStatus.accepted ||
        status == DeliveryStatus.pickedUp ||
        status == DeliveryStatus.onTheWay ||
        status == DeliveryStatus.arrived;
  }

  bool get canMarkFailed =>
      status == DeliveryStatus.pickedUp ||
      status == DeliveryStatus.onTheWay ||
      status == DeliveryStatus.arrived;
}
