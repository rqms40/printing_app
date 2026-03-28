import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

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

class OrdersNotifier extends StateNotifier<List<Order>> {
  OrdersNotifier() : super(List.of(MockData.orders));

  /// Orders that are still in progress (non-terminal statuses).
  List<Order> get activeOrders =>
      state.where((o) => !_terminalStatuses.contains(o.orderStatus)).toList();

  /// Orders that have reached a terminal status.
  List<Order> get completedOrders =>
      state.where((o) => _terminalStatuses.contains(o.orderStatus)).toList();

  /// Add a new order to the top of the list.
  void addOrder(Order order) {
    state = [order, ...state];
  }

  /// Cancel an order if it is in a cancellable status.
  void cancelOrder(String orderId) {
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
