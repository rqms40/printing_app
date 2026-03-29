import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// Terminal statuses that mark an order as completed/done.
const _terminalStatuses = {
  OrderStatus.delivered,
  OrderStatus.completedPickup,
  OrderStatus.cancelled,
};

/// Statuses eligible for customer-initiated cancellation.
const _cancellableStatuses = {
  OrderStatus.orderPlaced,
  OrderStatus.fileVerified,
};

OrderStatus _parseOrderStatus(String value) {
  // Handle snake_case from server (e.g. 'order_placed' → 'orderPlaced')
  final camelCase = value.replaceAllMapped(
    RegExp(r'_([a-z])'),
    (m) => m.group(1)!.toUpperCase(),
  );
  return OrderStatus.values.firstWhere(
    (e) => e.name == camelCase,
    orElse: () => OrderStatus.orderPlaced,
  );
}

PaymentMethod _parsePaymentMethod(String value) {
  return PaymentMethod.values.firstWhere(
    (e) => e.name == value,
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
  return PaperSize.values.firstWhere(
    (e) => e.name == value,
    orElse: () => PaperSize.a4,
  );
}

ColorMode _parseColorMode(String value) {
  return ColorMode.values.firstWhere(
    (e) => e.name == value,
    orElse: () => ColorMode.fullColor,
  );
}

MediaType _parseMediaType(String value) {
  return MediaType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => MediaType.matte,
  );
}

PrintSides _parsePrintSides(String value) {
  return PrintSides.values.firstWhere(
    (e) => e.name == value,
    orElse: () => PrintSides.frontOnly,
  );
}

Binding _parseBinding(String value) {
  return Binding.values.firstWhere(
    (e) => e.name == value,
    orElse: () => Binding.none,
  );
}

FileFormat3D _parseFileFormat3D(String value) {
  return FileFormat3D.values.firstWhere(
    (e) => e.name == value,
    orElse: () => FileFormat3D.stl,
  );
}

Material3D _parseMaterial3D(String value) {
  return Material3D.values.firstWhere(
    (e) => e.name == value,
    orElse: () => Material3D.pla,
  );
}

PaperSpecs? _parsePaperSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return PaperSpecs(
    paperSize: _parsePaperSize(json['paperSize'] as String? ?? 'a4'),
    colorMode: _parseColorMode(json['colorMode'] as String? ?? 'fullColor'),
    mediaType: _parseMediaType(json['mediaType'] as String? ?? 'matte'),
    printSides: _parsePrintSides(json['printSides'] as String? ?? 'frontOnly'),
    binding: _parseBinding(json['binding'] as String? ?? 'none'),
  );
}

ThreeDSpecs? _parseThreeDSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return ThreeDSpecs(
    fileFormat: _parseFileFormat3D(json['fileFormat'] as String? ?? 'stl'),
    material: _parseMaterial3D(json['material'] as String? ?? 'pla'),
    color: json['color'] as String? ?? 'white',
    infillPercentage: (json['infillPercentage'] as num?)?.toInt() ?? 20,
    layerHeight: (json['layerHeight'] as num?)?.toDouble() ?? 0.2,
    supports: json['supports'] as bool? ?? false,
    notes: json['notes'] as String?,
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

Order _parseOrder(Map<String, dynamic> json) {
  return Order(
    id: json['id'] as String? ?? json['_id'] as String? ?? '',
    orderId: json['orderId'] as String? ?? '',
    userId: json['userId'] as String? ?? '',
    category: json['category'] as String? ?? '',
    fileUrl: json['fileUrl'] as String?,
    fileName: json['fileName'] as String?,
    paperSpecs: _parsePaperSpecs(json['paperSpecs'] as Map<String, dynamic>?),
    threeDSpecs: _parseThreeDSpecs(json['threeDSpecs'] as Map<String, dynamic>?),
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    totalPrice: (json['totalPrice'] as num?)?.toDouble() ?? 0,
    deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0,
    paymentMethod: _parsePaymentMethod(json['paymentMethod'] as String? ?? 'cod'),
    paymentStatus: _parsePaymentStatus(json['paymentStatus'] as String? ?? 'pending'),
    orderStatus: _parseOrderStatus(json['orderStatus'] as String? ?? 'orderPlaced'),
    declineReason: json['declineReason'] as String?,
    cancellationReason: json['cancellationReason'] as String?,
    cancelledAt: _parseDateNullable(json['cancelledAt']),
    deliveryOption: json['deliveryOption'] as String? ?? 'delivery',
    deliveryAddressId: json['deliveryAddressId'] as String?,
    assignedDriverId: json['assignedDriverId'] as String?,
    estimatedCompletionAt: _parseDateNullable(json['estimatedCompletionAt']),
    adminNotes: json['adminNotes'] as String?,
    trackingLink: json['trackingLink'] as String?,
    createdAt: _parseDate(json['createdAt']),
    updatedAt: _parseDate(json['updatedAt']),
  );
}

class OrdersNotifier extends StateNotifier<List<Order>> {
  OrdersNotifier() : super([]) {
    _fetchOrders();
    _connectWebSocket();
  }

  Future<void> _connectWebSocket() async {
    try {
      await WebSocketService.instance.connectOrders(
        onOrderUpdate: (data) {
          if (data is Map<String, dynamic>) {
            final updated = _parseOrder(data);
            state = [
              for (final order in state)
                if (order.orderId == updated.orderId) updated else order,
            ];
          }
        },
      );
    } catch (e) {
      debugPrint('WebSocket connection failed: $e');
    }
  }

  /// Orders that are still in progress (non-terminal statuses).
  List<Order> get activeOrders =>
      state.where((o) => !_terminalStatuses.contains(o.orderStatus)).toList();

  /// Orders that have reached a terminal status.
  List<Order> get completedOrders =>
      state.where((o) => _terminalStatuses.contains(o.orderStatus)).toList();

  Future<void> _fetchOrders() async {
    try {
      final response = await ApiClient.instance.get('/orders');
      final data = response.data as List<dynamic>;
      state = data.map((json) => _parseOrder(json as Map<String, dynamic>)).toList();
    } catch (_) {
      // Offline fallback
      state = List.of(MockData.orders);
    }
  }

  Future<void> refreshOrders() async => _fetchOrders();

  /// Add a new order to the top of the list.
  Future<void> addOrder(Order order) async {
    try {
      final response = await ApiClient.instance.post('/orders', data: {
        'category': order.category,
        'quantity': order.quantity,
        'totalPrice': order.totalPrice,
        'deliveryFee': order.deliveryFee,
        'paymentMethod': order.paymentMethod.name,
        'deliveryOption': order.deliveryOption,
        'fileName': order.fileName,
        'fileUrl': order.fileUrl,
        'paperSpecs': order.paperSpecs != null
            ? {
                'paperSize': order.paperSpecs!.paperSize.name,
                'colorMode': order.paperSpecs!.colorMode.name,
                'mediaType': order.paperSpecs!.mediaType.name,
                'printSides': order.paperSpecs!.printSides.name,
                'binding': order.paperSpecs!.binding.name,
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
      });
      final newOrder = _parseOrder(response.data as Map<String, dynamic>);
      state = [newOrder, ...state];
    } catch (_) {
      // Offline: add locally
      state = [order, ...state];
    }
  }

  /// Cancel an order if it is in a cancellable status.
  Future<void> cancelOrder(String orderId) async {
    try {
      await ApiClient.instance.patch('/orders/$orderId/status', data: {'status': 'cancelled'});
    } catch (_) {}
    // Update local state regardless
    state = [
      for (final order in state)
        if (order.id == orderId &&
            _cancellableStatuses.contains(order.orderStatus))
          order.copyWith(
            orderStatus: OrderStatus.cancelled,
            cancelledAt: DateTime.now(),
            updatedAt: DateTime.now(),
          )
        else
          order,
    ];
  }
}

final ordersProvider =
    StateNotifierProvider<OrdersNotifier, List<Order>>((ref) {
  return OrdersNotifier();
});
