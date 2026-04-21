import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

DeliveryStatus _parseDeliveryStatus(String value) {
  final camelCase = value.replaceAllMapped(
    RegExp(r'_([a-z])'),
    (m) => m.group(1)!.toUpperCase(),
  );
  return DeliveryStatus.values.firstWhere(
    (e) => e.name == camelCase,
    orElse: () => DeliveryStatus.assigned,
  );
}

String _serverDeliveryStatus(DeliveryStatus status) {
  return switch (status) {
    DeliveryStatus.assigned => 'assigned',
    DeliveryStatus.accepted => 'accepted',
    DeliveryStatus.declined => 'declined',
    DeliveryStatus.pickedUp => 'picked_up',
    DeliveryStatus.onTheWay => 'on_the_way',
    DeliveryStatus.arrived => 'arrived',
    DeliveryStatus.delivered => 'delivered',
  };
}

DateTime? _parseDateNullable(dynamic value) {
  if (value is String) return DateTime.parse(value);
  return null;
}

DateTime _parseDate(dynamic value) {
  if (value is String) return DateTime.parse(value);
  return DateTime.now();
}

DeliveryAssignment _parseAssignment(Map<String, dynamic> json) {
  return DeliveryAssignment(
    id: json['id'] as String? ?? json['_id'] as String? ?? '',
    orderId: json['orderId'] as String? ?? '',
    driverId: json['driverId'] as String? ?? '',
    status: _parseDeliveryStatus(json['status'] as String? ?? 'assigned'),
    assignedAt: _parseDateNullable(json['assignedAt']),
    acceptedAt: _parseDateNullable(json['acceptedAt']),
    pickedUpAt: _parseDateNullable(json['pickedUpAt']),
    onTheWayAt: _parseDateNullable(json['onTheWayAt']),
    arrivedAt: _parseDateNullable(json['arrivedAt']),
    deliveredAt: _parseDateNullable(json['deliveredAt']),
    declineReason: json['declineReason'] as String?,
    proofPhotoUrl: json['proofPhotoUrl'] as String?,
    createdAt: _parseDate(json['createdAt']),
    updatedAt: _parseDate(json['updatedAt']),
  );
}

/// State for the deliveries list.
class DeliveriesState {
  const DeliveriesState({required this.assignments, this.filterStatus});

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
      return assignments.firstWhere((a) => activeStatuses.contains(a.status));
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
      filterStatus: filterStatus != null ? filterStatus() : this.filterStatus,
    );
  }
}

class DeliveriesNotifier extends StateNotifier<DeliveriesState> {
  DeliveriesNotifier() : super(const DeliveriesState(assignments: [])) {
    _fetchAssignments();
  }

  Future<void> _fetchAssignments() async {
    try {
      final response = await ApiClient.instance.get('/drivers/assignments');
      final data = response.data as List<dynamic>;
      final assignments = data
          .map((json) => _parseAssignment(json as Map<String, dynamic>))
          .toList();
      state = state.copyWith(assignments: assignments);
    } catch (_) {
      // Offline fallback
      state = state.copyWith(
        assignments: List.from(MockData.deliveryAssignments),
      );
    }
  }

  Future<void> refreshAssignments() async => _fetchAssignments();

  /// Filter assignments by status. Pass null to clear filter.
  void filterByStatus(DeliveryStatus? status) {
    state = state.copyWith(filterStatus: () => status);
  }

  /// Accept an assignment. Transitions assigned -> accepted.
  Future<void> acceptAssignment(String assignmentId) async {
    try {
      await ApiClient.instance.patch(
        '/drivers/assignments/$assignmentId/status',
        data: {'status': _serverDeliveryStatus(DeliveryStatus.accepted)},
      );
    } catch (_) {}
    // Update local state regardless
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
  Future<void> declineAssignment(String assignmentId) async {
    try {
      await ApiClient.instance.patch(
        '/drivers/assignments/$assignmentId/status',
        data: {
          'status': _serverDeliveryStatus(DeliveryStatus.declined),
          'declineReason': 'Driver declined',
        },
      );
    } catch (_) {}
    // Update local state regardless
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
  Future<void> advanceCheckpoint(String assignmentId) async {
    DeliveryAssignment? current;
    for (final assignment in state.assignments) {
      if (assignment.id == assignmentId) {
        current = assignment;
        break;
      }
    }
    if (current == null) return;

    final nextStatus = switch (current.status) {
      DeliveryStatus.assigned => DeliveryStatus.accepted,
      DeliveryStatus.accepted => DeliveryStatus.pickedUp,
      DeliveryStatus.pickedUp => DeliveryStatus.onTheWay,
      DeliveryStatus.onTheWay => DeliveryStatus.arrived,
      DeliveryStatus.arrived => DeliveryStatus.delivered,
      DeliveryStatus.delivered || DeliveryStatus.declined => null,
    };

    try {
      if (nextStatus != null) {
        await ApiClient.instance.patch(
          '/drivers/assignments/$assignmentId/status',
          data: {'status': _serverDeliveryStatus(nextStatus)},
        );
      }
    } catch (_) {}
    // Update local state regardless
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

  /// Refresh from API (for pull-to-refresh).
  Future<void> reset() async {
    await _fetchAssignments();
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
