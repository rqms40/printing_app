import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

import '../../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
  });

  group('DeliveriesNotifier', () {
    late DeliveriesNotifier notifier;

    setUp(() async {
      notifier = DeliveriesNotifier();
      // Wait for async _fetchAssignments to complete (falls back to MockData)
      await Future.delayed(const Duration(milliseconds: 200));
    });

    test('initializes with MockData assignments (API fallback)', () {
      expect(notifier.state.assignments, isNotEmpty);
      expect(
        notifier.state.assignments.length,
        MockData.deliveryAssignments.length,
      );
    });

    test('filteredAssignments excludes declined by default', () {
      final filtered = notifier.state.filteredAssignments;
      for (final a in filtered) {
        expect(a.status, isNot(DeliveryStatus.declined));
      }
    });

    test('filterByStatus filters to specific status', () {
      notifier.filterByStatus(DeliveryStatus.assigned);
      final filtered = notifier.state.filteredAssignments;
      for (final a in filtered) {
        expect(a.status, DeliveryStatus.assigned);
      }
    });

    test('filterByStatus with null shows all non-declined', () {
      notifier.filterByStatus(DeliveryStatus.assigned);
      expect(notifier.state.filterStatus, DeliveryStatus.assigned);

      notifier.filterByStatus(null);
      expect(notifier.state.filterStatus, isNull);

      final filtered = notifier.state.filteredAssignments;
      for (final a in filtered) {
        expect(a.status, isNot(DeliveryStatus.declined));
      }
    });

    test('acceptAssignment transitions assigned -> accepted', () async {
      // da_003 is in assigned status
      final assigned = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.assigned,
      );

      await notifier.acceptAssignment(assigned.id);

      final updated = notifier.state.assignments.firstWhere(
        (a) => a.id == assigned.id,
      );
      expect(updated.status, DeliveryStatus.accepted);
      expect(updated.acceptedAt, isNotNull);
    });

    test('acceptAssignment does not change non-assigned status', () async {
      // da_001 is in onTheWay status, not assigned
      final notAssigned = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.onTheWay,
      );

      await notifier.acceptAssignment(notAssigned.id);

      final afterAttempt = notifier.state.assignments.firstWhere(
        (a) => a.id == notAssigned.id,
      );
      expect(afterAttempt.status, DeliveryStatus.onTheWay); // unchanged
    });

    test('declineAssignment transitions assigned -> declined', () async {
      final assigned = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.assigned,
      );

      await notifier.declineAssignment(assigned.id);

      final updated = notifier.state.assignments.firstWhere(
        (a) => a.id == assigned.id,
      );
      expect(updated.status, DeliveryStatus.declined);
      expect(updated.declineReason, 'Rider declined');
    });

    test('declineAssignment does not change non-assigned status', () async {
      final notAssigned = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.onTheWay,
      );

      await notifier.declineAssignment(notAssigned.id);

      final afterAttempt = notifier.state.assignments.firstWhere(
        (a) => a.id == notAssigned.id,
      );
      expect(afterAttempt.status, DeliveryStatus.onTheWay); // unchanged
    });

    test('advanceCheckpoint follows full state machine', () async {
      // Start with da_003 which is assigned
      final id = notifier.state.assignments
          .firstWhere((a) => a.status == DeliveryStatus.assigned)
          .id;

      // assigned -> accepted
      await notifier.advanceCheckpoint(id);
      expect(
        notifier.state.assignments.firstWhere((a) => a.id == id).status,
        DeliveryStatus.accepted,
      );

      // accepted -> pickedUp
      await notifier.advanceCheckpoint(id);
      expect(
        notifier.state.assignments.firstWhere((a) => a.id == id).status,
        DeliveryStatus.pickedUp,
      );

      // pickedUp -> onTheWay
      await notifier.advanceCheckpoint(id);
      expect(
        notifier.state.assignments.firstWhere((a) => a.id == id).status,
        DeliveryStatus.onTheWay,
      );

      // onTheWay -> arrived
      await notifier.advanceCheckpoint(id);
      expect(
        notifier.state.assignments.firstWhere((a) => a.id == id).status,
        DeliveryStatus.arrived,
      );

      // arrived -> delivered
      await notifier.advanceCheckpoint(id);
      final delivered =
          notifier.state.assignments.firstWhere((a) => a.id == id);
      expect(delivered.status, DeliveryStatus.delivered);
      expect(delivered.deliveredAt, isNotNull);
    });

    test('advanceCheckpoint is no-op for delivered status', () async {
      // da_002 is in delivered status
      final delivered = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.delivered,
      );

      await notifier.advanceCheckpoint(delivered.id);

      final afterAttempt = notifier.state.assignments.firstWhere(
        (a) => a.id == delivered.id,
      );
      expect(afterAttempt.status, DeliveryStatus.delivered); // unchanged
    });

    test('advanceCheckpoint is no-op for declined status', () async {
      // da_004 is in declined status
      final declined = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.declined,
      );

      await notifier.advanceCheckpoint(declined.id);

      final afterAttempt = notifier.state.assignments.firstWhere(
        (a) => a.id == declined.id,
      );
      expect(afterAttempt.status, DeliveryStatus.declined); // unchanged
    });

    test('activeDelivery returns current active delivery', () {
      final active = notifier.state.activeDelivery;
      // MockData has da_001 in onTheWay and da_005 in pickedUp — both are active
      expect(active, isNotNull);
      expect(
        [
          DeliveryStatus.accepted,
          DeliveryStatus.pickedUp,
          DeliveryStatus.onTheWay,
          DeliveryStatus.arrived,
        ],
        contains(active!.status),
      );
    });

    test('reset reloads from MockData', () async {
      // Advance an assignment
      final assigned = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.assigned,
      );
      await notifier.acceptAssignment(assigned.id);

      // Reset reloads original mock data
      await notifier.reset();

      final reloaded = notifier.state.assignments.firstWhere(
        (a) => a.id == assigned.id,
      );
      expect(reloaded.status, DeliveryStatus.assigned); // back to original
    });
  });

  group('DeliveriesState', () {
    test('copyWith preserves unchanged fields', () {
      const state = DeliveriesState(
        assignments: [],
        filterStatus: DeliveryStatus.assigned,
      );
      final copied = state.copyWith(filterStatus: () => null);
      expect(copied.assignments, isEmpty);
      expect(copied.filterStatus, isNull);
    });

    test('filteredAssignments returns empty when no matches', () {
      const state = DeliveriesState(
        assignments: [],
        filterStatus: DeliveryStatus.assigned,
      );
      expect(state.filteredAssignments, isEmpty);
    });

    test('activeDelivery returns null when no active deliveries', () {
      const state = DeliveriesState(assignments: []);
      expect(state.activeDelivery, isNull);
    });
  });
}
