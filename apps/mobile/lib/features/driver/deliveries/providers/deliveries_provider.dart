import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

/// State for the deliveries list.
class DeliveriesState {
  const DeliveriesState({
    required this.assignments,
    this.filterStatus,
  });

  final List<DeliveryAssignment> assignments;
  final DeliveryStatus? filterStatus;

  /// Returns assignments filtered by status, excluding declined.
  List<DeliveryAssignment> get filteredAssignments {
    final active = assignments
        .where((a) => a.status != DeliveryStatus.declined)
        .toList();
    if (filterStatus == null) return active;
    return active.where((a) => a.status == filterStatus).toList();
  }

  /// Returns the current active delivery (not assigned, not delivered, not declined).
  DeliveryAssignment? get activeDelivery {
    final activeStatuses = [
      DeliveryStatus.accepted,
      DeliveryStatus.pickedUp,
      DeliveryStatus.onTheWay,
      DeliveryStatus.arrived,
    ];
    try {
      return assignments.firstWhere(
        (a) => activeStatuses.contains(a.status),
      );
    } catch (_) {
      return null;
    }
  }

  DeliveriesState copyWith({
    List<DeliveryAssignment>? assignments,
    DeliveryStatus? Function()? filterStatus,
  }) {
    return DeliveriesState(
      assignments: assignments ?? this.assignments,
      filterStatus:
          filterStatus != null ? filterStatus() : this.filterStatus,
    );
  }
}

class DeliveriesNotifier extends StateNotifier<DeliveriesState> {
  DeliveriesNotifier()
      : super(DeliveriesState(
          assignments: List.from(MockData.deliveryAssignments),
        ));

  /// Filter assignments by status. Pass null to clear filter.
  void filterByStatus(DeliveryStatus? status) {
    state = state.copyWith(filterStatus: () => status);
  }

  /// Accept an assignment. Transitions assigned -> accepted.
  void acceptAssignment(String assignmentId) {
    _updateAssignment(assignmentId, (a) {
      if (a.status != DeliveryStatus.assigned) return a;
      return a.copyWith(
        status: DeliveryStatus.accepted,
        acceptedAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    });
  }

  /// Decline an assignment. Transitions assigned -> declined.
  void declineAssignment(String assignmentId) {
    _updateAssignment(assignmentId, (a) {
      if (a.status != DeliveryStatus.assigned) return a;
      return a.copyWith(
        status: DeliveryStatus.declined,
        declineReason: 'Driver declined',
        updatedAt: DateTime.now(),
      );
    });
  }

  /// Advance the delivery to the next checkpoint status.
  /// State machine: assigned -> accepted -> pickedUp -> onTheWay -> arrived -> delivered
  void advanceCheckpoint(String assignmentId) {
    _updateAssignment(assignmentId, (a) {
      final now = DateTime.now();
      switch (a.status) {
        case DeliveryStatus.assigned:
          return a.copyWith(
            status: DeliveryStatus.accepted,
            acceptedAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.accepted:
          return a.copyWith(
            status: DeliveryStatus.pickedUp,
            pickedUpAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.pickedUp:
          return a.copyWith(
            status: DeliveryStatus.onTheWay,
            onTheWayAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.onTheWay:
          return a.copyWith(
            status: DeliveryStatus.arrived,
            arrivedAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.arrived:
          return a.copyWith(
            status: DeliveryStatus.delivered,
            deliveredAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.delivered:
        case DeliveryStatus.declined:
          return a; // Terminal states
      }
    });
  }

  /// Reset to mock data (for pull-to-refresh).
  void reset() {
    state = DeliveriesState(
      assignments: List.from(MockData.deliveryAssignments),
      filterStatus: state.filterStatus,
    );
  }

  void _updateAssignment(
    String id,
    DeliveryAssignment Function(DeliveryAssignment) updater,
  ) {
    final updated = state.assignments.map((a) {
      if (a.id == id) return updater(a);
      return a;
    }).toList();
    state = state.copyWith(assignments: updated);
  }
}

final deliveriesProvider =
    StateNotifierProvider<DeliveriesNotifier, DeliveriesState>(
  (ref) => DeliveriesNotifier(),
);
