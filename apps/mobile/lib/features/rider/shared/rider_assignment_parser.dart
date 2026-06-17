import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/user.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

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

Map<String, dynamic>? _asMap(dynamic value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return Map<String, dynamic>.from(value);
  return null;
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
    createdAt: _parseDate(json['createdAt'] ?? json['created_at']),
    updatedAt: _parseDate(json['updatedAt'] ?? json['updated_at']),
  );
}

RiderAssignmentView parseAssignmentView(
  Map<String, dynamic> json, {
  int? routePosition,
}) {
  final assignment = parseAssignment(json);
  final orderJson = _asMap(json['order']);
  final order = orderJson != null
      ? _parseOrderContext(orderJson)
      : orderContextFromMock(assignment);

  return RiderAssignmentView(
    assignment: assignment,
    order: order,
    routePosition: routePosition,
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

List<RiderAssignmentView> parseAssignmentViews(List<dynamic> data) {
  return data.asMap().entries.map((entry) {
    final json = entry.value as Map<String, dynamic>;
    return parseAssignmentView(json, routePosition: entry.key + 1);
  }).toList();
}
