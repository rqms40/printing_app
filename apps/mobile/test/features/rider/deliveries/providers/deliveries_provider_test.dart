import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_assignment_parser.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

import '../../../../helpers/test_setup.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('parseRiderDispatchPlan reads plan totals', () {
    final plan = parseRiderDispatchPlan({
      ..._twoStopPlan(),
      'totalDurationSeconds': 540,
      'totalDistanceMeters': 2300,
    });
    expect(plan!.totalDurationSeconds, 540);
    expect(plan.totalDistanceMeters, 2300);
    expect(parseRiderDispatchPlan(_twoStopPlan())!.totalDurationSeconds, null);
  });

  List<Map<String, dynamic>>? activeAssignmentsResponse;
  List<Map<String, dynamic>>? historyAssignmentsResponse;
  Map<String, dynamic>? dispatchPlanResponse;
  var blankDispatchPlanResponse = false;
  var failDispatchPlan = false;
  var failPatchStatus = false;
  Map<String, dynamic>? lastStatusPatchData;
  void Function(String status)? onStatusPatched;
  final deferredActiveResponses = <Completer<List<Map<String, dynamic>>>>[];
  final deferredHistoryResponses = <Completer<List<Map<String, dynamic>>>>[];
  final deferredPlanResponses = <Completer<Map<String, dynamic>?>>[];
  Interceptor? riderApiInterceptor;

  setUpAll(() {
    TestSetup.stubSecureStorage();
    TestSetup.initApiClient();
    WebSocketService.disableOrdersSocketForTests = true;
    WebSocketService.instance.disconnect();
    riderApiInterceptor = InterceptorsWrapper(
      onRequest: (options, handler) {
        if (options.path == '/riders/assignments' && options.method == 'GET') {
          if (deferredActiveResponses.isNotEmpty) {
            final response = deferredActiveResponses.removeAt(0);
            _resolveDeferred(response.future, options, handler);
            return;
          }
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
          if (deferredHistoryResponses.isNotEmpty) {
            final response = deferredHistoryResponses.removeAt(0);
            _resolveDeferred(response.future, options, handler);
            return;
          }
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

        if (options.path == '/riders/dispatch-plan' &&
            options.method == 'GET') {
          if (deferredPlanResponses.isNotEmpty) {
            final response = deferredPlanResponses.removeAt(0);
            _resolveDeferred(response.future, options, handler);
            return;
          }
          if (failDispatchPlan) {
            handler.reject(
              DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                error: 'dispatch plan offline',
              ),
            );
            return;
          }
          handler.resolve(
            Response(
              requestOptions: options,
              statusCode: 200,
              data: blankDispatchPlanResponse ? '' : dispatchPlanResponse,
            ),
          );
          return;
        }

        if (options.path.startsWith('/riders/assignments/') &&
            options.path.endsWith('/status') &&
            options.method == 'PATCH') {
          lastStatusPatchData = Map<String, dynamic>.from(options.data as Map);
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
          onStatusPatched?.call(lastStatusPatchData!['status'] as String);
          return;
        }

        handler.next(options);
      },
    );
    ApiClient.instance.dio.interceptors.add(riderApiInterceptor!);
  });

  tearDownAll(() {
    WebSocketService.disableOrdersSocketForTests = false;
    WebSocketService.instance.disconnect();
    final interceptor = riderApiInterceptor;
    if (interceptor != null) {
      ApiClient.instance.dio.interceptors.remove(interceptor);
    }
  });

  setUp(() {
    activeAssignmentsResponse = null;
    historyAssignmentsResponse = null;
    dispatchPlanResponse = null;
    blankDispatchPlanResponse = false;
    failDispatchPlan = false;
    failPatchStatus = false;
    lastStatusPatchData = null;
    onStatusPatched = null;
    deferredActiveResponses.clear();
    deferredHistoryResponses.clear();
    deferredPlanResponses.clear();
  });

  group('DeliveriesNotifier', () {
    late DeliveriesNotifier notifier;

    setUp(() async {
      notifier = DeliveriesNotifier();
      // Wait for async _fetchAssignments to complete (falls back to MockData)
      await Future.delayed(const Duration(milliseconds: 200));
    });

    tearDown(() {
      notifier.dispose();
    });

    test('initializes with MockData assignments (API fallback)', () {
      expect(notifier.state.assignments, isNotEmpty);
      expect(
        notifier.state.assignments.length,
        MockData.deliveryAssignments.length,
      );
    });

    test('real-flow mode never substitutes mock assignments', () async {
      final realNotifier = DeliveriesNotifier(bootstrap: false, realFlow: true);
      addTearDown(realNotifier.dispose);

      await realNotifier.refreshAssignments();

      expect(realNotifier.state.views, isEmpty);
      expect(
        realNotifier.state.errorMessage,
        'Unable to load live assignments',
      );
      expect(realNotifier.state.dataStale, isTrue);
    });

    test(
      'real-flow mode treats an empty no-plan response as no dispatch plan',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        blankDispatchPlanResponse = true;
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);

        await _waitForBootstrap();

        expect(realNotifier.state.views.single.id, '101');
        expect(realNotifier.state.errorMessage, isNull);
        expect(realNotifier.state.dataStale, isFalse);
      },
    );

    test(
      'real-flow refresh retains one coherent plan when a source fails',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        dispatchPlanResponse = {
          'version': 4,
          'originLatitude': '7.064',
          'originLongitude': '125.6079',
          'provider': 'osrm',
          'profile': 'driving',
          'routingDataStale': false,
          'stops': [_planStop(101, sequence: 1, status: 'pending')],
        };
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);
        await _waitForBootstrap();
        expect(realNotifier.state.views.single.id, '101');

        activeAssignmentsResponse = [
          _assignmentJson(
            id: '102',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T10:00:00Z',
          ),
        ];
        failDispatchPlan = true;
        await realNotifier.refreshAssignments();

        expect(realNotifier.state.views.single.id, '101');
        expect(realNotifier.state.views.single.planVersion, 4);
        expect(realNotifier.state.dataStale, isTrue);
        expect(
          realNotifier.state.errorMessage,
          'Unable to load live assignments',
        );
      },
    );

    test(
      'dispatch-plan signal refreshes the rider into persisted stop order',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
          _assignmentJson(
            id: '102',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:01:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        blankDispatchPlanResponse = true;
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);
        await _waitForBootstrap();
        expect(realNotifier.state.plannedRoute, isEmpty);

        blankDispatchPlanResponse = false;
        dispatchPlanResponse = _twoStopPlan();
        WebSocketService.instance.dispatchRiderDispatchPlanUpdatedForTests({
          'riderProfileId': 10,
          'planId': 501,
          'planVersion': 4,
          'change': 'created',
        });
        await _waitForBootstrap();

        expect(
          realNotifier.state.plannedRoute.map((view) => view.id),
          orderedEquals(['101', '102']),
        );
        expect(
          realNotifier.state.routeStops.map((view) => view.routePosition),
          orderedEquals([1, 2]),
        );
        expect(realNotifier.state.dataStale, isFalse);
      },
    );

    test(
      'real-flow missing order relation preserves the last coherent snapshot',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        dispatchPlanResponse = _singleStopPlan();
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);
        await _waitForBootstrap();
        expect(realNotifier.state.views.single.order.totalPrice, 120);

        final assignmentWithoutOrder = _assignmentJson(
          id: '101',
          status: DeliveryStatus.onTheWay,
          updatedAt: '2026-02-01T09:00:00Z',
        );
        assignmentWithoutOrder.remove('order');
        activeAssignmentsResponse = [assignmentWithoutOrder];
        await realNotifier.refreshAssignments();

        expect(realNotifier.state.views.single.id, '101');
        expect(realNotifier.state.views.single.order.totalPrice, 120);
        expect(realNotifier.state.views.single.planVersion, 4);
        expect(realNotifier.state.dataStale, isTrue);
        expect(
          realNotifier.state.errorMessage,
          'Unable to load live assignments',
        );
      },
    );

    test(
      'older refresh success cannot overwrite a newer route snapshot',
      () async {
        final oldActive = Completer<List<Map<String, dynamic>>>();
        final newActive = Completer<List<Map<String, dynamic>>>();
        final newHistory = Completer<List<Map<String, dynamic>>>();
        final oldHistory = Completer<List<Map<String, dynamic>>>();
        final newPlan = Completer<Map<String, dynamic>?>();
        final oldPlan = Completer<Map<String, dynamic>?>();
        deferredActiveResponses.addAll([oldActive, newActive]);
        deferredHistoryResponses.addAll([newHistory, oldHistory]);
        deferredPlanResponses.addAll([newPlan, oldPlan]);
        final realNotifier = DeliveriesNotifier(
          bootstrap: false,
          realFlow: true,
        );
        addTearDown(realNotifier.dispose);

        final olderRefresh = realNotifier.refreshAssignments();
        await Future<void>.delayed(Duration.zero);
        final newerRefresh = realNotifier.refreshAssignments();
        await Future<void>.delayed(Duration.zero);

        newActive.complete([
          _assignmentJson(
            id: '102',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T10:00:00Z',
          ),
        ]);
        await Future<void>.delayed(Duration.zero);
        newHistory.complete([
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.delivered,
            updatedAt: '2026-02-01T10:00:00Z',
          ),
        ]);
        newPlan.complete(_twoStopPlan(firstStatus: 'completed'));
        await newerRefresh;
        expect(realNotifier.state.viewById('102')?.routePosition, 1);

        oldActive.complete([
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ]);
        await Future<void>.delayed(Duration.zero);
        oldHistory.complete([]);
        oldPlan.complete(_singleStopPlan());
        await olderRefresh;

        expect(
          realNotifier.state.plannedRoute.map((view) => view.id),
          orderedEquals(['101', '102']),
        );
        expect(
          realNotifier.state.viewById('101')?.planStop?.status,
          RiderDispatchStopStatus.completed,
        );
        expect(realNotifier.state.viewById('102')?.routePosition, 1);
        expect(realNotifier.state.errorMessage, isNull);
        expect(realNotifier.state.dataStale, isFalse);
      },
    );

    test('older refresh failure cannot stale a newer route snapshot', () async {
      final oldActive = Completer<List<Map<String, dynamic>>>();
      final newActive = Completer<List<Map<String, dynamic>>>();
      final newHistory = Completer<List<Map<String, dynamic>>>();
      final newPlan = Completer<Map<String, dynamic>?>();
      deferredActiveResponses.addAll([oldActive, newActive]);
      deferredHistoryResponses.add(newHistory);
      deferredPlanResponses.add(newPlan);
      final realNotifier = DeliveriesNotifier(bootstrap: false, realFlow: true);
      addTearDown(realNotifier.dispose);

      final olderRefresh = realNotifier.refreshAssignments();
      await Future<void>.delayed(Duration.zero);
      final newerRefresh = realNotifier.refreshAssignments();
      await Future<void>.delayed(Duration.zero);

      newActive.complete([
        _assignmentJson(
          id: '102',
          status: DeliveryStatus.onTheWay,
          updatedAt: '2026-02-01T10:00:00Z',
        ),
      ]);
      await Future<void>.delayed(Duration.zero);
      newHistory.complete([
        _assignmentJson(
          id: '101',
          status: DeliveryStatus.delivered,
          updatedAt: '2026-02-01T10:00:00Z',
        ),
      ]);
      newPlan.complete(_twoStopPlan(firstStatus: 'completed'));
      await newerRefresh;

      oldActive.completeError(
        DioException(
          requestOptions: RequestOptions(path: '/riders/assignments'),
          type: DioExceptionType.connectionError,
          error: 'older request failed',
        ),
      );
      await olderRefresh;

      expect(realNotifier.state.viewById('102')?.routePosition, 1);
      expect(realNotifier.state.errorMessage, isNull);
      expect(realNotifier.state.dataStale, isFalse);
    });

    test(
      'real-flow malformed non-null plan retains the last valid plan',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        dispatchPlanResponse = {
          'version': 4,
          'originLatitude': '7.064',
          'originLongitude': '125.6079',
          'provider': 'osrm',
          'profile': 'driving',
          'routingDataStale': false,
          'stops': [_planStop(101, sequence: 1, status: 'pending')],
        };
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);
        await _waitForBootstrap();
        expect(realNotifier.state.views.single.planVersion, 4);

        dispatchPlanResponse = {'version': 'broken', 'stops': 'not-a-list'};
        await realNotifier.refreshAssignments();

        expect(realNotifier.state.views.single.id, '101');
        expect(realNotifier.state.views.single.planVersion, 4);
        expect(realNotifier.state.dataStale, isTrue);
        expect(
          realNotifier.state.errorMessage,
          'Unable to load live assignments',
        );
      },
    );

    test(
      'real-flow rejects a plan stop without a real assignment relation',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.onTheWay,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        dispatchPlanResponse = {
          'version': 4,
          'originLatitude': '7.064',
          'originLongitude': '125.6079',
          'provider': 'osrm',
          'profile': 'driving',
          'routingDataStale': false,
          'stops': [
            _planStop(101, sequence: 1, status: 'pending'),
            _planStop(999, sequence: 2, status: 'pending'),
          ],
        };

        final realNotifier = DeliveriesNotifier(
          bootstrap: false,
          realFlow: true,
        );
        addTearDown(realNotifier.dispose);
        await realNotifier.refreshAssignments();

        expect(realNotifier.state.views, isEmpty);
        expect(realNotifier.state.dataStale, isTrue);
        expect(
          realNotifier.state.errorMessage,
          'Unable to load live assignments',
        );
      },
    );

    test(
      'delivering Ven reloads persisted snapshots and promotes Mark',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.arrived,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
          _assignmentJson(
            id: '102',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:01:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        dispatchPlanResponse = _twoStopPlan();
        onStatusPatched = (status) {
          if (status != 'delivered') return;
          activeAssignmentsResponse = [
            _assignmentJson(
              id: '102',
              status: DeliveryStatus.onTheWay,
              updatedAt: '2026-02-01T10:00:00Z',
            ),
          ];
          historyAssignmentsResponse = [
            _assignmentJson(
              id: '101',
              status: DeliveryStatus.delivered,
              updatedAt: '2026-02-01T10:00:00Z',
            ),
          ];
          dispatchPlanResponse = _twoStopPlan(firstStatus: 'completed');
        };
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);
        await _waitForBootstrap();

        await realNotifier.completeDeliveryWithProof('101', {
          'type': 'signature',
          'signatureData': 'svg:path-data',
          'otp': '123456',
        });

        expect(
          realNotifier.state.plannedRoute.map((view) => view.id),
          orderedEquals(['101', '102']),
        );
        expect(
          realNotifier.state.viewById('101')?.planStop?.status,
          RiderDispatchStopStatus.completed,
        );
        expect(realNotifier.state.viewById('102')?.routePosition, 1);
        expect(
          realNotifier.state.viewById('102')?.status,
          DeliveryStatus.onTheWay,
        );
        expect(realNotifier.state.dataStale, isFalse);
        expect(realNotifier.state.errorMessage, isNull);
      },
    );

    test('declining the current stop reloads the persisted route', () async {
      activeAssignmentsResponse = [
        _assignmentJson(
          id: '101',
          status: DeliveryStatus.assigned,
          updatedAt: '2026-02-01T09:00:00Z',
        ),
        _assignmentJson(
          id: '102',
          status: DeliveryStatus.assigned,
          updatedAt: '2026-02-01T09:01:00Z',
        ),
      ];
      historyAssignmentsResponse = [];
      dispatchPlanResponse = _twoStopPlan();
      onStatusPatched = (status) {
        if (status != 'declined') return;
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '102',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T10:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.declined,
            updatedAt: '2026-02-01T10:00:00Z',
          ),
        ];
        dispatchPlanResponse = _twoStopPlan(firstStatus: 'skipped');
      };
      final realNotifier = DeliveriesNotifier(realFlow: true);
      addTearDown(realNotifier.dispose);
      await _waitForBootstrap();

      await realNotifier.declineAssignment('101');

      expect(
        realNotifier.state.viewById('101')?.planStop?.status,
        RiderDispatchStopStatus.skipped,
      );
      expect(realNotifier.state.viewById('102')?.routePosition, 1);
      expect(realNotifier.state.dataStale, isFalse);
      expect(realNotifier.state.errorMessage, isNull);
    });

    test(
      'route mutation reload failure preserves the last coherent plan as stale',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: '101',
            status: DeliveryStatus.arrived,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
          _assignmentJson(
            id: '102',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:01:00Z',
          ),
        ];
        historyAssignmentsResponse = [];
        dispatchPlanResponse = _twoStopPlan();
        onStatusPatched = (status) {
          if (status == 'delivered') failDispatchPlan = true;
        };
        final realNotifier = DeliveriesNotifier(realFlow: true);
        addTearDown(realNotifier.dispose);
        await _waitForBootstrap();

        await realNotifier.completeDeliveryWithProof('101', {
          'type': 'signature',
          'signatureData': 'svg:path-data',
          'otp': '123456',
        });

        expect(
          realNotifier.state.viewById('101')?.status,
          DeliveryStatus.arrived,
        );
        expect(
          realNotifier.state.viewById('101')?.planStop?.status,
          RiderDispatchStopStatus.pending,
        );
        expect(realNotifier.state.viewById('102')?.routePosition, 2);
        expect(realNotifier.state.dataStale, isTrue);
        expect(
          realNotifier.state.errorMessage,
          'Unable to load live assignments',
        );
      },
    );

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

      // accepted -> pickedUp requires OTP + uploaded photo proof.
      await notifier.advanceCheckpoint(id);
      expect(
        notifier.state.assignments.firstWhere((a) => a.id == id).status,
        DeliveryStatus.accepted,
      );
      expect(
        notifier.state.errorMessage,
        'Pickup OTP and photo proof are required before pickup',
      );
      await notifier.completePickupWithProof(id, {
        'type': 'photo',
        'fileId': 42,
        'otp': '123456',
      });
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

      // arrived -> delivered requires proof, so the generic checkpoint advance
      // must stop at arrived.
      await notifier.advanceCheckpoint(id);
      final arrived = notifier.state.assignments.firstWhere((a) => a.id == id);
      expect(arrived.status, DeliveryStatus.arrived);
      expect(arrived.deliveredAt, isNull);
      expect(
        notifier.state.errorMessage,
        'Proof of delivery is required before completing this stop',
      );
    });

    test('completeDeliveryWithProof sends signature proof metadata', () async {
      final id = notifier.state.assignments
          .firstWhere((a) => a.status == DeliveryStatus.assigned)
          .id;
      await notifier.advanceCheckpoint(id);
      await notifier.completePickupWithProof(id, {
        'type': 'photo',
        'fileId': 42,
        'otp': '123456',
      });
      await notifier.advanceCheckpoint(id);
      await notifier.advanceCheckpoint(id);

      await (notifier as dynamic).completeDeliveryWithProof(id, {
        'type': 'signature',
        'signatureData': 'svg:path-data',
        'otp': '654321',
      });

      final delivered = notifier.state.assignments.firstWhere(
        (a) => a.id == id,
      );
      expect(delivered.status, DeliveryStatus.delivered);
      expect(delivered.deliveredAt, isNotNull);
      expect(lastStatusPatchData, {
        'status': 'delivered',
        'proof': {'type': 'signature', 'signatureData': 'svg:path-data'},
        'otp': '654321',
      });
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
      addTearDown(apiBackedNotifier.dispose);
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

    test('uses persisted plan order and keeps its completed legs', () async {
      activeAssignmentsResponse = [
        _assignmentJson(
          id: '102',
          status: DeliveryStatus.onTheWay,
          updatedAt: '2026-02-03T09:00:00Z',
        ),
      ];
      historyAssignmentsResponse = [
        _assignmentJson(
          id: '101',
          status: DeliveryStatus.delivered,
          updatedAt: '2026-02-02T09:00:00Z',
        ),
      ];
      dispatchPlanResponse = {
        'version': 4,
        'originLatitude': '7.0640000',
        'originLongitude': '125.6079000',
        'provider': 'osrm',
        'profile': 'driving',
        'routingDataStale': false,
        'stops': [
          _planStop(101, sequence: 1, status: 'completed'),
          _planStop(102, sequence: 2, status: 'pending'),
        ],
      };

      final apiBackedNotifier = DeliveriesNotifier();
      addTearDown(apiBackedNotifier.dispose);
      await _waitForBootstrap();

      expect(
        apiBackedNotifier.state.plannedRoute.map((view) => view.id),
        orderedEquals(['101', '102']),
      );
      expect(apiBackedNotifier.state.plannedRoute.first.planSequence, 1);
      expect(apiBackedNotifier.state.plannedRoute.first.routePosition, isNull);
      expect(apiBackedNotifier.state.plannedRoute.last.planSequence, 2);
      expect(apiBackedNotifier.state.plannedRoute.last.routePosition, 1);
      expect(apiBackedNotifier.state.plannedRoute.last.planVersion, 4);
    });

    test(
      'refreshes assignments when realtime rider assignment event arrives',
      () async {
        activeAssignmentsResponse = [
          _assignmentJson(
            id: 'assignment-1',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
        ];
        historyAssignmentsResponse = [];

        final apiBackedNotifier = DeliveriesNotifier();
        addTearDown(apiBackedNotifier.dispose);
        await _waitForBootstrap();
        expect(
          apiBackedNotifier.state.views.map((view) => view.id),
          orderedEquals(['assignment-1']),
        );

        activeAssignmentsResponse = [
          _assignmentJson(
            id: 'assignment-1',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T09:00:00Z',
          ),
          _assignmentJson(
            id: 'assignment-2',
            status: DeliveryStatus.assigned,
            updatedAt: '2026-02-01T10:00:00Z',
          ),
        ];

        WebSocketService.instance.dispatchRiderAssignmentForTests({
          'assignmentId': 2,
          'orderId': 42,
          'orderRef': 'ORD-10042',
        });
        await _waitForBootstrap();

        expect(
          apiBackedNotifier.state.views.map((view) => view.id),
          orderedEquals(['assignment-1', 'assignment-2']),
        );
      },
    );

    test('disposes realtime rider assignment listener', () async {
      activeAssignmentsResponse = [
        _assignmentJson(
          id: 'assignment-1',
          status: DeliveryStatus.assigned,
          updatedAt: '2026-02-01T09:00:00Z',
        ),
      ];
      historyAssignmentsResponse = [];

      final baselineListenerCount =
          WebSocketService.instance.riderAssignmentListenerCountForTests;
      final baselinePlanListenerCount =
          WebSocketService.instance.riderDispatchPlanListenerCountForTests;
      final apiBackedNotifier = DeliveriesNotifier();
      await _waitForBootstrap();

      expect(
        WebSocketService.instance.riderAssignmentListenerCountForTests,
        baselineListenerCount + 1,
      );
      expect(
        WebSocketService.instance.riderDispatchPlanListenerCountForTests,
        baselinePlanListenerCount + 1,
      );

      apiBackedNotifier.dispose();

      expect(
        WebSocketService.instance.riderAssignmentListenerCountForTests,
        baselineListenerCount,
      );
      expect(
        WebSocketService.instance.riderDispatchPlanListenerCountForTests,
        baselinePlanListenerCount,
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

  test('provider releases rider data after its last listener leaves', () async {
    final container = ProviderContainer(
      overrides: [
        deliveriesProvider.overrideWith(
          (_) => DeliveriesNotifier(bootstrap: false),
        ),
      ],
    );
    addTearDown(container.dispose);
    final subscription = container.listen(
      deliveriesProvider,
      (_, __) {},
      fireImmediately: true,
    );
    final firstNotifier = container.read(deliveriesProvider.notifier);

    subscription.close();
    await container.pump();

    expect(container.read(deliveriesProvider.notifier), isNot(firstNotifier));
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

void _resolveDeferred<T>(
  Future<T> future,
  RequestOptions options,
  RequestInterceptorHandler handler,
) {
  future.then(
    (data) => handler.resolve(
      Response<T>(requestOptions: options, statusCode: 200, data: data),
    ),
    onError: (Object error, StackTrace stackTrace) {
      handler.reject(
        error is DioException
            ? error
            : DioException(
                requestOptions: options,
                type: DioExceptionType.connectionError,
                error: error,
                stackTrace: stackTrace,
              ),
      );
    },
  );
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
    'order': {
      'id': 'order-$id',
      'orderId': 'ORD-$id',
      'category': 'paper',
      'quantity': 1,
      'totalPrice': 120,
      'deliveryFee': 40,
      'destination': {
        'fullAddress': '$id destination',
        'city': 'Davao City',
        'latitude': '7.0731',
        'longitude': '125.6128',
      },
    },
  };
}

Map<String, dynamic> _planStop(
  int assignmentId, {
  required int sequence,
  required String status,
}) => {
  'assignmentId': assignmentId,
  'sequence': sequence,
  'status': status,
  'destinationLatitude': '7.0731000',
  'destinationLongitude': '125.6128000',
  'legDurationSeconds': 12,
  'legDistanceMeters': 77,
  'legGeometry': {
    'type': 'LineString',
    'coordinates': [
      [125.6079, 7.064],
      [125.6128, 7.0731],
    ],
  },
};

Map<String, dynamic> _twoStopPlan({String firstStatus = 'pending'}) => {
  'version': 4,
  'originLatitude': '7.064',
  'originLongitude': '125.6079',
  'provider': 'osrm',
  'profile': 'driving',
  'routingDataStale': false,
  'stops': [
    _planStop(101, sequence: 1, status: firstStatus),
    _planStop(102, sequence: 2, status: 'pending'),
  ],
};

Map<String, dynamic> _singleStopPlan() => {
  'version': 4,
  'originLatitude': '7.064',
  'originLongitude': '125.6079',
  'provider': 'osrm',
  'profile': 'driving',
  'routingDataStale': false,
  'stops': [_planStop(101, sequence: 1, status: 'pending')],
};

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
