import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/features/rider/shared/models/rider_order_context.dart';
import 'package:printing_app/features/rider/shared/rider_assignment_parser.dart';
import 'package:printing_app/shared/models/delivery_assignment.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

/// State for the deliveries list.
class DeliveriesState {
  const DeliveriesState({
    required this.views,
    this.isLoading = false,
    this.isRefreshing = false,
    this.errorMessage,
    this.filterStatus,
    this.dataStale = false,
  });

  final List<RiderAssignmentView> views;
  final bool isLoading;
  final bool isRefreshing;
  final String? errorMessage;
  final DeliveryStatus? filterStatus;
  final bool dataStale;

  List<DeliveryAssignment> get assignments =>
      views.map((v) => v.assignment).toList();

  List<RiderAssignmentView> get newAssignments =>
      views.where((v) => v.status == DeliveryStatus.assigned).toList();

  List<RiderAssignmentView> get inProgressAssignments =>
      views.where((v) => v.isInProgress).toList();

  List<RiderAssignmentView> get plannedRoute =>
      views.where((view) => view.planStop != null).toList()..sort(
        (left, right) => left.planSequence!.compareTo(right.planSequence!),
      );

  List<RiderAssignmentView> get routeStops {
    if (plannedRoute.isNotEmpty) {
      return plannedRoute
          .where(
            (view) => view.planStop?.status == RiderDispatchStopStatus.pending,
          )
          .take(5)
          .toList();
    }
    return [...inProgressAssignments, ...newAssignments].take(5).toList();
  }

  List<RiderAssignmentView> get completedAssignments => views
      .where(
        (v) =>
            v.status == DeliveryStatus.delivered ||
            v.status == DeliveryStatus.declined,
      )
      .toList();

  List<RiderAssignmentView> get filteredAssignments {
    final active = views.where((v) => v.status != DeliveryStatus.declined);
    if (filterStatus == null) return active.toList();
    return active.where((v) => v.status == filterStatus).toList();
  }

  RiderAssignmentView? get activeDelivery {
    try {
      return inProgressAssignments.first;
    } catch (_) {
      return null;
    }
  }

  RiderAssignmentView? viewById(String id) {
    try {
      return views.firstWhere((v) => v.id == id);
    } catch (_) {
      return null;
    }
  }

  DeliveriesState copyWith({
    List<RiderAssignmentView>? views,
    bool? isLoading,
    bool? isRefreshing,
    String? Function()? errorMessage,
    DeliveryStatus? Function()? filterStatus,
    bool? dataStale,
  }) {
    return DeliveriesState(
      views: views ?? this.views,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      filterStatus: filterStatus != null ? filterStatus() : this.filterStatus,
      dataStale: dataStale ?? this.dataStale,
    );
  }
}

class DeliveriesNotifier extends StateNotifier<DeliveriesState> {
  DeliveriesNotifier({
    DeliveriesState? initialState,
    bool bootstrap = true,
    bool? realFlow,
  }) : realFlow = realFlow ?? AppConstants.realFlow,
       super(
         initialState ?? DeliveriesState(views: const [], isLoading: bootstrap),
       ) {
    if (bootstrap) {
      _fetchAll();
      _startRealtime();
    }
  }

  final bool realFlow;

  void Function()? _removeRiderAssignmentListener;

  void _startRealtime() {
    unawaited(WebSocketService.instance.connectOrders());
    _removeRiderAssignmentListener = WebSocketService.instance
        .listenForRiderAssignments((_) {
          unawaited(refreshAssignments());
        });
  }

  @override
  void dispose() {
    _removeRiderAssignmentListener?.call();
    super.dispose();
  }

  Future<void> _fetchAll({bool refreshing = false}) async {
    state = state.copyWith(
      isLoading: !refreshing && state.views.isEmpty,
      isRefreshing: refreshing,
      errorMessage: () => null,
    );

    try {
      final activeResponse = await ApiClient.instance.get(
        '/riders/assignments',
      );
      final activeData = activeResponse.data as List<dynamic>;
      final activeViews = parseAssignmentViews(
        activeData,
        allowMockFallback: !realFlow,
      );

      List<RiderAssignmentView> historyViews = [];
      RiderDispatchPlan? plan;
      if (realFlow) {
        final responses = await Future.wait([
          ApiClient.instance.get('/riders/history'),
          ApiClient.instance.get('/riders/dispatch-plan'),
        ]);
        historyViews = parseAssignmentViews(
          responses[0].data as List<dynamic>,
          allowMockFallback: false,
        );
        final rawPlan = responses[1].data;
        plan = parseRiderDispatchPlan(rawPlan);
        if (rawPlan != null && plan == null) {
          throw const FormatException('Malformed rider dispatch plan');
        }
      } else {
        try {
          final historyResponse = await ApiClient.instance.get(
            '/riders/history',
          );
          final historyData = historyResponse.data as List<dynamic>;
          historyViews = parseAssignmentViews(historyData);
        } catch (_) {}
        try {
          final planResponse = await ApiClient.instance.get(
            '/riders/dispatch-plan',
          );
          plan = parseRiderDispatchPlan(planResponse.data);
        } catch (_) {}
      }

      final merged = plan == null
          ? _mergeViews(activeViews, historyViews)
          : mergeRiderAssignmentViewsWithPlan(
              active: activeViews,
              history: historyViews,
              plan: plan,
            );
      state = state.copyWith(
        views: merged,
        isLoading: false,
        isRefreshing: false,
        errorMessage: () => null,
        dataStale: plan?.routingDataStale ?? false,
      );
    } catch (_) {
      if (realFlow) {
        state = state.copyWith(
          isLoading: false,
          isRefreshing: false,
          errorMessage: () => 'Unable to load live assignments',
          dataStale: true,
        );
        return;
      }
      final mockViews = MockData.deliveryAssignments
          .asMap()
          .entries
          .map(
            (entry) => RiderAssignmentView(
              assignment: entry.value,
              order: orderContextFromMock(entry.value),
              routePosition: entry.key + 1,
            ),
          )
          .toList();
      state = state.copyWith(
        views: mockViews,
        isLoading: false,
        isRefreshing: false,
        errorMessage: () => 'Showing offline demo data',
        dataStale: true,
      );
    }
  }

  List<RiderAssignmentView> _mergeViews(
    List<RiderAssignmentView> active,
    List<RiderAssignmentView> history,
  ) => mergeRiderAssignmentViews(active, history);

  Future<void> refreshAssignments() => _fetchAll(refreshing: true);

  void filterByStatus(DeliveryStatus? status) {
    state = state.copyWith(filterStatus: () => status);
  }

  Future<void> acceptAssignment(String assignmentId) async {
    try {
      await ApiClient.instance.patch(
        '/riders/assignments/$assignmentId/status',
        data: {'status': serverDeliveryStatus(DeliveryStatus.accepted)},
      );
    } catch (_) {
      state = state.copyWith(
        errorMessage: () => 'Unable to update delivery status',
      );
      return;
    }
    _updateAssignment(assignmentId, (a) {
      if (a.status != DeliveryStatus.assigned) return a;
      return a.copyWith(
        status: DeliveryStatus.accepted,
        acceptedAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    });
  }

  Future<void> declineAssignment(String assignmentId) async {
    try {
      await ApiClient.instance.patch(
        '/riders/assignments/$assignmentId/status',
        data: {
          'status': serverDeliveryStatus(DeliveryStatus.declined),
          'declineReason': 'Rider declined',
        },
      );
    } catch (_) {
      state = state.copyWith(
        errorMessage: () => 'Unable to update delivery status',
      );
      return;
    }
    if (realFlow) {
      await refreshAssignments();
      return;
    }
    _updateAssignment(assignmentId, (a) {
      if (a.status != DeliveryStatus.assigned) return a;
      return a.copyWith(
        status: DeliveryStatus.declined,
        declineReason: 'Rider declined',
        updatedAt: DateTime.now(),
      );
    });
  }

  Future<void> advanceCheckpoint(String assignmentId) async {
    final current = state.viewById(assignmentId)?.assignment;
    if (current == null) return;

    final nextStatus = switch (current.status) {
      DeliveryStatus.assigned => DeliveryStatus.accepted,
      DeliveryStatus.accepted => DeliveryStatus.pickedUp,
      DeliveryStatus.pickedUp => DeliveryStatus.onTheWay,
      DeliveryStatus.onTheWay => DeliveryStatus.arrived,
      DeliveryStatus.arrived => null,
      DeliveryStatus.delivered || DeliveryStatus.declined => null,
    };

    if (nextStatus != null) {
      await _patchStatus(assignmentId, nextStatus);
    } else if (current.status == DeliveryStatus.arrived) {
      state = state.copyWith(
        errorMessage: () =>
            'Proof of delivery is required before completing this stop',
      );
    }
  }

  Future<void> completeDeliveryWithProof(
    String assignmentId,
    Map<String, dynamic> proof,
  ) async {
    final current = state.viewById(assignmentId)?.assignment;
    if (current == null || current.status != DeliveryStatus.arrived) return;

    final proofType = proof['type']?.toString();
    if (proofType == null || proofType.isEmpty) {
      state = state.copyWith(
        errorMessage: () =>
            'Proof of delivery is required before completing this stop',
      );
      return;
    }

    await _patchStatus(assignmentId, DeliveryStatus.delivered, proof: proof);
  }

  Future<void> _patchStatus(
    String assignmentId,
    DeliveryStatus nextStatus, {
    Map<String, dynamic>? proof,
  }) async {
    try {
      final data = <String, dynamic>{
        'status': serverDeliveryStatus(nextStatus),
      };
      if (proof != null) {
        data['proof'] = proof;
      }
      await ApiClient.instance.patch(
        '/riders/assignments/$assignmentId/status',
        data: data,
      );
    } catch (_) {
      state = state.copyWith(
        errorMessage: () => 'Unable to update delivery status',
      );
      return;
    }

    if (realFlow && nextStatus == DeliveryStatus.delivered) {
      await refreshAssignments();
      return;
    }

    _updateAssignment(assignmentId, (a) {
      final now = DateTime.now();
      switch (a.status) {
        case DeliveryStatus.assigned:
          if (nextStatus == DeliveryStatus.accepted) {
            return a.copyWith(
              status: DeliveryStatus.accepted,
              acceptedAt: now,
              updatedAt: now,
            );
          }
          return a;
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
          final capturedAt = now;
          return a.copyWith(
            status: DeliveryStatus.delivered,
            deliveredAt: now,
            proof: DeliveryProof(
              type: proof?['type']?.toString() ?? '',
              fileId: proof?['fileId'] is int
                  ? proof!['fileId'] as int
                  : int.tryParse(proof?['fileId']?.toString() ?? ''),
              objectKey: proof?['objectKey']?.toString(),
              signatureData: proof?['signatureData']?.toString(),
              capturedAt: capturedAt,
              capturedByRiderId: a.riderId,
            ),
            updatedAt: now,
          );
        case DeliveryStatus.delivered:
        case DeliveryStatus.declined:
          return a;
      }
    });
  }

  Future<void> reset() => refreshAssignments();

  void _updateAssignment(
    String id,
    DeliveryAssignment Function(DeliveryAssignment) updater,
  ) {
    final updated = state.views.map((view) {
      if (view.id != id) return view;
      return RiderAssignmentView(
        assignment: updater(view.assignment),
        order: view.order,
        routePosition: view.routePosition,
        planVersion: view.planVersion,
        planState: view.planState,
        planStop: view.planStop,
        routingDataStale: view.routingDataStale,
      );
    }).toList();
    state = state.copyWith(views: updated);
  }
}

final deliveriesProvider =
    StateNotifierProvider<DeliveriesNotifier, DeliveriesState>(
      (ref) => DeliveriesNotifier(),
    );

List<RiderAssignmentView> mergeRiderAssignmentViews(
  List<RiderAssignmentView> active,
  List<RiderAssignmentView> history,
) {
  final activeIds = <String>{};
  final orderedActive = <RiderAssignmentView>[];
  for (final view in active) {
    if (activeIds.add(view.id)) {
      orderedActive.add(view);
    }
  }

  final sortedHistory =
      history.where((view) => !activeIds.contains(view.id)).toList()..sort(
        (a, b) => b.assignment.updatedAt.compareTo(a.assignment.updatedAt),
      );

  return [...orderedActive, ...sortedHistory];
}
