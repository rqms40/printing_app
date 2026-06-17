import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_assignment_parser.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

import '../../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  List<Map<String, dynamic>>? activeAssignmentsResponse;
  List<Map<String, dynamic>>? historyAssignmentsResponse;
  var failPatchStatus = false;
  Interceptor? riderApiInterceptor;

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
    riderApiInterceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/riders/assignments' && options.method == 'GET') {
          final data = activeAssignmentsResponse;
          if (data != null) {
            handler.resolve(
              Response(requestOptions: options, statusCode: 200, data: data),
            );
            return;
          }

          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
              error: 'offline',
            ),
          );
          return;
        }

        if (options.path == '/riders/history' && options.method == 'GET') {
          final data = historyAssignmentsResponse;
          if (data != null) {
            handler.resolve(
              Response(requestOptions: options, statusCode: 200, data: data),
            );
            return;
          }

          handler.reject(
            DioException(
              requestOptions: options,
              type: DioExceptionType.connectionError,
              error: 'offline',
            ),
          );
          return;
        }

        if (options.path.startsWith('/riders/assignments/') &&
            options.path.endsWith('/status') &&
            options.method == 'PATCH') {
          if (failPatchStatus) {
            handler.reject(
              DioException(
                requestOptions: options,
                response: Response(
                  requestOptions: options,
                  statusCode: 500,
                  data: {'message': 'status update failed'},
                ),
                type: DioExceptionType.badResponse,
              ),
            );
            return;
          }

          handler.resolve(
            Response(requestOptions: options, statusCode: 200, data: {}),
          );
          return;
        }

        handler.next(options);
      },
    );
    ApiClient.instance.dio.interceptors.add(riderApiInterceptor!);
  });

  tearDownAll(() {
    final interceptor = riderApiInterceptor;
    if (interceptor != null) {
      ApiClient.instance.dio.interceptors.remove(interceptor);
    }
  });

  setUp(() {
    activeAssignmentsResponse = null;
    historyAssignmentsResponse = null;
    failPatchStatus = false;
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
      final delivered = notifier.state.assignments.firstWhere(
        (a) => a.id == id,
      );
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

    test('loads active route order before sorted history', () async {
      activeAssignmentsResponse = [
        _assignmentJson(
          id: 'active-first',
          status: DeliveryStatus.onTheWay,
          updatedAt: '2026-02-01T09:00:00Z',
        ),
        _assignmentJson(
          id: 'active-second',
          status: DeliveryStatus.assigned,
          updatedAt: '2026-02-03T09:00:00Z',
        ),
      ];
      historyAssignmentsResponse = [
        _assignmentJson(
          id: 'history-newer',
          status: DeliveryStatus.delivered,
          updatedAt: '2026-06-01T09:00:00Z',
        ),
        _assignmentJson(
          id: 'active-first',
          status: DeliveryStatus.delivered,
          updatedAt: '2026-06-02T09:00:00Z',
        ),
        _assignmentJson(
          id: 'history-older',
          status: DeliveryStatus.delivered,
          updatedAt: '2026-01-01T09:00:00Z',
        ),
      ];

      final apiBackedNotifier = DeliveriesNotifier();
      await _waitForBootstrap();

      expect(
        apiBackedNotifier.state.views.map((view) => view.id),
        orderedEquals([
          'active-first',
          'active-second',
          'history-newer',
          'history-older',
        ]),
      );
      expect(
        apiBackedNotifier.state.viewById('active-first')?.status,
        DeliveryStatus.onTheWay,
      );
    });

    test('acceptAssignment keeps local state when PATCH fails', () async {
      failPatchStatus = true;
      final assigned = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.assigned,
      );

      await notifier.acceptAssignment(assigned.id);

      final afterAttempt = notifier.state.assignments.firstWhere(
        (a) => a.id == assigned.id,
      );
      expect(afterAttempt.status, DeliveryStatus.assigned);
      expect(afterAttempt.acceptedAt, assigned.acceptedAt);
      expect(notifier.state.errorMessage, isNotNull);
    });

    test('advanceCheckpoint keeps local state when PATCH fails', () async {
      failPatchStatus = true;
      final pickedUp = notifier.state.assignments.firstWhere(
        (a) => a.status == DeliveryStatus.pickedUp,
      );

      await notifier.advanceCheckpoint(pickedUp.id);

      final afterAttempt = notifier.state.assignments.firstWhere(
        (a) => a.id == pickedUp.id,
      );
      expect(afterAttempt.status, DeliveryStatus.pickedUp);
      expect(afterAttempt.onTheWayAt, pickedUp.onTheWayAt);
      expect(notifier.state.errorMessage, isNotNull);
    });

    test('activeDelivery returns current active delivery', () {
      final active = notifier.state.activeDelivery;
      // MockData has da_001 in onTheWay and da_005 in pickedUp — both are active
      expect(active, isNotNull);
      expect([
        DeliveryStatus.accepted,
        DeliveryStatus.pickedUp,
        DeliveryStatus.onTheWay,
        DeliveryStatus.arrived,
      ], contains(active!.status));
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
        views: [],
        filterStatus: DeliveryStatus.assigned,
      );
      final copied = state.copyWith(filterStatus: () => null);
      expect(copied.assignments, isEmpty);
      expect(copied.filterStatus, isNull);
    });

    test('filteredAssignments returns empty when no matches', () {
      const state = DeliveriesState(
        views: [],
        filterStatus: DeliveryStatus.assigned,
      );
      expect(state.filteredAssignments, isEmpty);
    });

    test('activeDelivery returns null when no active deliveries', () {
      const state = DeliveriesState(views: []);
      expect(state.activeDelivery, isNull);
    });

    test('activeDelivery remains null for assigned-only route jobs', () {
      final assignedOnly = DeliveriesState(
        views: [
          _view(id: 'assigned-1', status: DeliveryStatus.assigned),
          _view(id: 'assigned-2', status: DeliveryStatus.assigned),
        ],
      );

      expect(
        assignedOnly.newAssignments.map((view) => view.id),
        orderedEquals(['assigned-1', 'assigned-2']),
      );
      expect(assignedOnly.inProgressAssignments, isEmpty);
      expect(assignedOnly.activeDelivery, isNull);
    });
  });
}

Future<void> _waitForBootstrap() async {
  await Future<void>.delayed(const Duration(milliseconds: 50));
}

RiderAssignmentView _view({
  required String id,
  required DeliveryStatus status,
  DateTime? updatedAt,
}) {
  return RiderAssignmentView(
    assignment: _assignment(id: id, status: status, updatedAt: updatedAt),
    order: const RiderOrderContext(
      orderRef: 'ORD-TEST',
      orderInternalId: 'order-test',
      category: 'print',
      quantity: 1,
      totalPrice: 120,
      deliveryFee: 40,
    ),
  );
}

Map<String, dynamic> _assignmentJson({
  required String id,
  required DeliveryStatus status,
  required String updatedAt,
}) {
  return {
    'id': id,
    'orderId': 'order-$id',
    'riderId': 'rider-1',
    'status': serverDeliveryStatus(status),
    'createdAt': '2026-01-01T09:00:00Z',
    'updatedAt': updatedAt,
  };
}

DeliveryAssignment _assignment({
  required String id,
  required DeliveryStatus status,
  DateTime? updatedAt,
}) {
  final now = updatedAt ?? DateTime.utc(2026, 1, 1, 9);
  return DeliveryAssignment(
    id: id,
    orderId: 'order-$id',
    riderId: 'rider-1',
    status: status,
    createdAt: now,
    updatedAt: now,
  );
}
