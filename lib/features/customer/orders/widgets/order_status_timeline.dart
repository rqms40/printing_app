import 'package:flutter/material.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/order_status_history.dart';
import 'package:printing_app/shared/widgets/status_timeline.dart';
import 'package:printing_app/utils/formatters.dart';

/// Wrapper around [StatusTimeline] that maps an [Order]'s status pipeline
/// into timeline steps.
class OrderStatusTimeline extends StatelessWidget {
  const OrderStatusTimeline({
    super.key,
    required this.order,
    required this.statusHistory,
  });

  final Order order;
  final List<OrderStatusHistory> statusHistory;

  /// Returns the ordered list of statuses in the pipeline for this order.
  List<OrderStatus> _pipeline() {
    final isPickup = order.deliveryOption == 'pickup';

    // Common production steps
    final steps = <OrderStatus>[
      OrderStatus.orderPlaced,
      OrderStatus.fileVerified,
      OrderStatus.printingInProgress,
      OrderStatus.finishingMounting,
      OrderStatus.qualityChecked,
    ];

    if (isPickup) {
      steps.add(OrderStatus.completedPickup);
    } else {
      steps.addAll([
        OrderStatus.readyForDispatch,
        OrderStatus.driverAssigned,
        OrderStatus.pickedUp,
        OrderStatus.onTheWay,
        OrderStatus.arrivedAtDestination,
        OrderStatus.delivered,
      ]);
    }

    return steps;
  }

  /// Finds the timestamp for when a status was reached by looking through
  /// the order status history entries.
  String? _timestampFor(OrderStatus status) {
    // The first status (orderPlaced) uses the order's createdAt.
    if (status == OrderStatus.orderPlaced) {
      return formatDateTime(order.createdAt);
    }

    for (final entry in statusHistory) {
      if (entry.toStatus == status) {
        return formatDateTime(entry.createdAt);
      }
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    // Handle special terminal statuses that break the normal pipeline.
    if (order.orderStatus == OrderStatus.cancelled ||
        order.orderStatus == OrderStatus.fileDeclined) {
      final steps = <TimelineStep>[
        TimelineStep(
          label: OrderStatus.orderPlaced.displayName,
          timestamp: formatDateTime(order.createdAt),
        ),
        if (order.orderStatus == OrderStatus.fileDeclined)
          TimelineStep(
            label: OrderStatus.fileDeclined.displayName,
            timestamp: _timestampFor(OrderStatus.fileDeclined),
          )
        else
          TimelineStep(
            label: OrderStatus.cancelled.displayName,
            timestamp: order.cancelledAt != null
                ? formatDateTime(order.cancelledAt!)
                : _timestampFor(OrderStatus.cancelled),
          ),
      ];

      return StatusTimeline(
        steps: steps,
        currentIndex: steps.length - 1,
      );
    }

    final pipeline = _pipeline();
    final currentIndex = pipeline.indexOf(order.orderStatus);
    final effectiveIndex = currentIndex >= 0 ? currentIndex : 0;

    final steps = pipeline.map((status) {
      return TimelineStep(
        label: status.displayName,
        timestamp: _timestampFor(status),
      );
    }).toList();

    return StatusTimeline(
      steps: steps,
      currentIndex: effectiveIndex,
    );
  }
}
