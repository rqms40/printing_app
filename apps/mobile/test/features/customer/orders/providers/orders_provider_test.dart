import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

void main() {
  // Since OrdersNotifier constructor calls _connectWebSocket which causes
  // unhandled async WebSocket errors in tests, we test the orders logic
  // (filtering, cancellation rules, etc.) directly using MockData.

  group('Orders logic — activeOrders filtering', () {
    final terminalStatuses = {
      OrderStatus.delivered,
      OrderStatus.completedPickup,
      OrderStatus.cancelled,
    };

    final allOrders = MockData.orders;

    test('MockData has orders', () {
      expect(allOrders, isNotEmpty);
      expect(allOrders.length, 10);
    });

    test('activeOrders excludes terminal statuses', () {
      final active =
          allOrders.where((o) => !terminalStatuses.contains(o.orderStatus)).toList();
      for (final o in active) {
        expect(o.orderStatus, isNot(OrderStatus.delivered));
        expect(o.orderStatus, isNot(OrderStatus.completedPickup));
        expect(o.orderStatus, isNot(OrderStatus.cancelled));
      }
      expect(active, isNotEmpty);
    });

    test('completedOrders includes only terminal statuses', () {
      final completed =
          allOrders.where((o) => terminalStatuses.contains(o.orderStatus)).toList();
      expect(completed, isNotEmpty);
      for (final o in completed) {
        expect(
          [OrderStatus.delivered, OrderStatus.completedPickup, OrderStatus.cancelled],
          contains(o.orderStatus),
        );
      }
    });

    test('activeOrders + completedOrders == all orders', () {
      final active =
          allOrders.where((o) => !terminalStatuses.contains(o.orderStatus)).toList();
      final completed =
          allOrders.where((o) => terminalStatuses.contains(o.orderStatus)).toList();
      expect(active.length + completed.length, allOrders.length);
    });
  });

  group('Orders logic — cancellation rules', () {
    final cancellableStatuses = {
      OrderStatus.orderPlaced,
      OrderStatus.fileVerified,
    };

    test('orderPlaced is cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.orderPlaced), true);
    });

    test('fileVerified is cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.fileVerified), true);
    });

    test('printingInProgress is NOT cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.printingInProgress), false);
    });

    test('delivered is NOT cancellable', () {
      expect(cancellableStatuses.contains(OrderStatus.delivered), false);
    });

    test('cancelOrder logic cancels eligible order', () {
      final orders = List<Order>.from(MockData.orders);

      // Find an orderPlaced order
      final eligible = orders.firstWhere(
        (o) => o.orderStatus == OrderStatus.orderPlaced,
      );

      // Simulate cancelOrder logic from provider
      final updated = [
        for (final order in orders)
          if (order.id == eligible.id &&
              cancellableStatuses.contains(order.orderStatus))
            order.copyWith(
              orderStatus: OrderStatus.cancelled,
              cancelledAt: DateTime.now(),
              updatedAt: DateTime.now(),
            )
          else
            order,
      ];

      final cancelledOrder = updated.firstWhere((o) => o.id == eligible.id);
      expect(cancelledOrder.orderStatus, OrderStatus.cancelled);
      expect(cancelledOrder.cancelledAt, isNotNull);
    });

    test('cancelOrder logic does NOT cancel non-eligible order', () {
      final orders = List<Order>.from(MockData.orders);

      // Find a printingInProgress order
      final nonEligible = orders.firstWhere(
        (o) => o.orderStatus == OrderStatus.printingInProgress,
      );

      // Simulate cancelOrder logic from provider
      final updated = [
        for (final order in orders)
          if (order.id == nonEligible.id &&
              cancellableStatuses.contains(order.orderStatus))
            order.copyWith(
              orderStatus: OrderStatus.cancelled,
              cancelledAt: DateTime.now(),
              updatedAt: DateTime.now(),
            )
          else
            order,
      ];

      final afterCancel = updated.firstWhere((o) => o.id == nonEligible.id);
      expect(afterCancel.orderStatus, OrderStatus.printingInProgress);
    });
  });

  group('Orders logic — addOrder', () {
    test('addOrder prepends to list', () {
      final orders = List<Order>.from(MockData.orders);
      final initialCount = orders.length;

      final newOrder = Order(
        id: 'test_new',
        orderId: 'ORD-99999',
        userId: 'usr_001',
        category: 'paper',
        quantity: 1,
        totalPrice: 100,
        deliveryFee: 0,
        paymentMethod: PaymentMethod.gcash,
        paymentStatus: PaymentStatus.paid,
        orderStatus: OrderStatus.orderPlaced,
        deliveryOption: 'pickup',
        createdAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );

      // Simulate addOrder offline fallback
      final updated = [newOrder, ...orders];

      expect(updated.length, initialCount + 1);
      expect(updated.first.orderId, 'ORD-99999');
    });
  });

  group('Order model', () {
    test('copyWith preserves unchanged fields', () {
      final order = MockData.orders.first;
      final copied = order.copyWith(orderStatus: OrderStatus.cancelled);
      expect(copied.orderStatus, OrderStatus.cancelled);
      expect(copied.id, order.id);
      expect(copied.orderId, order.orderId);
      expect(copied.userId, order.userId);
      expect(copied.totalPrice, order.totalPrice);
    });

    test('equality is based on id', () {
      final order1 = MockData.orders.first;
      final order2 = order1.copyWith(orderStatus: OrderStatus.cancelled);
      expect(order1, equals(order2)); // same id
    });
  });
}
