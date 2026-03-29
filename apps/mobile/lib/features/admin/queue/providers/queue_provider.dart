import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/paper_specs.dart';
import 'package:printing_app/shared/models/three_d_specs.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Tabs for the order queue screen.
enum QueueTab { newOrders, inProduction, done, all }

/// Convert camelCase enum name to snake_case for the server.
String _toSnakeCase(String input) {
  return input.replaceAllMapped(
    RegExp(r'[A-Z]'),
    (m) => '_${m.group(0)!.toLowerCase()}',
  );
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

PaperSpecs? _parsePaperSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return PaperSpecs(
    paperSize: PaperSize.values.firstWhere(
      (e) => e.name == (json['paperSize'] as String? ?? 'a4'),
      orElse: () => PaperSize.a4,
    ),
    colorMode: ColorMode.values.firstWhere(
      (e) => e.name == (json['colorMode'] as String? ?? 'fullColor'),
      orElse: () => ColorMode.fullColor,
    ),
    mediaType: MediaType.values.firstWhere(
      (e) => e.name == (json['mediaType'] as String? ?? 'matte'),
      orElse: () => MediaType.matte,
    ),
    printSides: PrintSides.values.firstWhere(
      (e) => e.name == (json['printSides'] as String? ?? 'frontOnly'),
      orElse: () => PrintSides.frontOnly,
    ),
    binding: Binding.values.firstWhere(
      (e) => e.name == (json['binding'] as String? ?? 'none'),
      orElse: () => Binding.none,
    ),
  );
}

ThreeDSpecs? _parseThreeDSpecs(Map<String, dynamic>? json) {
  if (json == null) return null;
  return ThreeDSpecs(
    fileFormat: FileFormat3D.values.firstWhere(
      (e) => e.name == (json['fileFormat'] as String? ?? 'stl'),
      orElse: () => FileFormat3D.stl,
    ),
    material: Material3D.values.firstWhere(
      (e) => e.name == (json['material'] as String? ?? 'pla'),
      orElse: () => Material3D.pla,
    ),
    color: json['color'] as String? ?? 'white',
    infillPercentage: (json['infillPercentage'] as num?)?.toInt() ?? 20,
    layerHeight: (json['layerHeight'] as num?)?.toDouble() ?? 0.2,
    supports: json['supports'] as bool? ?? false,
    notes: json['notes'] as String?,
  );
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
    cancelledAt: json['cancelledAt'] is String
        ? DateTime.parse(json['cancelledAt'] as String)
        : null,
    deliveryOption: json['deliveryOption'] as String? ?? 'delivery',
    deliveryAddressId: json['deliveryAddressId'] as String?,
    assignedDriverId: json['assignedDriverId'] as String?,
    estimatedCompletionAt: json['estimatedCompletionAt'] is String
        ? DateTime.parse(json['estimatedCompletionAt'] as String)
        : null,
    adminNotes: json['adminNotes'] as String?,
    trackingLink: json['trackingLink'] as String?,
    createdAt: json['createdAt'] is String
        ? DateTime.parse(json['createdAt'] as String)
        : DateTime.now(),
    updatedAt: json['updatedAt'] is String
        ? DateTime.parse(json['updatedAt'] as String)
        : DateTime.now(),
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
            .where((o) =>
                o.orderStatus == OrderStatus.orderPlaced ||
                o.orderStatus == OrderStatus.fileVerified)
            .toList();
        break;
      case QueueTab.inProduction:
        result = result
            .where((o) =>
                o.orderStatus == OrderStatus.printingInProgress ||
                o.orderStatus == OrderStatus.finishingMounting ||
                o.orderStatus == OrderStatus.qualityChecked)
            .toList();
        break;
      case QueueTab.done:
        result = result
            .where((o) =>
                o.orderStatus == OrderStatus.delivered ||
                o.orderStatus == OrderStatus.completedPickup)
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
      await ApiClient.instance.patch('/admin/orders/$orderId/status', data: {
        'status': _toSnakeCase(newStatus.name),
      });
    } catch (_) {}
    // Update local state regardless
    final updated = state.orders.map((o) {
      if (o.id == orderId) {
        return o.copyWith(
          orderStatus: newStatus,
          updatedAt: DateTime.now(),
        );
      }
      return o;
    }).toList();

    state = state.copyWith(orders: updated);
  }
}

/// Provider for the queue state.
final queueProvider =
    StateNotifierProvider<QueueNotifier, QueueState>((ref) {
  return QueueNotifier();
});
