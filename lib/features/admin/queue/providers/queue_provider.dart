import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// Tabs for the order queue screen.
enum QueueTab { newOrders, inProduction, done, all }

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
  QueueNotifier()
      : super(QueueState(orders: List<Order>.from(MockData.orders)));

  void setTab(QueueTab tab) {
    state = state.copyWith(activeTab: tab);
  }

  void searchByOrderId(String query) {
    state = state.copyWith(searchQuery: query);
  }

  void updateOrderStatus(String orderId, OrderStatus newStatus) {
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
