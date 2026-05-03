import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:flutter/foundation.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// Tabs for the order queue screen.
enum QueueTab { newOrders, inProduction, done, all }

/// Convert camelCase enum name to snake_case for the server.
String _toSnakeCase(String input) {
  return input.replaceAllMapped(
    RegExp(r'[A-Z]'),
    (m) => '_${m.group(0)!.toLowerCase()}',
  );
}

dynamic _readJsonValue(
  Map<String, dynamic> json,
  String camelKey, [
  String? snakeKey,
]) {
  return json[camelKey] ?? (snakeKey != null ? json[snakeKey] : null);
}

int _readInt(dynamic value, int fallback) {
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

String? _normalizeOptionalText(dynamic value) {
  final text = value?.toString().trim();
  return text == null || text.isEmpty ? null : text;
}

String _toCamelCase(String value) {
  final normalized = value.replaceAll('-', '_').toLowerCase();
  return normalized.replaceAllMapped(
    RegExp(r'_([a-z0-9])'),
    (m) => m.group(1)!.toUpperCase(),
  );
}

T _parseEnum<T extends Enum>(Iterable<T> values, String? value, T fallback) {
  final normalized = _toCamelCase(value ?? fallback.name);
  return values.firstWhere((e) => e.name == normalized, orElse: () => fallback);
}

OrderStatus _parseOrderStatus(String value) {
  // Handle snake_case from server (e.g. 'order_placed' → 'orderPlaced')
  return _parseEnum(OrderStatus.values, value, OrderStatus.orderPlaced);
}

PaymentMethod _parsePaymentMethod(String value) {
  final normalized = value.replaceAll(RegExp(r'[_-]'), '').toLowerCase();
  if (normalized == 'credits' || normalized == 'gridcredit') {
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
  return _parseEnum(PaymentStatus.values, value, PaymentStatus.pending);
}

PaperSpecs? _parsePaperSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return PaperSpecs(
    paperSize: _parseEnum(
      PaperSize.values,
      _readJsonValue(json, 'paperSize', 'paper_size')?.toString(),
      PaperSize.a4,
    ),
    colorMode: _parseEnum(
      ColorMode.values,
      _readJsonValue(json, 'colorMode', 'color_mode')?.toString(),
      ColorMode.fullColor,
    ),
    mediaType: _parseEnum(
      MediaType.values,
      _readJsonValue(json, 'mediaType', 'media_type')?.toString(),
      MediaType.matte,
    ),
    printSides: _parseEnum(
      PrintSides.values,
      _readJsonValue(json, 'printSides', 'print_sides')?.toString(),
      PrintSides.frontOnly,
    ),
    binding: _parseEnum(
      Binding.values,
      _readJsonValue(json, 'binding')?.toString(),
      Binding.none,
    ),
  );
}

ThreeDSpecs? _parseThreeDSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return ThreeDSpecs(
    fileFormat: _parseEnum(
      FileFormat3D.values,
      _readJsonValue(json, 'fileFormat', 'file_format')?.toString(),
      FileFormat3D.stl,
    ),
    material: _parseEnum(
      Material3D.values,
      _readJsonValue(json, 'material')?.toString(),
      Material3D.pla,
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
    supports: _readJsonValue(json, 'supports') as bool? ?? false,
    notes: _readJsonValue(json, 'notes')?.toString(),
  );
}

DateTime _parseDate(dynamic value) {
  if (value is String) return DateTime.parse(value);
  return DateTime.now();
}

DateTime? _parseDateNullable(dynamic value) {
  if (value is String) return DateTime.parse(value);
  return null;
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

Order _parseOrder(Map<String, dynamic> json) {
  final batch = _readJsonValue(json, 'batchOrder', 'batch_order');
  final batchJson = batch is Map ? Map<String, dynamic>.from(batch) : null;
  final itemsJson = _readJsonValue(json, 'items');
  final items = itemsJson is List
      ? itemsJson
            .whereType<Map>()
            .map((item) => _parseOrderLineItem(Map<String, dynamic>.from(item)))
            .toList()
      : const <OrderLineItem>[];

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
    category: _readJsonValue(json, 'category')?.toString() ?? '',
    fileUrl: _readJsonValue(json, 'fileUrl', 'file_url')?.toString(),
    fileName: _readJsonValue(json, 'fileName', 'file_name')?.toString(),
    fileMetadataId:
        _readJsonValue(json, 'fileMetadataId', 'file_metadata_id') == null
        ? null
        : _readInt(
            _readJsonValue(json, 'fileMetadataId', 'file_metadata_id'),
            0,
          ),
    paperSpecs: _parsePaperSpecs(
      _readJsonValue(json, 'paperSpecs', 'paper_specs')
          as Map<String, dynamic>?,
    ),
    threeDSpecs: _parseThreeDSpecs(
      _readJsonValue(json, 'threeDSpecs', 'three_d_specs')
          as Map<String, dynamic>?,
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
    assignedDriverId: _readJsonValue(
      json,
      'assignedDriverId',
      'assigned_driver_id',
    )?.toString(),
    deliveryAssignmentId: _readJsonValue(
      json,
      'deliveryAssignmentId',
      'delivery_assignment_id',
    )?.toString(),
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
    items: items,
    specialInstructions: _normalizeOptionalText(
      _readJsonValue(json, 'specialInstructions', 'special_instructions'),
    ),
    createdAt: _parseDate(_readJsonValue(json, 'createdAt', 'created_at')),
    updatedAt: _parseDate(_readJsonValue(json, 'updatedAt', 'updated_at')),
  );
}

OrderLineItem _parseOrderLineItem(Map<String, dynamic> json) {
  return OrderLineItem(
    id: _readJsonValue(json, 'id')?.toString() ?? '',
    orderId: _readJsonValue(json, 'orderId', 'order_id')?.toString() ?? '',
    category: _readJsonValue(json, 'category')?.toString() ?? '',
    fileUrl: _readJsonValue(json, 'fileUrl', 'file_url')?.toString(),
    fileName: _readJsonValue(json, 'fileName', 'file_name')?.toString(),
    fileMetadataId:
        _readJsonValue(json, 'fileMetadataId', 'file_metadata_id') == null
        ? null
        : _readInt(
            _readJsonValue(json, 'fileMetadataId', 'file_metadata_id'),
            0,
          ),
    paperSpecs: _parsePaperSpecs(
      (_readJsonValue(json, 'paperSpecs', 'paper_specs') ??
              _readJsonValue(json, 'paperSpec', 'paper_spec'))
          as Map<String, dynamic>?,
    ),
    threeDSpecs: _parseThreeDSpecs(
      (_readJsonValue(json, 'threeDSpecs', 'three_d_specs') ??
              _readJsonValue(json, 'threeDSpec', 'three_d_spec'))
          as Map<String, dynamic>?,
    ),
    quantity:
        int.tryParse(_readJsonValue(json, 'quantity')?.toString() ?? '1') ?? 1,
    totalPrice:
        double.tryParse(
          _readJsonValue(json, 'totalPrice', 'total_price')?.toString() ?? '0',
        ) ??
        0,
    specialInstructions: _normalizeOptionalText(
      _readJsonValue(json, 'specialInstructions', 'special_instructions'),
    ),
  );
}

/// State for the order queue.
class QueueState {
  const QueueState({
    required this.orders,
    this.activeTab = QueueTab.all,
    this.searchQuery = '',
  });

  final List<Order> orders;
  final QueueTab activeTab;
  final String searchQuery;

  QueueState copyWith({
    List<Order>? orders,
    QueueTab? activeTab,
    String? searchQuery,
  }) {
    return QueueState(
      orders: orders ?? this.orders,
      activeTab: activeTab ?? this.activeTab,
      searchQuery: searchQuery ?? this.searchQuery,
    );
  }

  /// Returns orders filtered by the active tab and search query.
  List<Order> get filteredOrders {
    var result = orders;

    // Filter by tab
    switch (activeTab) {
      case QueueTab.newOrders:
        result = result
            .where(
              (o) =>
                  o.orderStatus == OrderStatus.orderPlaced ||
                  o.orderStatus == OrderStatus.fileVerified,
            )
            .toList();
        break;
      case QueueTab.inProduction:
        result = result
            .where(
              (o) =>
                  o.orderStatus == OrderStatus.printingInProgress ||
                  o.orderStatus == OrderStatus.finishingMounting ||
                  o.orderStatus == OrderStatus.qualityChecked,
            )
            .toList();
        break;
      case QueueTab.done:
        result = result
            .where(
              (o) =>
                  o.orderStatus == OrderStatus.delivered ||
                  o.orderStatus == OrderStatus.completedPickup,
            )
            .toList();
        break;
      case QueueTab.all:
        break;
    }

    // Filter by search
    if (searchQuery.isNotEmpty) {
      final query = searchQuery.toLowerCase();
      result = result
          .where((o) => o.orderId.toLowerCase().contains(query))
          .toList();
    }

    return result;
  }
}

/// StateNotifier managing the order queue.
class QueueNotifier extends StateNotifier<QueueState> {
  QueueNotifier() : super(const QueueState(orders: [])) {
    _fetchOrders();
    _connectWebSocket();
  }

  Future<void> _connectWebSocket() async {
    try {
      WebSocketService.instance.listenForOrderUpdates((data) {
        if (data is Map<String, dynamic>) {
          // Refresh full list when any order changes (new or updated)
          _fetchOrders();
        }
      });
      await WebSocketService.instance.connectOrders();
    } catch (e) {
      debugPrint('Admin WS failed: $e');
    }
  }

  Future<void> _fetchOrders() async {
    try {
      final response = await ApiClient.instance.get('/admin/orders');
      final data = response.data as List<dynamic>;
      final orders = data
          .map((json) => _parseOrder(json as Map<String, dynamic>))
          .toList();
      state = state.copyWith(orders: orders);
    } catch (_) {
      // Offline fallback
      state = state.copyWith(orders: List<Order>.from(MockData.orders));
    }
  }

  Future<void> refreshOrders() async => _fetchOrders();

  void setTab(QueueTab tab) {
    state = state.copyWith(activeTab: tab);
  }

  void searchByOrderId(String query) {
    state = state.copyWith(searchQuery: query);
  }

  Future<void> updateOrderStatus(String orderId, OrderStatus newStatus) async {
    try {
      await ApiClient.instance.patch(
        '/admin/orders/$orderId/status',
        data: {'status': _toSnakeCase(newStatus.name)},
      );
    } catch (_) {}
    // Update local state regardless
    final updated = state.orders.map((o) {
      if (o.id == orderId) {
        return o.copyWith(orderStatus: newStatus, updatedAt: DateTime.now());
      }
      return o;
    }).toList();

    state = state.copyWith(orders: updated);
  }
}

/// Provider for the queue state.
final queueProvider = StateNotifierProvider<QueueNotifier, QueueState>((ref) {
  return QueueNotifier();
});
