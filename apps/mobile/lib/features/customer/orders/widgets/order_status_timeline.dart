import 'package:flutter/material.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/models/order_status_history.dart';
import 'package:printing_app/shared/widgets/status_timeline.dart';
import 'package:printing_app/utils/formatters.dart';

/// Wrapper around [StatusTimeline] that maps an [Order]'s marketplace status
/// pipeline into timeline steps — including supplier matching statuses.
class OrderStatusTimeline extends StatelessWidget {
  const OrderStatusTimeline({
    super.key,
    required this.order,
    required this.statusHistory,
  });

  final Order order;
  final List<OrderStatusHistory> statusHistory;

  bool get _isPickup {
    final option = order.deliveryOption.trim().toLowerCase();
    return option == 'pickup' || option == 'self_pickup' || option == 'collect';
  }

  Set<OrderStatus> _relevantStatuses() {
    final set = <OrderStatus>{order.orderStatus};
    for (final entry in statusHistory) {
      set.add(entry.toStatus);
      set.add(entry.fromStatus);
    }
    return set;
  }

  /// Ordered marketplace pipeline for this order.
  List<OrderStatus> _pipeline() {
    final relevant = _relevantStatuses();
    return customerOrderStatusPipeline(
      isPickup: _isPickup,
      includeOptional: relevant,
    );
  }

  /// Finds the timestamp for when a status was reached.
  String? _timestampFor(OrderStatus status) {
    if (status == OrderStatus.submitted) {
      return formatDateTime(order.createdAt);
    }

    for (final entry in statusHistory) {
      if (entry.toStatus == status) {
        return formatDateTime(entry.createdAt);
      }
    }
    return null;
  }

  /// Resolve which pipeline step is "current".
  ///
  /// Exact match first; otherwise map by [OrderStatus.timelineRank] so
  /// intermediate statuses still light the correct step.
  int _currentIndex(List<OrderStatus> pipeline) {
    final exact = pipeline.indexOf(order.orderStatus);
    if (exact >= 0) return exact;

    final rank = order.orderStatus.timelineRank;
    if (rank == null) return 0;

    var best = 0;
    for (var i = 0; i < pipeline.length; i++) {
      final stepRank = pipeline[i].timelineRank;
      if (stepRank != null && stepRank <= rank) {
        best = i;
      }
    }
    return best;
  }

  @override
  Widget build(BuildContext context) {
    // Terminal / branch statuses outside the happy path.
    if (order.orderStatus == OrderStatus.cancelled ||
        order.orderStatus == OrderStatus.fileRejected ||
        order.orderStatus == OrderStatus.deliveryFailed) {
      final terminal = order.orderStatus;
      final steps = <TimelineStep>[
        TimelineStep(
          label: OrderStatus.submitted.displayName,
          timestamp: formatDateTime(order.createdAt),
        ),
        TimelineStep(
          label: terminal.displayName,
          timestamp: order.cancelledAt != null &&
                  terminal == OrderStatus.cancelled
              ? formatDateTime(order.cancelledAt!)
              : _timestampFor(terminal),
        ),
      ];

      return StatusTimeline(
        steps: steps,
        currentIndex: steps.length - 1,
      );
    }

    if (order.orderStatus == OrderStatus.draft) {
      return StatusTimeline(
        steps: [
          TimelineStep(
            label: OrderStatus.draft.displayName,
            timestamp: formatDateTime(order.createdAt),
          ),
          TimelineStep(label: OrderStatus.submitted.displayName),
        ],
        currentIndex: 0,
      );
    }

    final pipeline = _pipeline();
    final currentIndex = _currentIndex(pipeline);

    // Keep progress labels short — shop name lives in the supplier dropdown card.
    final steps = pipeline.map((status) {
      return TimelineStep(
        label: status.displayName,
        timestamp: _timestampFor(status),
      );
    }).toList();

    return StatusTimeline(
      steps: steps,
      currentIndex: currentIndex.clamp(0, steps.isEmpty ? 0 : steps.length - 1),
    );
  }
}
