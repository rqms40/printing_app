import 'dart:async';

import 'package:dio/dio.dart';

import 'package:flutter/widgets.dart';
import 'package:latlong2/latlong.dart';

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
    this.planOrigin,
  });

  final List<RiderAssignmentView> views;
  final bool isLoading;
  final bool isRefreshing;
  final String? errorMessage;
  final DeliveryStatus? filterStatus;
  final bool dataStale;
  final LatLng? planOrigin;

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
            v.status == DeliveryStatus.declined ||
            v.status == DeliveryStatus.failed,
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
    LatLng? Function()? planOrigin,
  }) {
    return DeliveriesState(
      views: views ?? this.views,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      filterStatus: filterStatus != null ? filterStatus() : this.filterStatus,
      dataStale: dataStale ?? this.dataStale,
      planOrigin: planOrigin != null ? planOrigin() : this.planOrigin,
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
  int _fetchGeneration = 0;

  void Function()? _removeRiderAssignmentListener;
  void Function()? _removeRiderDispatchPlanListener;
  _ResumeRefreshObserver? _resumeObserver;

  void _startRealtime() {
    unawaited(WebSocketService.instance.connectOrders());
    _removeRiderAssignmentListener = WebSocketService.instance
        .listenForRiderAssignments((_) {
          unawaited(refreshAssignments());
        });
    _removeRiderDispatchPlanListener = WebSocketService.instance
        .listenForRiderDispatchPlanUpdates((_) {
          unawaited(refreshAssignments());
        });
    // Sockets can miss events while the OS suspends the app; a foreground
    // re-fetch keeps the rider's assignments matching the database.
    _resumeObserver = _ResumeRefreshObserver(() {
      unawaited(refreshAssignments());
    });
    WidgetsBinding.instance.addObserver(_resumeObserver!);
  }

  @override
  void dispose() {
    _fetchGeneration += 1;
    _removeRiderAssignmentListener?.call();
    _removeRiderDispatchPlanListener?.call();
    if (_resumeObserver != null) {
      WidgetsBinding.instance.removeObserver(_resumeObserver!);
    }
    super.dispose();
  }

  Future<void> _fetchAll({bool refreshing = false}) async {
    final generation = ++_fetchGeneration;
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
        final noPlanPayload =
            rawPlan == null || (rawPlan is String && rawPlan.trim().isEmpty);
        if (!noPlanPayload && plan == null) {
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
      if (!mounted || generation != _fetchGeneration) return;
      state = state.copyWith(
        views: merged,
        isLoading: false,
        isRefreshing: false,
        errorMessage: () => null,
        dataStale: plan?.routingDataStale ?? false,
        planOrigin: () => plan?.origin,
      );
    } catch (_) {
      if (!mounted || generation != _fetchGeneration) return;
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
      if (!mounted) return;
      state = state.copyWith(
        errorMessage: () => 'Unable to update delivery status',
      );
      return;
    }
    if (!mounted) return;
    _updateAssignment(assignmentId, (a) {
      if (a.status != DeliveryStatus.assigned) return a;
      return a.copyWith(
        status: DeliveryStatus.accepted,
        acceptedAt: DateTime.now(),
        updatedAt: DateTime.now(),
      );
    });
  }

  /// Rider-triggered re-optimize of their own remaining route. Returns a
  /// user-facing error message, or null on success.
  Future<String?> requestReplan() async {
    try {
      await ApiClient.instance.post('/riders/dispatch-plan/re-optimize');
      await refreshAssignments();
      return null;
    } on DioException catch (e) {
      final data = e.response?.data;
      final code = data is Map ? data['code'] : null;
      if (e.response?.statusCode == 503 || code == 'routing_unavailable') {
        return 'Road routing unavailable — keeping your current route';
      }
      return 'Could not request a new plan';
    } catch (_) {
      return 'Could not request a new plan';
    }
  }

  Future<void> declineAssignment(
    String assignmentId, {
    String reason = 'Rider declined',
  }) async {
    try {
      await ApiClient.instance.patch(
        '/riders/assignments/$assignmentId/status',
        data: {
          'status': serverDeliveryStatus(DeliveryStatus.declined),
          'declineReason': reason,
        },
      );
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(
        errorMessage: () => 'Unable to update delivery status',
      );
      return;
    }
    if (!mounted) return;
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
      DeliveryStatus.accepted => null, // needs pickup OTP + photo
      DeliveryStatus.pickedUp => DeliveryStatus.onTheWay,
      DeliveryStatus.onTheWay => DeliveryStatus.arrived,
      DeliveryStatus.arrived => null,
      DeliveryStatus.delivered ||
      DeliveryStatus.declined ||
      DeliveryStatus.failed => null,
    };

    if (nextStatus != null) {
      await _patchStatus(assignmentId, nextStatus);
    } else if (current.status == DeliveryStatus.accepted) {
      state = state.copyWith(
        errorMessage: () =>
            'Pickup OTP and photo proof are required before pickup',
      );
    } else if (current.status == DeliveryStatus.arrived) {
      state = state.copyWith(
        errorMessage: () =>
            'Proof of delivery is required before completing this stop',
      );
    }
  }

  Future<void> completePickupWithProof(
    String assignmentId,
    Map<String, dynamic> proofPayload,
  ) async {
    final current = state.viewById(assignmentId)?.assignment;
    if (current == null || current.status != DeliveryStatus.accepted) return;

    final proofType = proofPayload['type']?.toString();
    final otp = proofPayload['otp']?.toString().trim();
    if (proofType != 'photo' || otp == null || otp.isEmpty) {
      state = state.copyWith(
        errorMessage: () =>
            'Pickup OTP and photo proof are required before pickup',
      );
      return;
    }

    final proof = Map<String, dynamic>.from(proofPayload)..remove('otp');
    await _patchStatus(
      assignmentId,
      DeliveryStatus.pickedUp,
      proof: proof,
      otp: otp,
    );
  }

  Future<void> completeDeliveryWithProof(
    String assignmentId,
    Map<String, dynamic> proofPayload,
  ) async {
    final current = state.viewById(assignmentId)?.assignment;
    if (current == null || current.status != DeliveryStatus.arrived) return;

    final proofType = proofPayload['type']?.toString();
    final otp = proofPayload['otp']?.toString().trim();
    if (proofType == null || proofType.isEmpty || otp == null || otp.isEmpty) {
      state = state.copyWith(
        errorMessage: () =>
            'Delivery OTP and proof are required before completing this stop',
      );
      return;
    }

    final proof = Map<String, dynamic>.from(proofPayload)..remove('otp');
    await _patchStatus(
      assignmentId,
      DeliveryStatus.delivered,
      proof: proof,
      otp: otp,
    );
  }

  /// Failed delivery + return path (evidence + reason required).
  Future<bool> markFailedDelivery(
    String assignmentId, {
    required String reason,
    required Map<String, dynamic> proof,
  }) async {
    final view = state.viewById(assignmentId);
    if (view == null || !view.canMarkFailed) return false;
    if (reason.trim().isEmpty) {
      state = state.copyWith(
        errorMessage: () => 'Failed delivery requires a reason',
      );
      return false;
    }
    if (proof['type']?.toString() != 'photo' || proof['fileId'] == null) {
      state = state.copyWith(
        errorMessage: () => 'Failed delivery requires photo evidence',
      );
      return false;
    }

    try {
      await ApiClient.instance.patch(
        '/riders/assignments/$assignmentId/status',
        data: {
          'status': serverDeliveryStatus(DeliveryStatus.failed),
          'declineReason': reason.trim(),
          'proof': proof,
        },
      );
    } catch (_) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: () => 'Unable to record failed delivery',
      );
      return false;
    }
    if (!mounted) return false;
    await refreshAssignments();
    return true;
  }

  /// COD cash collect via payments API (exact amount is server-side).
  Future<bool> collectCod({
    required String orderInternalId,
    required int photoFileId,
    String? otpRef,
  }) async {
    try {
      await ApiClient.instance.post(
        '/payments/cod/$orderInternalId/collect',
        data: {
          'photoFileId': photoFileId,
          if (otpRef != null && otpRef.isNotEmpty) 'otpRef': otpRef,
        },
      );
      if (!mounted) return true;
      await refreshAssignments();
      return true;
    } catch (_) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: () => 'Unable to record COD collection',
      );
      return false;
    }
  }

  /// COD cash collection failure path.
  Future<bool> failCodCollection({
    required String orderInternalId,
    required String returnReason,
    int? photoFileId,
  }) async {
    try {
      await ApiClient.instance.post(
        '/payments/cod/$orderInternalId/fail',
        data: {
          'returnReason': returnReason.trim(),
          if (photoFileId != null) 'photoFileId': photoFileId,
        },
      );
      if (!mounted) return true;
      await refreshAssignments();
      return true;
    } catch (_) {
      if (!mounted) return false;
      state = state.copyWith(
        errorMessage: () => 'Unable to record COD failure',
      );
      return false;
    }
  }

  Future<void> _patchStatus(
    String assignmentId,
    DeliveryStatus nextStatus, {
    Map<String, dynamic>? proof,
    String? otp,
  }) async {
    try {
      final data = <String, dynamic>{
        'status': serverDeliveryStatus(nextStatus),
      };
      if (proof != null) {
        data['proof'] = proof;
      }
      if (otp != null && otp.isNotEmpty) {
        data['otp'] = otp;
      }
      await ApiClient.instance.patch(
        '/riders/assignments/$assignmentId/status',
        data: data,
      );
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data?['message'] ?? 'Unable to update delivery status';
      state = state.copyWith(
        errorMessage: () => msg is List ? msg.join(', ') : msg.toString(),
      );
      return;
    } catch (_) {
      if (!mounted) return;
      state = state.copyWith(
        errorMessage: () => 'Unable to update delivery status',
      );
      return;
    }

    if (!mounted) return;

    if (realFlow &&
        (nextStatus == DeliveryStatus.delivered ||
            nextStatus == DeliveryStatus.failed)) {
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
          if (nextStatus == DeliveryStatus.failed) {
            return a.copyWith(
              status: DeliveryStatus.failed,
              declineReason: null,
              updatedAt: now,
            );
          }
          return a.copyWith(
            status: DeliveryStatus.onTheWay,
            onTheWayAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.onTheWay:
          if (nextStatus == DeliveryStatus.failed) {
            return a.copyWith(
              status: DeliveryStatus.failed,
              updatedAt: now,
            );
          }
          return a.copyWith(
            status: DeliveryStatus.arrived,
            arrivedAt: now,
            updatedAt: now,
          );
        case DeliveryStatus.arrived:
          if (nextStatus == DeliveryStatus.failed) {
            return a.copyWith(
              status: DeliveryStatus.failed,
              updatedAt: now,
            );
          }
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
        case DeliveryStatus.failed:
          return a;
      }
    });
  }

  Future<void> reset() => refreshAssignments();

  void _updateAssignment(
    String id,
    DeliveryAssignment Function(DeliveryAssignment) updater,
  ) {
    if (!mounted) return;
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
    StateNotifierProvider.autoDispose<DeliveriesNotifier, DeliveriesState>(
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

/// Calls [onResume] whenever the app returns to the foreground.
class _ResumeRefreshObserver extends WidgetsBindingObserver {
  _ResumeRefreshObserver(this.onResume);

  final void Function() onResume;

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) onResume();
  }
}
