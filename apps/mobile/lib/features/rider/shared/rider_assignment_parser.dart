import 'package:latlong2/latlong.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/user.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/models/route_geometry.dart';

DeliveryStatus parseDeliveryStatus(String value) {
  final camelCase = value.replaceAllMapped(
    RegExp(r'_([a-z])'),
    (m) => m.group(1)!.toUpperCase(),
  );
  return DeliveryStatus.values.firstWhere(
    (e) => e.name == camelCase,
    orElse: () => DeliveryStatus.assigned,
  );
}

String serverDeliveryStatus(DeliveryStatus status) {
  return switch (status) {
    DeliveryStatus.assigned => 'assigned',
    DeliveryStatus.accepted => 'accepted',
    DeliveryStatus.declined => 'declined',
    DeliveryStatus.pickedUp => 'picked_up',
    DeliveryStatus.onTheWay => 'on_the_way',
    DeliveryStatus.arrived => 'arrived',
    DeliveryStatus.delivered => 'delivered',
  };
}

DateTime? _parseDateNullable(dynamic value) {
  if (value is String) return DateTime.tryParse(value);
  return null;
}

DateTime _parseDate(dynamic value) {
  if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
  return DateTime.now();
}

String _readId(dynamic value) => value?.toString() ?? '';

double? _readDouble(dynamic value) {
  if (value == null) return null;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString());
}

String? _readString(dynamic value) => value?.toString();

int? _readInt(dynamic value) {
  if (value == null) return null;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString());
}

int? _readStrictInt(dynamic value, {required int minimum}) {
  final parsed = value is int
      ? value
      : value is num && value.isFinite && value == value.roundToDouble()
      ? value.toInt()
      : value is String
      ? int.tryParse(value)
      : null;
  return parsed != null && parsed >= minimum ? parsed : null;
}

String _readPlanAssignmentId(dynamic value) {
  if (value is int) return value > 0 ? value.toString() : '';
  if (value is num) {
    if (!value.isFinite || value <= 0 || value != value.roundToDouble()) {
      return '';
    }
    return value.toInt().toString();
  }
  if (value is! String) return '';
  final text = value.trim();
  if (text.isEmpty) return '';
  final numeric = num.tryParse(text);
  if (numeric != null &&
      (!numeric.isFinite ||
          numeric <= 0 ||
          numeric != numeric.roundToDouble())) {
    return '';
  }
  return text;
}

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
}

DeliveryProof? _parseProof(Map<String, dynamic> json) {
  final proofJson = _asMap(json['proof'] ?? json['delivery_proof']);
  final source = proofJson ?? json;
  final type = _readString(
    source['type'] ?? source['proofType'] ?? source['proof_type'],
  );
  if (type == null || type.isEmpty) return null;

  return DeliveryProof(
    type: type,
    fileId: _readInt(
      source['fileId'] ??
          source['file_id'] ??
          source['proofFileId'] ??
          source['proof_file_id'],
    ),
    objectKey: _readString(
      source['objectKey'] ??
          source['object_key'] ??
          source['proofObjectKey'] ??
          source['proof_object_key'],
    ),
    signatureData: _readString(
      source['signatureData'] ??
          source['signature_data'] ??
          source['proofSignatureData'] ??
          source['proof_signature_data'],
    ),
    capturedAt: _parseDateNullable(
      source['capturedAt'] ??
          source['captured_at'] ??
          source['proofCapturedAt'] ??
          source['proof_captured_at'],
    ),
    capturedByRiderId: _readString(
      source['capturedByRiderId'] ??
          source['captured_by_rider_id'] ??
          source['proofCapturedByRiderId'] ??
          source['proof_captured_by_rider_id'],
    ),
  );
}

RiderDestinationContext? _parseDestination(Map<String, dynamic>? json) {
  if (json == null) return null;
  return RiderDestinationContext(
    fullAddress: _readString(json['fullAddress'] ?? json['full_address']),
    landmark: _readString(json['landmark']),
    barangay: _readString(json['barangay']),
    city: _readString(json['city']),
    latitude: _readDouble(json['latitude']),
    longitude: _readDouble(json['longitude']),
  );
}

RiderOrderContext _parseOrderContext(Map<String, dynamic>? json) {
  if (json == null) {
    return const RiderOrderContext(
      orderRef: 'Unknown',
      orderInternalId: '0',
      category: 'print',
      quantity: 1,
      totalPrice: 0,
      deliveryFee: 0,
    );
  }

  final destination = _parseDestination(_asMap(json['destination']));

  final customer = _asMap(json['user'] ?? json['customer']);
  return RiderOrderContext(
    orderRef: _readString(json['orderId'] ?? json['order_id']) ?? 'Unknown',
    orderInternalId: _readId(json['id']),
    category: _readString(json['category']) ?? 'print',
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    totalPrice: _readDouble(json['totalPrice'] ?? json['total_price']) ?? 0,
    deliveryFee: _readDouble(json['deliveryFee'] ?? json['delivery_fee']) ?? 0,
    customerName: _readString(customer?['fullName'] ?? customer?['full_name']),
    customerPhone: _readString(
      customer?['phoneNumber'] ?? customer?['phone_number'],
    ),
    destination: destination,
  );
}

DeliveryAssignment parseAssignment(Map<String, dynamic> json) {
  return DeliveryAssignment(
    id: _readId(json['id'] ?? json['_id']),
    orderId: _readId(json['orderId'] ?? json['order_id']),
    riderId: _readId(json['riderId'] ?? json['rider_id']),
    status: parseDeliveryStatus(json['status'] as String? ?? 'assigned'),
    assignedAt: _parseDateNullable(json['assignedAt'] ?? json['assigned_at']),
    acceptedAt: _parseDateNullable(json['acceptedAt'] ?? json['accepted_at']),
    pickedUpAt: _parseDateNullable(json['pickedUpAt'] ?? json['picked_up_at']),
    onTheWayAt: _parseDateNullable(json['onTheWayAt'] ?? json['on_the_way_at']),
    arrivedAt: _parseDateNullable(json['arrivedAt'] ?? json['arrived_at']),
    deliveredAt: _parseDateNullable(
      json['deliveredAt'] ?? json['delivered_at'],
    ),
    declineReason: _readString(json['declineReason'] ?? json['decline_reason']),
    proofPhotoUrl: _readString(
      json['proofPhotoUrl'] ?? json['proof_photo_url'],
    ),
    proof: _parseProof(json),
    createdAt: _parseDate(json['createdAt'] ?? json['created_at']),
    updatedAt: _parseDate(json['updatedAt'] ?? json['updated_at']),
  );
}

RiderAssignmentView parseAssignmentView(
  Map<String, dynamic> json, {
  int? routePosition,
  bool allowMockFallback = true,
}) {
  final assignment = parseAssignment(json);
  final orderJson = _asMap(json['order']);
  if (orderJson == null && !allowMockFallback) {
    throw FormatException(
      'Assignment ${assignment.id} is missing its order relation',
    );
  }
  final order = orderJson != null
      ? _parseOrderContext(orderJson)
      : orderContextFromMock(assignment);

  final stop = _parsePlanStop(
    _asMap(json['dispatchPlanStop'] ?? json['dispatch_plan_stop']),
    fallbackAssignmentId: assignment.id,
  );

  return RiderAssignmentView(
    assignment: assignment,
    order: order,
    routePosition:
        routePosition ??
        _readStrictInt(
          json['routePosition'] ?? json['route_position'],
          minimum: 1,
        ),
    planVersion: _readStrictInt(
      json['dispatchPlanVersion'] ?? json['dispatch_plan_version'],
      minimum: 1,
    ),
    planState:
        _readString(json['dispatchPlanState'] ?? json['dispatch_plan_state']) ??
        (stop == null ? 'unplanned' : 'planned'),
    planStop: stop,
  );
}

RiderOrderContext orderContextFromMock(DeliveryAssignment assignment) {
  final order = MockData.orders.cast<Order?>().firstWhere(
    (o) => o?.id == assignment.orderId,
    orElse: () => null,
  );
  if (order == null) {
    return RiderOrderContext(
      orderRef: assignment.orderId,
      orderInternalId: assignment.orderId,
      category: 'print',
      quantity: 1,
      totalPrice: 0,
      deliveryFee: 0,
    );
  }

  Address? address;
  if (order.deliveryAddressId != null) {
    address = MockData.addresses.cast<Address?>().firstWhere(
      (a) => a?.id == order.deliveryAddressId,
      orElse: () => null,
    );
  }

  User? customer;
  try {
    customer = MockData.users.firstWhere((u) => u.id == order.userId);
  } catch (_) {
    customer = null;
  }

  return RiderOrderContext(
    orderRef: order.orderId,
    orderInternalId: order.id,
    category: order.category,
    quantity: order.quantity,
    totalPrice: order.totalPrice,
    deliveryFee: order.deliveryFee,
    customerName: customer?.fullName,
    customerPhone: customer?.phoneNumber,
    destination: address == null
        ? null
        : RiderDestinationContext(
            fullAddress: address.fullAddress,
            landmark: address.landmark,
            barangay: address.barangay,
            city: address.city,
            latitude: address.latitude,
            longitude: address.longitude,
          ),
  );
}

List<RiderAssignmentView> parseAssignmentViews(
  List<dynamic> data, {
  bool allowMockFallback = true,
}) {
  return data.asMap().entries.map((entry) {
    final json = Map<String, dynamic>.from(entry.value as Map);
    return parseAssignmentView(
      json,
      routePosition: _readStrictInt(
        json['routePosition'] ?? json['route_position'],
        minimum: 1,
      ),
      allowMockFallback: allowMockFallback,
    );
  }).toList();
}

RiderDispatchPlan? parseRiderDispatchPlan(dynamic value) {
  if (value is! Map) return null;
  final json = Map<String, dynamic>.from(value);
  final version = _readStrictInt(json['version'], minimum: 1);
  final originLatitude = _readDouble(
    json['originLatitude'] ?? json['origin_latitude'],
  );
  final originLongitude = _readDouble(
    json['originLongitude'] ?? json['origin_longitude'],
  );
  final rawStops = json['stops'];
  if (version == null) return null;
  if (!_validCoordinate(originLatitude, originLongitude)) return null;
  if (rawStops is! List) return null;

  final stops = <RiderDispatchPlanStop>[];
  for (final rawStop in rawStops) {
    final stop = _parsePlanStop(_asMap(rawStop));
    if (stop == null) return null;
    stops.add(stop);
  }
  stops.sort((left, right) => left.sequence.compareTo(right.sequence));
  final sequences = stops.map((stop) => stop.sequence).toSet();
  final assignmentIds = stops.map((stop) => stop.assignmentId).toSet();
  if (sequences.length != stops.length ||
      assignmentIds.length != stops.length) {
    return null;
  }

  return RiderDispatchPlan(
    version: version,
    origin: LatLng(originLatitude!, originLongitude!),
    provider: _readString(json['provider']) ?? 'unknown',
    profile: _readString(json['profile']) ?? 'unknown',
    routingDataStale:
        json['routingDataStale'] == true || json['routing_data_stale'] == true,
    stops: List.unmodifiable(stops),
    totalDurationSeconds: _readInt(
      json['totalDurationSeconds'] ?? json['total_duration_seconds'],
    ),
    totalDistanceMeters: _readInt(
      json['totalDistanceMeters'] ?? json['total_distance_meters'],
    ),
  );
}

RiderDispatchPlanStop? _parsePlanStop(
  Map<String, dynamic>? json, {
  String? fallbackAssignmentId,
}) {
  if (json == null) return null;
  final assignmentId = _readPlanAssignmentId(
    json['assignmentId'] ?? json['assignment_id'] ?? fallbackAssignmentId,
  );
  final sequence = _readStrictInt(json['sequence'], minimum: 1);
  final latitude = _readDouble(
    json['destinationLatitude'] ?? json['destination_latitude'],
  );
  final longitude = _readDouble(
    json['destinationLongitude'] ?? json['destination_longitude'],
  );
  final duration = _readStrictInt(
    json['legDurationSeconds'] ?? json['leg_duration_seconds'],
    minimum: 0,
  );
  final distance = _readStrictInt(
    json['legDistanceMeters'] ?? json['leg_distance_meters'],
    minimum: 0,
  );
  final statusValue = _readString(json['status']);
  final status = RiderDispatchStopStatus.values.firstWhere(
    (candidate) => candidate.name == statusValue,
    orElse: () => RiderDispatchStopStatus.pending,
  );
  if (assignmentId.isEmpty || sequence == null) return null;
  if (!_validCoordinate(latitude, longitude)) return null;
  if (duration == null || distance == null) {
    return null;
  }
  if (statusValue == null ||
      !RiderDispatchStopStatus.values.any(
        (candidate) => candidate.name == statusValue,
      )) {
    return null;
  }
  final rawGeometry = json['legGeometry'] ?? json['leg_geometry'];
  final geometry = GeoJsonLineString.tryParse(rawGeometry);
  return RiderDispatchPlanStop(
    assignmentId: assignmentId,
    sequence: sequence,
    status: status,
    destinationLatitude: latitude!,
    destinationLongitude: longitude!,
    legDurationSeconds: duration,
    legDistanceMeters: distance,
    geometry: geometry,
    geometryMalformed: geometry == null,
  );
}

bool _validCoordinate(double? latitude, double? longitude) =>
    latitude != null &&
    longitude != null &&
    latitude.isFinite &&
    longitude.isFinite &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180;

List<RiderAssignmentView> mergeRiderAssignmentViewsWithPlan({
  required List<RiderAssignmentView> active,
  required List<RiderAssignmentView> history,
  required RiderDispatchPlan? plan,
}) {
  if (plan == null) {
    final ids = <String>{};
    return [
      for (final view in [...active, ...history])
        if (ids.add(view.id)) view,
    ];
  }

  final byId = <String, RiderAssignmentView>{};
  for (final view in history) {
    byId.putIfAbsent(view.id, () => view);
  }
  for (final view in active) {
    byId[view.id] = view;
  }

  final plannedIds = <String>{};
  final planned = <RiderAssignmentView>[];
  var remainingPosition = 0;
  for (final stop in plan.stops) {
    plannedIds.add(stop.assignmentId);
    final isPending = stop.status == RiderDispatchStopStatus.pending;
    if (isPending) remainingPosition++;
    final source = byId[stop.assignmentId];
    if (source == null) {
      throw FormatException(
        'Dispatch stop ${stop.assignmentId} has no assignment snapshot',
      );
    }
    planned.add(
      RiderAssignmentView(
        assignment: source.assignment,
        order: source.order,
        routePosition: isPending ? remainingPosition : null,
        planVersion: plan.version,
        planState: 'planned',
        planStop: stop,
        routingDataStale: plan.routingDataStale,
      ),
    );
  }

  final unplanned = <RiderAssignmentView>[];
  for (final view in [...active, ...history]) {
    if (!plannedIds.contains(view.id) &&
        !unplanned.any((candidate) => candidate.id == view.id)) {
      unplanned.add(view);
    }
  }
  return [...planned, ...unplanned];
}
