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
const terminalStatuses = {
  OrderStatus.delivered,
  OrderStatus.completedPickup,
  OrderStatus.cancelled,
};

/// Statuses eligible for customer-initiated cancellation.
const cancellableStatuses = {
  OrderStatus.orderPlaced,
  OrderStatus.fileVerified,
};

dynamic _readJsonValue(
  Map<String, dynamic> json,
  String camelKey, [
  String? snakeKey,
]) {
  return json[camelKey] ?? (snakeKey != null ? json[snakeKey] : null);
}

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
    id: _readJsonValue(json, 'id')?.toString() ?? '',
    orderId: _readJsonValue(json, 'orderId', 'order_id')?.toString() ?? '',
    userId: _readJsonValue(json, 'userId', 'user_id')?.toString() ?? '',
    category: _readJsonValue(json, 'category')?.toString() ?? '',
    fileUrl: _readJsonValue(json, 'fileUrl', 'file_url')?.toString(),
    fileName: _readJsonValue(json, 'fileName', 'file_name')?.toString(),
    paperSpecs: _parsePaperSpecs(
      _readJsonValue(json, 'paperSpecs', 'paper_specs') as Map<String, dynamic>?,
    ),
    threeDSpecs: _parseThreeDSpecs(
      _readJsonValue(json, 'threeDSpecs', 'three_d_specs')
          as Map<String, dynamic>?,
    ),
    quantity: int.tryParse(_readJsonValue(json, 'quantity')?.toString() ?? '1') ?? 1,
    totalPrice:
        double.tryParse(_readJsonValue(json, 'totalPrice', 'total_price')?.toString() ?? '0') ??
            0,
    deliveryFee:
        double.tryParse(_readJsonValue(json, 'deliveryFee', 'delivery_fee')?.toString() ?? '0') ??
            0,
    paymentMethod: _parsePaymentMethod(
      _readJsonValue(json, 'paymentMethod', 'payment_method')?.toString() ?? 'cod',
    ),
    paymentStatus: _parsePaymentStatus(
      _readJsonValue(json, 'paymentStatus', 'payment_status')?.toString() ??
          'pending',
    ),
    orderStatus: _parseOrderStatus(
      _readJsonValue(json, 'orderStatus', 'order_status')?.toString() ??
          'orderPlaced',
    ),
    declineReason: _readJsonValue(json, 'declineReason', 'decline_reason')?.toString(),
    cancellationReason: _readJsonValue(
      json,
      'cancellationReason',
      'cancellation_reason',
    )?.toString(),
    cancelledAt: _parseDateNullable(_readJsonValue(json, 'cancelledAt', 'cancelled_at')),
    deliveryOption:
        _readJsonValue(json, 'deliveryOption', 'delivery_option')?.toString() ??
            'delivery',
    deliveryAddressId:
        _readJsonValue(json, 'deliveryAddressId', 'delivery_address_id')
            ?.toString(),
    assignedDriverId:
        _readJsonValue(json, 'assignedDriverId', 'assigned_driver_id')
            ?.toString(),
    estimatedCompletionAt: _parseDateNullable(
      _readJsonValue(json, 'estimatedCompletionAt', 'estimated_completion_at'),
    ),
    adminNotes: _readJsonValue(json, 'adminNotes', 'admin_notes')?.toString(),
    trackingLink: _readJsonValue(json, 'trackingLink', 'tracking_link')?.toString(),
    createdAt: _parseDate(_readJsonValue(json, 'createdAt', 'created_at')),
    updatedAt: _parseDate(_readJsonValue(json, 'updatedAt', 'updated_at')),
  );
}

class OrdersNotifier extends StateNotifier<List<Order>> {
  OrdersNotifier({
    List<Order> initialState = const [],
    bool skipBootstrap = false,
  }) : super(initialState) {
    if (!skipBootstrap) {
      _fetchOrders();
      _connectWebSocket();
    }
  }

  Future<void> _connectWebSocket() async {
    try {
      await WebSocketService.instance.connectOrders(
        onOrderUpdate: (data) {
          if (data is Map<String, dynamic>) {
            final updated = _parseOrder(data);
            final index = state.indexWhere(
              (order) => order.id == updated.id || order.orderId == updated.orderId,
            );

            if (index >= 0) {
              final next = [...state];
              next[index] = updated;
              state = next;
            } else {
              _fetchOrders();
            }
          }
        },
        // Once socket is confirmed connected, subscribe to every loaded order room.
        onConnect: _subscribeToAllOrders,
      );
    } catch (e) {
      debugPrint('WebSocket connection failed: $e');
    }
  }

  /// Emits a `subscribe` event for every order currently in state.
  /// Safe to call multiple times — idempotent on the server.
  void _subscribeToAllOrders() {
    for (final order in state) {
      WebSocketService.instance.subscribeToOrder(order.orderId);
    }
  }

  /// Orders that are still in progress (non-terminal statuses).
  List<Order> get activeOrders =>
      state.where((o) => !terminalStatuses.contains(o.orderStatus)).toList();

  /// Orders that have reached a terminal status.
  List<Order> get completedOrders =>
      state.where((o) => terminalStatuses.contains(o.orderStatus)).toList();

  Future<void> _fetchOrders() async {
    try {
      final response = await ApiClient.instance.get('/orders');
      final data = response.data as List<dynamic>;
      state = data.map((json) => _parseOrder(json as Map<String, dynamic>)).toList();
      debugPrint('OrdersProvider: Loaded ${state.length} orders from API');
    } catch (e) {
      debugPrint('OrdersProvider: API failed ($e), using MockData');
      state = List.of(MockData.orders);
    }
    // Subscribe to all loaded orders in case socket connected before fetch completed.
    _subscribeToAllOrders();
  }

  Future<void> refreshOrders() async => _fetchOrders();

  /// Add a new order to the top of the list. Returns the created [Order]
  /// (server-assigned fields populated) so callers can use the real DB id.
  Future<Order> addOrder(Order order) async {
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
      WebSocketService.instance.subscribeToOrder(newOrder.orderId);
      debugPrint('OrdersProvider: Order created via API: ${newOrder.orderId}');
      return newOrder;
    } catch (e) {
      debugPrint('OrdersProvider: API create failed ($e), adding locally');
      state = [order, ...state];
      return order;
    }
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
}

final ordersProvider =
    StateNotifierProvider<OrdersNotifier, List<Order>>((ref) {
  return OrdersNotifier();
});

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
