import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/order_status_history.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/models/route_geometry.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// Terminal statuses that mark an order as completed/done.
const terminalStatuses = {
  OrderStatus.delivered,
  OrderStatus.collectedByCustomer,
  OrderStatus.issueWindowOpen,
  OrderStatus.completed,
  OrderStatus.cancelled,
  OrderStatus.fileRejected,
};

/// Statuses eligible for customer-initiated cancellation.
const cancellableStatuses = {
  OrderStatus.draft,
  OrderStatus.submitted,
  OrderStatus.needsQa,
  OrderStatus.clientCorrection,
  OrderStatus.proofApproval,
  OrderStatus.approvedForMatching,
};

dynamic _readJsonValue(
  Map<String, dynamic> json,
  String primaryKey, [
  String? secondaryKey,
  String? tertiaryKey,
  String? quaternaryKey,
]) {
  for (final key in [primaryKey, ?secondaryKey, ?tertiaryKey, ?quaternaryKey]) {
    if (json.containsKey(key)) return json[key];
  }
  return null;
}

int _readInt(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

int? _readBoundedInt(dynamic value, {required int minimum}) {
  final parsed = value is int
      ? value
      : value is num && value.isFinite && value == value.roundToDouble()
      ? value.toInt()
      : value is String
      ? int.tryParse(value)
      : null;
  return parsed != null && parsed >= minimum ? parsed : null;
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

bool _readBool(dynamic value, bool fallback) {
  if (value is bool) return value;
  if (value is num) return value != 0;
  if (value is String) {
    final normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].contains(normalized)) return true;
    if (['false', '0', 'no', 'n'].contains(normalized)) return false;
  }
  return fallback;
}

String? _normalizeOptionalText(dynamic value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

String? _readSpecialInstructions(
  Map<String, dynamic> json,
  Map<String, dynamic> specs,
  Map<String, String> specDisplayValues,
) {
  return _normalizeOptionalText(
        _readJsonValue(json, 'specialInstructions', 'special_instructions'),
      ) ??
      _normalizeOptionalText(specDisplayValues['special_instructions']) ??
      _normalizeOptionalText(specs['special_instructions']);
}

OrderStatus _parseOrderStatus(String value) {
  return parseMarketplaceOrderStatus(value);
}

PaymentMethod _parsePaymentMethod(String value) {
  final normalized = value.replaceAll(RegExp(r'[_-]'), '').toLowerCase();
  if (normalized == 'credits' ||
      normalized == 'gridcredit' ||
      normalized == 'gridcredits' ||
      normalized == 'pilotcredit' ||
      normalized == 'pilotcredits') {
    return PaymentMethod.gridCredits;
  }
  if (normalized == 'cash' || normalized == 'cashondelivery') {
    return PaymentMethod.cod;
  }
  return PaymentMethod.values.firstWhere(
    (e) => e.name.toLowerCase() == normalized,
    orElse: () => PaymentMethod.cod,
  );
}

PaymentStatus _parsePaymentStatus(String value) {
  return PaymentStatus.values.firstWhere(
    (e) => e.name == value,
    orElse: () => PaymentStatus.pending,
  );
}

PaperSize _parsePaperSize(String value) {
  final normalized = _serverValueToEnumName(value);
  return PaperSize.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => PaperSize.a4,
  );
}

ColorMode _parseColorMode(String value) {
  final normalized = _serverValueToEnumName(value);
  return ColorMode.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => ColorMode.fullColor,
  );
}

MediaType _parseMediaType(String value) {
  final normalized = _serverValueToEnumName(value);
  return MediaType.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => MediaType.matte,
  );
}

PrintSides _parsePrintSides(String value) {
  final normalized = _serverValueToEnumName(value);
  return PrintSides.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => PrintSides.frontOnly,
  );
}

Binding _parseBinding(String value) {
  final normalized = _serverValueToEnumName(value);
  return Binding.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => Binding.none,
  );
}

FileFormat3D _parseFileFormat3D(String value) {
  final normalized = _serverValueToEnumName(value);
  return FileFormat3D.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => FileFormat3D.stl,
  );
}

Material3D _parseMaterial3D(String value) {
  final normalized = _serverValueToEnumName(value);
  return Material3D.values.firstWhere(
    (e) => e.name == normalized,
    orElse: () => Material3D.pla,
  );
}

String _serverValueToEnumName(String value) {
  if (value == '3mf') return 'threeMf';
  return value.replaceAllMapped(
    RegExp(r'_([a-z0-9])'),
    (match) => match.group(1)!.toUpperCase(),
  );
}

PaperSpecs? _parsePaperSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return PaperSpecs(
    paperSize: _parsePaperSize(
      _readJsonValue(json, 'paperSize', 'paper_size')?.toString() ?? 'a4',
    ),
    colorMode: _parseColorMode(
      _readJsonValue(json, 'colorMode', 'color_mode')?.toString() ??
          'fullColor',
    ),
    mediaType: _parseMediaType(
      _readJsonValue(json, 'mediaType', 'media_type')?.toString() ?? 'matte',
    ),
    printSides: _parsePrintSides(
      _readJsonValue(json, 'printSides', 'print_sides')?.toString() ??
          'frontOnly',
    ),
    binding: _parseBinding(
      _readJsonValue(json, 'binding')?.toString() ?? 'none',
    ),
  );
}

ThreeDSpecs? _parseThreeDSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return ThreeDSpecs(
    fileFormat: _parseFileFormat3D(
      _readJsonValue(json, 'fileFormat', 'file_format')?.toString() ?? 'stl',
    ),
    material: _parseMaterial3D(
      _readJsonValue(json, 'material')?.toString() ?? 'pla',
    ),
    color: _readJsonValue(json, 'color')?.toString() ?? 'white',
    infillPercentage: _readInt(
      _readJsonValue(json, 'infillPercentage', 'infill_percentage'),
      20,
    ),
    layerHeight: _readDouble(
      _readJsonValue(json, 'layerHeight', 'layer_height'),
      0.2,
    ),
    supports: _readBool(_readJsonValue(json, 'supports'), false),
    notes: _readJsonValue(json, 'notes')?.toString(),
  );
}

OrderDeliveryAddress? _parseOrderDeliveryAddress(Map<String, dynamic> json) {
  final deliveryAddress = _readJsonValue(
    json,
    'deliveryAddress',
    'delivery_address',
  );
  final destination = _readJsonValue(json, 'destination');
  final raw = deliveryAddress is Map
      ? Map<String, dynamic>.from(deliveryAddress)
      : destination is Map
      ? Map<String, dynamic>.from(destination)
      : null;
  if (raw == null) return null;

  final fullAddress = _readJsonValue(
    raw,
    'fullAddress',
    'full_address',
  )?.toString().trim();
  final city = _readJsonValue(raw, 'city')?.toString().trim();
  if (fullAddress == null || fullAddress.isEmpty) return null;
  if (city == null || city.isEmpty) return null;

  return OrderDeliveryAddress(
    label: _normalizeOptionalText(_readJsonValue(raw, 'label')),
    fullAddress: fullAddress,
    barangay: _normalizeOptionalText(_readJsonValue(raw, 'barangay')),
    city: city,
    province: _normalizeOptionalText(_readJsonValue(raw, 'province')),
    zipCode: _normalizeOptionalText(_readJsonValue(raw, 'zipCode', 'zip_code')),
    landmark: _normalizeOptionalText(_readJsonValue(raw, 'landmark')),
    latitude: _readDouble(_readJsonValue(raw, 'latitude'), 0),
    longitude: _readDouble(_readJsonValue(raw, 'longitude'), 0),
  );
}

AssignedDeliverySlot? _parseAssignedSlot(Map<String, dynamic> json) {
  final rawSlot = _readJsonValue(json, 'assignedSlot', 'assigned_slot');
  if (rawSlot is! Map) return null;
  final slot = Map<String, dynamic>.from(rawSlot);
  final templateValue =
      _readJsonValue(slot, 'slotTemplateId', 'slot_template_id') ??
      _readJsonValue(slot, 'templateId', 'template_id');
  final date =
      (_readJsonValue(slot, 'date') ??
              _readJsonValue(slot, 'slotDate', 'slot_date'))
          ?.toString()
          .trim();
  final startTime = _readJsonValue(
    slot,
    'startTime',
    'start_time',
  )?.toString().trim();
  final endTime = _readJsonValue(
    slot,
    'endTime',
    'end_time',
  )?.toString().trim();
  if (templateValue == null ||
      date == null ||
      date.isEmpty ||
      startTime == null ||
      startTime.isEmpty ||
      endTime == null ||
      endTime.isEmpty) {
    return null;
  }
  return AssignedDeliverySlot(
    slotTemplateId: _readInt(templateValue, 0),
    date: date,
    startTime: startTime,
    endTime: endTime,
  );
}

Map<String, dynamic> _parseSpecValues(dynamic raw) {
  if (raw is! List) return const {};
  final specs = <String, dynamic>{};
  for (final entry in raw.whereType<Map>()) {
    final row = Map<String, dynamic>.from(entry);
    final key = _readJsonValue(row, 'specKey', 'spec_key')?.toString();
    if (key == null || key.isEmpty) continue;
    specs[key] = _readJsonValue(row, 'value');
  }
  return specs;
}

Map<String, String> _parseSpecDisplayValues(dynamic raw) {
  if (raw is! List) return const {};
  final display = <String, String>{};
  for (final entry in raw.whereType<Map>()) {
    final row = Map<String, dynamic>.from(entry);
    final key = _readJsonValue(row, 'specKey', 'spec_key')?.toString();
    if (key == null || key.isEmpty) continue;
    display[key] =
        _readJsonValue(row, 'displayValue', 'display_value')?.toString() ??
        _readJsonValue(row, 'value')?.toString() ??
        '';
  }
  return display;
}

DateTime _parseDate(dynamic value) {
  if (value is String) return DateTime.parse(value);
  return DateTime.now();
}

DateTime? _parseDateNullable(dynamic value) {
  if (value is String) return DateTime.parse(value);
  return null;
}

AssignedRiderContact? _parseAssignedRider(Map<String, dynamic> json) {
  final value =
      _readJsonValue(json, 'assignedRiderContact', 'assigned_rider_contact') ??
      _readJsonValue(json, 'assignedRider', 'assigned_rider');
  if (value is Map) {
    return AssignedRiderContact.fromJson(Map<String, dynamic>.from(value));
  }
  return null;
}

AssignedSupplierContact? _parseAssignedSupplier(Map<String, dynamic> json) {
  final value =
      _readJsonValue(
        json,
        'assignedSupplierContact',
        'assigned_supplier_contact',
      ) ??
      _readJsonValue(json, 'assignedSupplier', 'assigned_supplier');
  if (value is Map) {
    return AssignedSupplierContact.fromJson(Map<String, dynamic>.from(value));
  }
  return null;
}

Order _parseOrder(Map<String, dynamic> json) {
  final batch = _readJsonValue(json, 'batchOrder', 'batch_order');
  final batchJson = batch is Map ? Map<String, dynamic>.from(batch) : null;
  final specValuesRaw = _readJsonValue(json, 'specValues', 'spec_values');
  final specs = _parseSpecValues(specValuesRaw);
  final specDisplayValues = _parseSpecDisplayValues(specValuesRaw);
  final category = _readJsonValue(json, 'category')?.toString() ?? '';
  final itemsJson = _readJsonValue(json, 'items');
  final items = itemsJson is List
      ? itemsJson
            .whereType<Map>()
            .map((item) => _parseOrderLineItem(Map<String, dynamic>.from(item)))
            .toList()
      : const <OrderLineItem>[];
  final rawDeliveryGeometry = _readJsonValue(
    json,
    'deliveryRouteGeometry',
    'delivery_route_geometry',
  );
  final deliveryGeometry = GeoJsonLineString.tryParse(rawDeliveryGeometry);
  final rawRoutingStale = _readJsonValue(
    json,
    'deliveryRoutingDataStale',
    'delivery_routing_data_stale',
  );
  final rawPlanVersion = _readJsonValue(
    json,
    'deliveryPlanVersion',
    'delivery_plan_version',
  );
  final planVersion = _readBoundedInt(rawPlanVersion, minimum: 1);
  final rawLegDuration = _readJsonValue(
    json,
    'deliveryLegDurationSeconds',
    'delivery_leg_duration_seconds',
  );
  final legDuration = _readBoundedInt(rawLegDuration, minimum: 0);
  final rawLegDistance = _readJsonValue(
    json,
    'deliveryLegDistanceMeters',
    'delivery_leg_distance_meters',
  );
  final legDistance = _readBoundedInt(rawLegDistance, minimum: 0);
  final hasMalformedRouteContract =
      (rawDeliveryGeometry != null && deliveryGeometry == null) ||
      (rawPlanVersion != null && planVersion == null) ||
      (rawLegDuration != null && legDuration == null) ||
      (rawLegDistance != null && legDistance == null);

  return Order(
    id: _readJsonValue(json, 'id')?.toString() ?? '',
    orderId: _readJsonValue(json, 'orderId', 'order_id')?.toString() ?? '',
    userId: _readJsonValue(json, 'userId', 'user_id')?.toString() ?? '',
    batchOrderId: _readJsonValue(
      json,
      'batchOrderId',
      'batch_order_id',
    )?.toString(),
    batchId:
        _readJsonValue(json, 'batchId', 'batch_id')?.toString() ??
        (batchJson == null
            ? null
            : _readJsonValue(batchJson, 'batchRef', 'batch_ref')?.toString()),
    category: category,
    fileUrl: _readJsonValue(json, 'fileUrl', 'file_url')?.toString(),
    fileName: _readJsonValue(json, 'fileName', 'file_name')?.toString(),
    fileMetadataId:
        _readJsonValue(json, 'fileMetadataId', 'file_metadata_id') == null
        ? null
        : _readInt(
            _readJsonValue(json, 'fileMetadataId', 'file_metadata_id'),
            0,
          ),
    specs: specs,
    specDisplayValues: specDisplayValues,
    paperSpecs: _parsePaperSpecs(
      _readJsonValue(json, 'paperSpecs', 'paper_specs') is Map
          ? Map<String, dynamic>.from(
              _readJsonValue(json, 'paperSpecs', 'paper_specs') as Map,
            )
          : category == 'paper' && specs.isNotEmpty
          ? specs
          : null,
    ),
    threeDSpecs: _parseThreeDSpecs(
      _readJsonValue(json, 'threeDSpecs', 'three_d_specs') is Map
          ? Map<String, dynamic>.from(
              _readJsonValue(json, 'threeDSpecs', 'three_d_specs') as Map,
            )
          : category == '3d' && specs.isNotEmpty
          ? specs
          : null,
    ),
    quantity:
        int.tryParse(_readJsonValue(json, 'quantity')?.toString() ?? '1') ?? 1,
    totalPrice:
        double.tryParse(
          _readJsonValue(json, 'totalPrice', 'total_price')?.toString() ?? '0',
        ) ??
        0,
    deliveryFee:
        double.tryParse(
          _readJsonValue(json, 'deliveryFee', 'delivery_fee')?.toString() ??
              '0',
        ) ??
        0,
    paymentMethod: _parsePaymentMethod(
      _readJsonValue(json, 'paymentMethod', 'payment_method')?.toString() ??
          'cod',
    ),
    paymentStatus: _parsePaymentStatus(
      _readJsonValue(json, 'paymentStatus', 'payment_status')?.toString() ??
          'pending',
    ),
    orderStatus: _parseOrderStatus(
      _readJsonValue(json, 'orderStatus', 'order_status')?.toString() ??
          'orderPlaced',
    ),
    declineReason: _readJsonValue(
      json,
      'declineReason',
      'decline_reason',
    )?.toString(),
    cancellationReason: _readJsonValue(
      json,
      'cancellationReason',
      'cancellation_reason',
    )?.toString(),
    cancelledAt: _parseDateNullable(
      _readJsonValue(json, 'cancelledAt', 'cancelled_at'),
    ),
    deliveryOption:
        _readJsonValue(json, 'deliveryOption', 'delivery_option')?.toString() ??
        'delivery',
    deliveryAddressId: _readJsonValue(
      json,
      'deliveryAddressId',
      'delivery_address_id',
    )?.toString(),
    deliveryAddress: _parseOrderDeliveryAddress(json),
    assignedRiderId: _readJsonValue(
      json,
      'assignedRiderId',
      'assigned_rider_id',
    )?.toString(),
    deliveryAssignmentId: _readJsonValue(
      json,
      'deliveryAssignmentId',
      'delivery_assignment_id',
    )?.toString(),
    deliveryQueuePosition:
        _readJsonValue(
              json,
              'deliveryQueuePosition',
              'delivery_queue_position',
            ) ==
            null
        ? null
        : _readInt(
            _readJsonValue(
              json,
              'deliveryQueuePosition',
              'delivery_queue_position',
            ),
            0,
          ),
    deliveryQueueSize:
        _readJsonValue(json, 'deliveryQueueSize', 'delivery_queue_size') == null
        ? null
        : _readInt(
            _readJsonValue(json, 'deliveryQueueSize', 'delivery_queue_size'),
            0,
          ),
    canTrackDelivery: _readBool(
      _readJsonValue(json, 'canTrackDelivery', 'can_track_delivery'),
      false,
    ),
    deliveryPlanState: _normalizeOptionalText(
      _readJsonValue(json, 'deliveryPlanState', 'delivery_plan_state'),
    ),
    deliveryPlanVersion: planVersion,
    deliveryRouteGeometry: deliveryGeometry,
    deliveryRouteGeometryMalformed: hasMalformedRouteContract,
    deliveryLegDurationSeconds: legDuration,
    deliveryLegDistanceMeters: legDistance,
    deliveryRoutingDataStale: rawRoutingStale is bool ? rawRoutingStale : null,
    deliveryOtp: _normalizeOptionalText(
      _readJsonValue(json, 'deliveryOtp', 'delivery_otp'),
    ),
    assignedRider: _parseAssignedRider(json),
    assignedSupplier: _parseAssignedSupplier(json),
    estimatedCompletionAt: _parseDateNullable(
      _readJsonValue(json, 'estimatedCompletionAt', 'estimated_completion_at'),
    ),
    adminStatusNote: _readJsonValue(
      json,
      'adminStatusNote',
      'admin_status_note',
    )?.toString(),
    adminStatusSetAt: _parseDateNullable(
      _readJsonValue(json, 'adminStatusSetAt', 'admin_status_set_at'),
    ),
    adminNotes: _readJsonValue(json, 'adminNotes', 'admin_notes')?.toString(),
    trackingLink: _readJsonValue(
      json,
      'trackingLink',
      'tracking_link',
    )?.toString(),
    assignedSlot: _parseAssignedSlot(json),
    items: items,
    claims: _parseOrderClaims(json),
    statusHistory: _parseOrderStatusHistory(json),
    specialInstructions: _readSpecialInstructions(
      json,
      specs,
      specDisplayValues,
    ),
    createdAt: _parseDate(_readJsonValue(json, 'createdAt', 'created_at')),
    updatedAt: _parseDate(_readJsonValue(json, 'updatedAt', 'updated_at')),
  );
}

List<OrderClaim> _parseOrderClaims(Map<String, dynamic> json) {
  final raw = _readJsonValue(json, 'claims', 'materialClaims', 'material_claims');
  if (raw is! List) return const [];
  return raw
      .whereType<Map>()
      .map((row) => OrderClaim.fromJson(Map<String, dynamic>.from(row)))
      .toList();
}

List<OrderStatusHistory> _parseOrderStatusHistory(Map<String, dynamic> json) {
  final raw = _readJsonValue(json, 'statusHistory', 'status_history');
  if (raw is! List) return const [];
  final rows = <OrderStatusHistory>[];
  for (final entry in raw.whereType<Map>()) {
    final map = Map<String, dynamic>.from(entry);
    final fromRaw =
        _readJsonValue(map, 'fromStatus', 'from_status')?.toString() ?? '';
    final toRaw =
        _readJsonValue(map, 'toStatus', 'to_status')?.toString() ?? '';
    if (toRaw.isEmpty) continue;
    rows.add(
      OrderStatusHistory(
        id: _readJsonValue(map, 'id')?.toString() ?? '',
        orderId: _readJsonValue(map, 'orderId', 'order_id')?.toString() ?? '',
        fromStatus: parseMarketplaceOrderStatus(
          fromRaw.isEmpty ? 'submitted' : fromRaw,
        ),
        toStatus: parseMarketplaceOrderStatus(toRaw),
        changedByUserId:
            _readJsonValue(map, 'changedByUserId', 'changed_by_user_id')
                ?.toString(),
        notes: _readJsonValue(map, 'notes')?.toString(),
        createdAt: _parseDate(
          _readJsonValue(map, 'createdAt', 'created_at'),
        ),
      ),
    );
  }
  rows.sort((a, b) => a.createdAt.compareTo(b.createdAt));
  return rows;
}

OrderLineItem _parseOrderLineItem(Map<String, dynamic> json) {
  final specValuesRaw = _readJsonValue(json, 'specValues', 'spec_values');
  final specs = _parseSpecValues(specValuesRaw);
  final specDisplayValues = _parseSpecDisplayValues(specValuesRaw);
  final category = _readJsonValue(json, 'category')?.toString() ?? '';
  final paperSpecJson =
      (_readJsonValue(json, 'paperSpecs', 'paper_specs') ??
      _readJsonValue(json, 'paperSpec', 'paper_spec'));
  final threeDSpecJson =
      (_readJsonValue(json, 'threeDSpecs', 'three_d_specs') ??
      _readJsonValue(json, 'threeDSpec', 'three_d_spec'));
  return OrderLineItem(
    id: _readJsonValue(json, 'id')?.toString() ?? '',
    orderId: _readJsonValue(json, 'orderId', 'order_id')?.toString() ?? '',
    category: category,
    fileUrl: _readJsonValue(json, 'fileUrl', 'file_url')?.toString(),
    fileName: _readJsonValue(json, 'fileName', 'file_name')?.toString(),
    fileMetadataId:
        _readJsonValue(json, 'fileMetadataId', 'file_metadata_id') == null
        ? null
        : _readInt(
            _readJsonValue(json, 'fileMetadataId', 'file_metadata_id'),
            0,
          ),
    specs: specs,
    specDisplayValues: specDisplayValues,
    paperSpecs: _parsePaperSpecs(
      paperSpecJson is Map
          ? Map<String, dynamic>.from(paperSpecJson)
          : category == 'paper' && specs.isNotEmpty
          ? specs
          : null,
    ),
    threeDSpecs: _parseThreeDSpecs(
      threeDSpecJson is Map
          ? Map<String, dynamic>.from(threeDSpecJson)
          : category == '3d' && specs.isNotEmpty
          ? specs
          : null,
    ),
    quantity:
        int.tryParse(_readJsonValue(json, 'quantity')?.toString() ?? '1') ?? 1,
    totalPrice:
        double.tryParse(
          _readJsonValue(json, 'totalPrice', 'total_price')?.toString() ?? '0',
        ) ??
        0,
    specialInstructions: _readSpecialInstructions(
      json,
      specs,
      specDisplayValues,
    ),
  );
}

OrderLineItem _lineItemFromOrder(Order order) {
  return OrderLineItem(
    id: order.id,
    orderId: order.orderId,
    category: order.category,
    fileUrl: order.fileUrl,
    fileName: order.fileName,
    fileMetadataId: order.fileMetadataId,
    specs: order.specs,
    specDisplayValues: order.specDisplayValues,
    paperSpecs: order.paperSpecs,
    threeDSpecs: order.threeDSpecs,
    quantity: order.quantity,
    totalPrice: order.totalPrice,
    specialInstructions: order.specialInstructions,
  );
}

List<Order> _groupBatchOrders(List<Order> orders) {
  final grouped = <Order>[];
  final batchBuckets = <String, List<Order>>{};

  for (final order in orders) {
    if (order.items.isNotEmpty) {
      grouped.add(order);
      continue;
    }
    final batchKey = order.batchId ?? order.batchOrderId;
    if (batchKey == null || batchKey.isEmpty) {
      grouped.add(
        order.items.isEmpty
            ? order.copyWith(items: [_lineItemFromOrder(order)])
            : order,
      );
      continue;
    }
    batchBuckets.putIfAbsent(batchKey, () => []).add(order);
  }

  for (final entry in batchBuckets.entries) {
    final children = entry.value
      ..sort((a, b) => a.createdAt.compareTo(b.createdAt));
    final first = children.first;

    if (children.length == 1) {
      grouped.add(first.copyWith(items: [_lineItemFromOrder(first)]));
      continue;
    }

    final latest = children.reduce(
      (a, b) => a.updatedAt.isAfter(b.updatedAt) ? a : b,
    );
    final allTerminal = children.every(
      (order) => terminalStatuses.contains(order.orderStatus),
    );
    final hasCancelled = children.any(
      (order) => order.orderStatus == OrderStatus.cancelled,
    );
    final totalPrint = children.fold<double>(
      0,
      (sum, order) => sum + order.totalPrice,
    );
    final totalDelivery = children.fold<double>(
      0,
      (sum, order) => sum + order.deliveryFee,
    );

    grouped.add(
      first.copyWith(
        orderId: first.batchId ?? entry.key,
        category: 'batch',
        fileName: '${children.length} print jobs',
        quantity: children.fold<int>(0, (sum, order) => sum + order.quantity),
        totalPrice: totalPrint,
        deliveryFee: totalDelivery,
        orderStatus: allTerminal
            ? (hasCancelled ? OrderStatus.cancelled : latest.orderStatus)
            : latest.orderStatus,
        items: children.map(_lineItemFromOrder).toList(growable: false),
        updatedAt: latest.updatedAt,
      ),
    );
  }

  return grouped..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
}

class OrdersNotifier extends StateNotifier<List<Order>> {
  OrdersNotifier({
    List<Order> initialState = const [],
    bool skipBootstrap = false,
    this.onCompletionUpdate,
    this.onInitialLoadComplete,
    this.onInitialLoadResult,
    bool? realFlow,
    this.catalogStateResolver = _unavailableCatalogState,
  }) : realFlow = realFlow ?? AppConstants.realFlow,
       super(initialState) {
    if (!skipBootstrap) {
      _fetchOrders();
      _connectWebSocket();
    }
  }

  final Future<void> Function()? onCompletionUpdate;
  final VoidCallback? onInitialLoadComplete;
  final ValueChanged<bool>? onInitialLoadResult;
  final bool realFlow;
  final ProductCatalogState Function() catalogStateResolver;
  String? errorMessage;
  VoidCallback? _removeOrderUpdateListener;
  VoidCallback? _removeDeliveryQueueListener;
  bool _initialLoadReported = false;
  bool _sessionNeedsStart = false;
  int _sessionGeneration = 0;
  int _fetchGeneration = 0;

  bool _isCurrentSession(int generation) =>
      mounted && generation == _sessionGeneration;

  Future<void> _connectWebSocket() async {
    try {
      _removeOrderUpdateListener = WebSocketService.instance
          .listenForOrderUpdates(_handleOrderUpdate);
      _removeDeliveryQueueListener ??= WebSocketService.instance
          .listenForDeliveryQueueUpdates(_handleDeliveryQueueUpdate);
      await WebSocketService.instance.connectOrders(
        onConnect: _subscribeToAllOrders,
      );
    } catch (e) {
      debugPrint('WebSocket connection failed: $e');
    }
  }

  void _handleDeliveryQueueUpdate(Map<String, dynamic> data) {
    final orderId = data['orderId']?.toString();
    if (orderId == null || orderId.isEmpty) return;
    unawaited(_refreshOrderById(orderId));
  }

  Future<void> _refreshOrderById(String orderId) async {
    final sessionGeneration = _sessionGeneration;
    try {
      final response = await ApiClient.instance.get('/orders/$orderId');
      if (!_isCurrentSession(sessionGeneration)) return;
      final updated = _parseOrder(
        Map<String, dynamic>.from(response.data as Map),
      );
      if (!mounted) return;
      final index = state.indexWhere(
        (order) => order.id == updated.id || order.orderId == updated.orderId,
      );
      if (index < 0) {
        await _fetchOrders();
        return;
      }
      final next = [...state];
      next[index] = updated;
      state = _groupBatchOrders(next);
      _subscribeToAllOrders();
    } catch (error) {
      debugPrint(
        'OrdersProvider: queue promotion refetch failed for $orderId: $error',
      );
    }
  }

  void _handleOrderUpdate(dynamic data) {
    try {
      if (data is Map<String, dynamic>) {
        final updated = _parseOrder(data);
        final index = state.indexWhere(
          (order) => order.id == updated.id || order.orderId == updated.orderId,
        );

        if (index >= 0) {
          final next = [...state];
          next[index] = updated;
          state = next;
          if (updated.orderStatus == OrderStatus.delivered ||
              updated.orderStatus == OrderStatus.collectedByCustomer) {
            unawaited(onCompletionUpdate?.call());
          }
        } else {
          _fetchOrders();
        }
      }
    } catch (e) {
      debugPrint('OrdersProvider: WS order parse error: $e');
    }
  }

  @override
  void dispose() {
    _sessionGeneration += 1;
    _fetchGeneration += 1;
    _removeRealtimeListeners();
    super.dispose();
  }

  void _removeRealtimeListeners() {
    _removeOrderUpdateListener?.call();
    _removeOrderUpdateListener = null;
    _removeDeliveryQueueListener?.call();
    _removeDeliveryQueueListener = null;
  }

  /// Emits a `subscribe` event for every order currently in state.
  /// Safe to call multiple times — idempotent on the server.
  void _subscribeToAllOrders() {
    final orderRefs = <String>{};
    for (final order in state) {
      if (order.orderId.isNotEmpty) {
        orderRefs.add(order.orderId);
      }
      for (final item in order.lineItems) {
        if (item.orderId.isNotEmpty) {
          orderRefs.add(item.orderId);
        }
      }
    }

    for (final orderRef in orderRefs) {
      WebSocketService.instance.subscribeToOrder(orderRef);
    }
  }

  /// Orders that are still in progress (non-terminal statuses).
  List<Order> get activeOrders =>
      state.where((o) => !terminalStatuses.contains(o.orderStatus)).toList();

  /// Orders that have reached a terminal status.
  List<Order> get completedOrders =>
      state.where((o) => terminalStatuses.contains(o.orderStatus)).toList();

  Future<void> _fetchOrders() async {
    final sessionGeneration = _sessionGeneration;
    final fetchGeneration = ++_fetchGeneration;
    var authoritative = false;
    try {
      final response = await ApiClient.instance.get('/orders');
      final data = response.data as List<dynamic>;
      if (!_isCurrentSession(sessionGeneration) ||
          fetchGeneration != _fetchGeneration) {
        return;
      }
      state = _groupBatchOrders(
        data.map((json) => _parseOrder(json as Map<String, dynamic>)).toList(),
      );
      errorMessage = null;
      authoritative = true;
      debugPrint('OrdersProvider: Loaded ${state.length} orders from API');
    } catch (e) {
      if (!_isCurrentSession(sessionGeneration) ||
          fetchGeneration != _fetchGeneration) {
        return;
      }
      if (state.isEmpty && !realFlow) {
        debugPrint('OrdersProvider: API failed ($e), using MockData');
        state = List.of(MockData.orders);
        errorMessage = 'Showing offline demo orders';
      } else {
        debugPrint('OrdersProvider: API failed ($e), preserving current state');
        errorMessage = 'Unable to refresh live orders';
        state = [...state];
      }
    }
    if (!_isCurrentSession(sessionGeneration) ||
        fetchGeneration != _fetchGeneration) {
      return;
    }
    // Subscribe to all loaded orders in case socket connected before fetch completed.
    _subscribeToAllOrders();
    scheduleMicrotask(() => onInitialLoadResult?.call(authoritative));
    if (!_initialLoadReported) {
      _initialLoadReported = true;
      scheduleMicrotask(() => onInitialLoadComplete?.call());
    }
  }

  Future<void> refreshOrders() async => _fetchOrders();

  void clear() {
    _sessionGeneration += 1;
    _fetchGeneration += 1;
    _removeRealtimeListeners();
    state = const [];
    _initialLoadReported = false;
    _sessionNeedsStart = true;
  }

  Future<void> startSession() async {
    if (!_sessionNeedsStart) return;
    _sessionNeedsStart = false;
    await Future.wait([_fetchOrders(), _connectWebSocket()]);
  }

  /// Add a new order to the top of the list. Returns the created [Order]
  /// (server-assigned fields populated) so callers can use the real DB id.
  Future<Order> addOrder(Order order) async {
    final sessionGeneration = _sessionGeneration;
    try {
      final response = await ApiClient.instance.post(
        '/orders',
        data: {
          'category': order.category,
          'quantity': order.quantity,
          'totalPrice': order.totalPrice,
          'deliveryFee': order.deliveryFee,
          'paymentMethod': order.paymentMethod.orderApiValue,
          'deliveryOption': order.deliveryOption,
          'deliveryAddressId': _deliveryAddressIdValue(order.deliveryAddressId),
          'fileName': order.fileName,
          'fileUrl': order.fileUrl,
          'fileMetadataId': order.fileMetadataId,
          'specialInstructions': order.specialInstructions,
          'paperSpecs': order.paperSpecs != null
              ? {
                  'paperSize': order.paperSpecs!.paperSize.name,
                  'colorMode': order.paperSpecs!.colorMode.name,
                  'mediaType': order.paperSpecs!.mediaType.name,
                  'printSides': order.paperSpecs!.printSides.name,
                  'binding': order.paperSpecs!.binding.name,
                  'printMode': order.printMode,
                }
              : null,
          'threeDSpecs': order.threeDSpecs != null
              ? {
                  'fileFormat': order.threeDSpecs!.fileFormat.name,
                  'material': order.threeDSpecs!.material.name,
                  'color': order.threeDSpecs!.color,
                  'infillPercentage': order.threeDSpecs!.infillPercentage,
                  'layerHeight': order.threeDSpecs!.layerHeight,
                  'supports': order.threeDSpecs!.supports,
                  'notes': order.threeDSpecs!.notes,
                }
              : null,
        },
      );
      final newOrder = _parseOrder(response.data as Map<String, dynamic>);
      if (!_isCurrentSession(sessionGeneration)) return newOrder;
      state = [newOrder, ...state];
      WebSocketService.instance.subscribeToOrder(newOrder.orderId);
      debugPrint('OrdersProvider: Order created via API: ${newOrder.orderId}');
      return newOrder;
    } on DioException catch (e) {
      if (e.response?.statusCode == 403) {
        final data = e.response?.data;
        if (data is Map && data['code'] == 'BETA_ORDER_LIMIT_REACHED') {
          throw const BetaOrderLimitException();
        }
      }
      if (realFlow) rethrow;
      if (!_isCurrentSession(sessionGeneration)) return order;
      debugPrint('OrdersProvider: API create failed ($e), adding locally');
      state = [order, ...state];
      return order;
    } catch (e) {
      if (realFlow) rethrow;
      if (!_isCurrentSession(sessionGeneration)) return order;
      debugPrint('OrdersProvider: API create failed ($e), adding locally');
      state = [order, ...state];
      return order;
    }
  }

  /// Creates a shared-checkout batch and prepends one customer-facing order.
  Future<List<Order>> addBatchOrder({
    required List<CartItem> items,
    required String deliveryOption,
    String? deliveryAddressId,
    required double deliveryFee,
    required PaymentMethod paymentMethod,
    int? slotTemplateId,
    String? slotDate,
    @Deprecated('Use speedTier instead. Server no longer accepts this field.')
    bool priority = false,
    DeliverySpeedTier speedTier = DeliverySpeedTier.standard,
    List<Map<String, dynamic>> destinations = const [],
    List<int> itemDestinationIndices = const [],
    Map<String, dynamic>? temporaryAddress,
  }) async {
    final sessionGeneration = _sessionGeneration;
    final addressId = _deliveryAddressIdValue(deliveryAddressId);

    final mappedItems = items.indexed.map((entry) {
      final idx = entry.$1;
      final item = entry.$2;
      final payload = _cartItemPayload(item);
      final destIndex = idx < itemDestinationIndices.length
          ? itemDestinationIndices[idx]
          : 0;
      return {...payload, 'destinationIndex': destIndex};
    }).toList();

    final body = <String, dynamic>{
      'items': mappedItems,
      'deliveryFee': deliveryFee,
      'paymentMethod': paymentMethod.orderApiValue,
      'deliveryOption': deliveryOption,
      'deliveryAddressId': addressId,
      'speedTier': speedTier.toApi(),
      'slotTemplateId': ?slotTemplateId,
      'slotDate': ?slotDate,
      if (destinations.isNotEmpty) 'destinations': destinations,
      'temporaryAddress': ?temporaryAddress,
    };

    final Response response;
    try {
      response = await ApiClient.instance.post('/orders/batch', data: body);
    } on DioException catch (e) {
      if (e.response?.statusCode == 403) {
        final data = e.response?.data;
        if (data is Map && data['code'] == 'BETA_ORDER_LIMIT_REACHED') {
          throw const BetaOrderLimitException();
        }
      }
      rethrow;
    }

    final data = Map<String, dynamic>.from(response.data as Map);
    final batchId = data['batchId']?.toString();
    final batchAssignedSlot = _parseAssignedSlot(data);
    final rawOrders = data['orders'] as List<dynamic>? ?? const [];
    final createdOrders = _groupBatchOrders(
      rawOrders.map((json) {
        final orderJson = Map<String, dynamic>.from(json as Map);
        if (batchId != null && batchId.isNotEmpty) {
          orderJson['batchId'] = batchId;
        }
        final order = _parseOrder(orderJson);
        if (batchAssignedSlot == null || order.assignedSlot != null) {
          return order;
        }
        return order.copyWith(assignedSlot: batchAssignedSlot);
      }).toList(),
    );

    if (!_isCurrentSession(sessionGeneration)) return createdOrders;
    state = [...createdOrders, ...state];
    for (final order in createdOrders) {
      WebSocketService.instance.subscribeToOrder(order.orderId);
    }
    debugPrint(
      'OrdersProvider: Batch order created via API: ${createdOrders.length} orders',
    );
    return createdOrders;
  }

  Future<List<Order>> placeCheckout(CheckoutState state) {
    if (state.paymentMethod == null) {
      throw StateError('paymentMethod is required');
    }
    final scheduledSlot = state.speedTier == DeliverySpeedTier.scheduled
        ? state.scheduledSlot
        : null;
    final hasTemporaryAddress =
        state.mode == DeliveryMode.delivery &&
        (state.temporaryAddress?.isValid ?? false);
    final addressIdString = hasTemporaryAddress
        ? null
        : state.singleAddress?.id;

    // Multi-drop: expand each item by quantity so each copy lands at its
    // assigned destination. Build parallel `items` and `itemDestinationIndices`
    // lists indexed into `destinations`.
    if (state.mode == DeliveryMode.multidrop) {
      final validDrops = state.drops
          .where((drop) => drop.hasValidDestination)
          .toList();
      if (validDrops.length != state.drops.length) {
        throw StateError('Every drop needs a delivery destination');
      }
      final destinations = validDrops.map((drop) {
        final addressId = drop.addressId;
        if (addressId != null && addressId > 0) {
          return <String, dynamic>{'addressId': addressId, 'label': drop.label};
        }

        final temporaryAddress = drop.temporaryAddress;
        if (temporaryAddress != null && temporaryAddress.isValid) {
          return <String, dynamic>{
            'label': temporaryAddress.displayLabel,
            'address': temporaryAddress.toJson(),
          };
        }

        throw StateError('Invalid drop destination');
      }).toList();
      final dropIndexById = <String, int>{};
      for (var index = 0; index < validDrops.length; index++) {
        dropIndexById[validDrops[index].id] = index;
      }

      final expandedItems = <CartItem>[];
      final indices = <int>[];
      for (final item in state.items) {
        final assignments = state.unitAssignments[item.id] ?? const <String?>[];
        for (var copy = 0; copy < item.quantity; copy++) {
          final dropId = copy < assignments.length ? assignments[copy] : null;
          final di = dropId == null ? null : dropIndexById[dropId];
          if (di == null) {
            throw StateError('Every item copy needs a delivery destination');
          }
          expandedItems.add(item.copyWith(quantity: 1));
          indices.add(di);
        }
      }

      return addBatchOrder(
        items: expandedItems,
        deliveryOption: 'delivery',
        deliveryAddressId: null,
        deliveryFee: 0,
        paymentMethod: state.paymentMethod!,
        slotTemplateId: scheduledSlot?.templateId,
        slotDate: scheduledSlot?.date,
        priority: state.speedTier == DeliverySpeedTier.priority,
        speedTier: state.speedTier,
        destinations: destinations,
        itemDestinationIndices: indices,
      );
    }

    return addBatchOrder(
      items: state.items,
      deliveryOption: state.mode == DeliveryMode.pickup ? 'pickup' : 'delivery',
      deliveryAddressId: addressIdString,
      deliveryFee: 0,
      paymentMethod: state.paymentMethod!,
      slotTemplateId: scheduledSlot?.templateId,
      slotDate: scheduledSlot?.date,
      priority: state.speedTier == DeliverySpeedTier.priority,
      speedTier: state.speedTier,
      temporaryAddress: hasTemporaryAddress
          ? state.temporaryAddress!.toJson()
          : null,
    );
  }

  Future<List<Order>> submitRfq(CheckoutState checkout) async {
    final catalogState = catalogStateResolver();
    if (!catalogState.canSubmit) {
      throw StateError('Refresh the catalog before submitting this request.');
    }
    if (checkout.items.isEmpty) throw StateError('RFQ cart is empty');
    if (checkout.hasMixedPricingModes) {
      throw StateError(
        'Quoted requests and priced orders must be submitted separately.',
      );
    }
    if (!checkout.hasPendingQuoteItems) {
      throw StateError('RFQ cart requires quote-request items');
    }

    final items = <Map<String, dynamic>>[];
    for (final item in checkout.items) {
      final slug = item.productSlug?.trim();
      final requiredDate = item.requiredDate;
      if (slug == null || slug.isEmpty || item.quantity < 1) {
        throw StateError('Each request needs an active product and quantity.');
      }
      final product = catalogState.catalog.productBySlug(slug);
      if (product == null || product.pricingModel != 'quote_required') {
        throw StateError('Refresh the catalog before submitting this request.');
      }
      if (requiredDate == null || !requiredDate.isAfter(DateTime.now())) {
        throw StateError('Each request needs a future required date.');
      }
      if (item.fileMetadataId <= 0 || item.specs.isEmpty) {
        throw StateError('Each request needs specifications and artwork.');
      }
      items.add({
        'categorySlug': slug,
        'quantity': item.quantity,
        'requiredDate': _isoDateOnly(requiredDate),
        'fileMetadataId': item.fileMetadataId,
        'specs': item.specs,
        if (item.specialInstructions?.trim().isNotEmpty ?? false)
          'specialInstructions': item.specialInstructions!.trim(),
      });
    }

    final body = <String, dynamic>{
      'items': items,
      'deliveryOption': checkout.mode == DeliveryMode.pickup
          ? 'pickup'
          : 'delivery',
    };
    if (checkout.mode == DeliveryMode.delivery) {
      final temporaryAddress = checkout.temporaryAddress;
      final addressId = _deliveryAddressIdValue(checkout.singleAddress?.id);
      if (temporaryAddress?.isValid ?? false) {
        body['temporaryAddress'] = temporaryAddress!.toJson();
      } else if (addressId != null) {
        body['deliveryAddressId'] = addressId;
      } else {
        throw StateError('A delivery address is required for RFQ submission.');
      }
    } else if (checkout.mode == DeliveryMode.multidrop) {
      throw StateError(
        'Submit RFQ items to one delivery destination at a time.',
      );
    }

    final sessionGeneration = _sessionGeneration;
    final response = await ApiClient.instance.post(
      '/orders/requests/batch',
      data: body,
    );
    final data = Map<String, dynamic>.from(response.data as Map);
    final batchId = data['batchId']?.toString();
    final rawOrders = data['orders'] as List<dynamic>? ?? const [];
    final created = _groupBatchOrders(
      rawOrders.map((raw) {
        final json = Map<String, dynamic>.from(raw as Map);
        if (batchId?.isNotEmpty ?? false) json['batchId'] = batchId;
        return _parseOrder(json);
      }).toList(),
    );
    if (_isCurrentSession(sessionGeneration)) {
      state = [...created, ...state];
      for (final order in created) {
        WebSocketService.instance.subscribeToOrder(order.orderId);
      }
    }
    return created;
  }

  /// Cancel an order if it is in a cancellable status.
  Future<void> cancelOrder(String orderId) async {
    // Optimistic local update so the UI responds immediately
    state = [
      for (final order in state)
        if (order.id == orderId &&
            cancellableStatuses.contains(order.orderStatus))
          order.copyWith(
            orderStatus: OrderStatus.cancelled,
            cancelledAt: DateTime.now(),
            updatedAt: DateTime.now(),
          )
        else
          order,
    ];
    try {
      await ApiClient.instance.patch('/orders/$orderId/cancel');
      // WS orderUpdate event will re-sync the confirmed state from the server
    } catch (e) {
      debugPrint('OrdersProvider: cancel failed ($e) — reverting local state');
      await _fetchOrders();
    }
  }

  /// Client: resubmit revised artwork after Ops requested correction.
  /// Upload via files API first, then pass [fileMetadataId].
  Future<void> resubmitCorrection(
    String orderId, {
    required int fileMetadataId,
    String? notes,
  }) async {
    await ApiClient.instance.post(
      '/orders/$orderId/resubmit-correction',
      data: {
        'fileMetadataId': fileMetadataId,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    await _fetchOrders();
  }

  /// Client: approve proof → approved_for_matching.
  Future<void> approveProof(String orderId) async {
    await ApiClient.instance.post('/orders/$orderId/approve-proof');
    await _fetchOrders();
  }

  /// Client: reject proof → client_correction.
  Future<void> rejectProof(String orderId, {String? reason}) async {
    await ApiClient.instance.post(
      '/orders/$orderId/reject-proof',
      data: {
        if (reason != null && reason.trim().isNotEmpty) 'reason': reason.trim(),
      },
    );
    await _fetchOrders();
  }

  /// Client: open a material claim after collection/delivery (Claims queue).
  Future<void> reportConcern(
    String orderId, {
    required String category,
    String? notes,
  }) async {
    final parsedId = int.tryParse(orderId);
    if (parsedId == null) {
      throw ArgumentError('Invalid order id');
    }
    await ApiClient.instance.post(
      '/issues',
      data: {
        'orderId': parsedId,
        'category': category,
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      },
    );
    await _fetchOrders();
  }

  /// Client: confirms receipt of order, moving it from issue_window_open to completed.
  Future<void> confirmReceipt(String orderId) async {
    await ApiClient.instance.patch('/orders/$orderId/confirm-receipt');
    await _fetchOrders();
  }
}

Map<String, dynamic> _cartItemPayload(CartItem item) {
  return {
    'category': item.category,
    'quantity': item.quantity,
    'totalPrice': item.printSubtotal,
    'fileName': item.fileName,
    'fileUrl': item.filePath,
    'fileMetadataId': item.fileMetadataId,
    'specialInstructions': item.specialInstructions,
    'specs': item.specs.isEmpty ? null : item.specs,
    'paperSpecs': item.paperSpecs != null
        ? {
            'paperSize': item.paperSpecs!.paperSize.name,
            'colorMode': item.paperSpecs!.colorMode.name,
            'mediaType': item.paperSpecs!.mediaType.name,
            'printSides': item.paperSpecs!.printSides.name,
            'binding': item.paperSpecs!.binding.name,
          }
        : null,
    'threeDSpecs': item.threeDSpecs != null
        ? {
            'fileFormat': item.threeDSpecs!.fileFormat.name,
            'material': item.threeDSpecs!.material.name,
            'color': item.threeDSpecs!.color,
            'infillPercentage': item.threeDSpecs!.infillPercentage,
            'layerHeight': item.threeDSpecs!.layerHeight,
            'supports': item.threeDSpecs!.supports,
            'notes': item.threeDSpecs!.notes,
          }
        : null,
  };
}

int? _deliveryAddressIdValue(String? id) {
  if (id == null || id.isEmpty) return null;
  return int.tryParse(id);
}

String _isoDateOnly(DateTime date) =>
    '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

ProductCatalogState _unavailableCatalogState() => ProductCatalogState(
  catalog: ProductCatalog.v110Snapshot(),
  isServerBacked: false,
  isLoading: false,
  error: StateError('Catalog authority unavailable'),
);

final ordersProvider = StateNotifierProvider<OrdersNotifier, List<Order>>((
  ref,
) {
  return OrdersNotifier(
    catalogStateResolver: () => ref.read(productCatalogProvider),
    onCompletionUpdate: () => ref.read(accountStateProvider.notifier).refresh(),
    onInitialLoadComplete: () {
      ref.read(ordersInitialLoadCompleteProvider.notifier).state = true;
    },
    onInitialLoadResult: (authoritative) {
      ref.read(ordersInitialLoadAuthoritativeProvider.notifier).state =
          authoritative;
    },
  );
});

final ordersInitialLoadCompleteProvider = StateProvider<bool>((ref) => false);
final ordersInitialLoadAuthoritativeProvider = StateProvider<bool>(
  (ref) => false,
);

/// Reactive list of active (non-terminal) orders, sorted newest-updated first.
/// Widgets that watch this will rebuild automatically on any WS or API update.
final activeOrdersProvider = Provider<List<Order>>((ref) {
  return ref
      .watch(ordersProvider)
      .where((o) => !terminalStatuses.contains(o.orderStatus))
      .toList()
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
});

/// Reactive list of completed/terminal orders, sorted newest-updated first.
final completedOrdersProvider = Provider<List<Order>>((ref) {
  return ref
      .watch(ordersProvider)
      .where((o) => terminalStatuses.contains(o.orderStatus))
      .toList()
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
});

/// The 5 most-recently-updated orders across all statuses (home screen feed).
final recentOrdersProvider = Provider<List<Order>>((ref) {
  final all = List<Order>.from(ref.watch(ordersProvider))
    ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  return all.take(5).toList();
});
