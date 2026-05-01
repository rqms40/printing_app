import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/profile/providers/account_state_provider.dart';
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
const cancellableStatuses = {OrderStatus.orderPlaced, OrderStatus.fileVerified};

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
  final normalized = value.replaceAll(RegExp(r'[_-]'), '').toLowerCase();
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
        batchJson?['batchRef']?.toString(),
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
    paperSpecs: order.paperSpecs,
    threeDSpecs: order.threeDSpecs,
    quantity: order.quantity,
    totalPrice: order.totalPrice,
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
  }) : super(initialState) {
    if (!skipBootstrap) {
      _fetchOrders();
      _connectWebSocket();
    }
  }

  final Future<void> Function()? onCompletionUpdate;
  VoidCallback? _removeOrderUpdateListener;

  Future<void> _connectWebSocket() async {
    try {
      _removeOrderUpdateListener = WebSocketService.instance
          .listenForOrderUpdates(_handleOrderUpdate);
      await WebSocketService.instance.connectOrders(
        onConnect: _subscribeToAllOrders,
      );
    } catch (e) {
      debugPrint('WebSocket connection failed: $e');
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
              updated.orderStatus == OrderStatus.completedPickup) {
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
    _removeOrderUpdateListener?.call();
    _removeOrderUpdateListener = null;
    super.dispose();
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
      if (!mounted) return;
      state = _groupBatchOrders(
        data.map((json) => _parseOrder(json as Map<String, dynamic>)).toList(),
      );
      debugPrint('OrdersProvider: Loaded ${state.length} orders from API');
    } catch (e) {
      debugPrint('OrdersProvider: API failed ($e), using MockData');
      if (!mounted) return;
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
      final response = await ApiClient.instance.post(
        '/orders',
        data: {
          'category': order.category,
          'quantity': order.quantity,
          'totalPrice': order.totalPrice,
          'deliveryFee': order.deliveryFee,
          'paymentMethod': order.paymentMethod.name,
          'deliveryOption': order.deliveryOption,
          'deliveryAddressId': _deliveryAddressIdValue(order.deliveryAddressId),
          'fileName': order.fileName,
          'fileUrl': order.fileUrl,
          'fileMetadataId': order.fileMetadataId,
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
      debugPrint('OrdersProvider: API create failed ($e), adding locally');
      state = [order, ...state];
      return order;
    } catch (e) {
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
  }) async {
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
      'paymentMethod': paymentMethod.name,
      'deliveryOption': deliveryOption,
      'deliveryAddressId': addressId,
      'speedTier': speedTier.toApi(),
      'slotTemplateId': ?slotTemplateId,
      'slotDate': ?slotDate,
      if (destinations.isNotEmpty) 'destinations': destinations,
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
    final rawOrders = data['orders'] as List<dynamic>? ?? const [];
    final createdOrders = _groupBatchOrders(
      rawOrders.map((json) {
        final orderJson = Map<String, dynamic>.from(json as Map);
        if (batchId != null && batchId.isNotEmpty) {
          orderJson['batchId'] = batchId;
        }
        return _parseOrder(orderJson);
      }).toList(),
    );

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
    final addressIdString = state.singleAddress?.id;

    // Multi-drop: expand each item by quantity so each copy lands at its
    // assigned destination. Build parallel `items` and `itemDestinationIndices`
    // lists indexed into `destinations`.
    if (state.mode == DeliveryMode.multidrop) {
      final destinations = state.drops
          .where((d) => d.addressId != null)
          .map((d) => {'addressId': d.addressId!, 'label': d.label})
          .toList();
      final dropIndexById = <String, int>{};
      var validIdx = 0;
      for (final d in state.drops) {
        if (d.addressId != null) {
          dropIndexById[d.id] = validIdx;
          validIdx++;
        }
      }

      final expandedItems = <CartItem>[];
      final indices = <int>[];
      for (final item in state.items) {
        final assignments =
            state.unitAssignments[item.id] ?? const <String?>[];
        for (var copy = 0; copy < item.quantity; copy++) {
          final dropId =
              copy < assignments.length ? assignments[copy] : null;
          final di = dropId == null ? null : dropIndexById[dropId];
          // Skip copies whose drop has no address — caller should block this
          // upstream, but be defensive.
          if (di == null) continue;
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
        slotTemplateId: state.scheduledSlot?.templateId,
        slotDate: state.scheduledSlot?.date,
        priority: state.speedTier == DeliverySpeedTier.priority,
        speedTier: state.speedTier,
        destinations: destinations,
        itemDestinationIndices: indices,
      );
    }

    return addBatchOrder(
      items: state.items,
      deliveryOption:
          state.mode == DeliveryMode.pickup ? 'pickup' : 'delivery',
      deliveryAddressId: addressIdString,
      deliveryFee: 0,
      paymentMethod: state.paymentMethod!,
      slotTemplateId: state.scheduledSlot?.templateId,
      slotDate: state.scheduledSlot?.date,
      priority: state.speedTier == DeliverySpeedTier.priority,
      speedTier: state.speedTier,
    );
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

Map<String, dynamic> _cartItemPayload(CartItem item) {
  return {
    'category': item.category,
    'quantity': item.quantity,
    'totalPrice': item.printSubtotal,
    'fileName': item.fileName,
    'fileUrl': item.filePath,
    'fileMetadataId': item.fileMetadataId,
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

final ordersProvider = StateNotifierProvider<OrdersNotifier, List<Order>>((
  ref,
) {
  return OrdersNotifier(
    onCompletionUpdate: () => ref.read(accountStateProvider.notifier).refresh(),
  );
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
