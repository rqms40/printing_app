import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/supplier/models/supplier_job.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:printing_app/utils/file_helpers.dart';

String extractSupplierApiError(Object error) {
  if (error is DioException) {
    final data = error.response?.data;
    if (data is Map) {
      final message = data['message'];
      if (message is List) {
        return message.map((e) => e.toString()).join(', ');
      }
      if (message != null && message.toString().trim().isNotEmpty) {
        return message.toString();
      }
      final code = data['code'];
      if (code != null) return code.toString();
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return 'Request timed out. Check your connection and try again.';
    }
    if (error.type == DioExceptionType.connectionError) {
      return 'Could not reach the server. Check your connection.';
    }
    return error.message ?? 'Request failed';
  }
  return error.toString();
}

/// Inbox state for supplier jobs.
class SupplierJobsState {
  const SupplierJobsState({
    this.jobs = const [],
    this.filter = SupplierJobListFilter.all,
    this.isLoading = false,
    this.isRefreshing = false,
    this.errorMessage,
    this.actionError,
  });

  final List<SupplierJobListItem> jobs;
  final SupplierJobListFilter filter;
  final bool isLoading;
  final bool isRefreshing;
  final String? errorMessage;
  final String? actionError;

  SupplierJobsState copyWith({
    List<SupplierJobListItem>? jobs,
    SupplierJobListFilter? filter,
    bool? isLoading,
    bool? isRefreshing,
    String? Function()? errorMessage,
    String? Function()? actionError,
  }) {
    return SupplierJobsState(
      jobs: jobs ?? this.jobs,
      filter: filter ?? this.filter,
      isLoading: isLoading ?? this.isLoading,
      isRefreshing: isRefreshing ?? this.isRefreshing,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      actionError: actionError != null ? actionError() : this.actionError,
    );
  }
}

class SupplierJobsNotifier extends StateNotifier<SupplierJobsState> {
  SupplierJobsNotifier({
    SupplierJobsState? initialState,
    bool bootstrap = true,
    ApiClient? apiClient,
  }) : _api = apiClient ?? ApiClient.instance,
       super(
         initialState ??
             const SupplierJobsState(isLoading: true),
       ) {
    if (bootstrap) {
      // ignore: discarded_futures
      refresh();
    }
  }

  final ApiClient _api;
  int _generation = 0;

  Future<void> setFilter(SupplierJobListFilter filter) async {
    if (state.filter == filter) return;
    state = state.copyWith(filter: filter);
    await refresh();
  }

  Future<void> refresh({bool silent = false}) async {
    final generation = ++_generation;
    state = state.copyWith(
      isLoading: !silent && state.jobs.isEmpty,
      isRefreshing: silent || state.jobs.isNotEmpty,
      errorMessage: () => null,
    );

    try {
      final response = await _api.get(
        '/supplier/jobs',
        queryParameters: {'filter': state.filter.apiValue},
      );
      if (generation != _generation) return;

      final raw = response.data;
      final list = raw is List
          ? raw
                .whereType<Map>()
                .map(
                  (e) =>
                      SupplierJobListItem.fromJson(Map<String, dynamic>.from(e)),
                )
                .toList()
          : <SupplierJobListItem>[];

      state = state.copyWith(
        jobs: list,
        isLoading: false,
        isRefreshing: false,
        errorMessage: () => null,
      );
    } catch (e) {
      if (generation != _generation) return;
      state = state.copyWith(
        isLoading: false,
        isRefreshing: false,
        errorMessage: () => extractSupplierApiError(e),
      );
    }
  }
}

final supplierJobsProvider =
    StateNotifierProvider<SupplierJobsNotifier, SupplierJobsState>((ref) {
      return SupplierJobsNotifier();
    });

/// Detail + action state for a single supplier job (assignment id).
class SupplierJobDetailState {
  const SupplierJobDetailState({
    this.detail,
    this.isLoading = false,
    this.isSubmitting = false,
    this.errorMessage,
    this.actionMessage,
  });

  final SupplierJobDetail? detail;
  final bool isLoading;
  final bool isSubmitting;
  final String? errorMessage;
  final String? actionMessage;

  SupplierJobDetailState copyWith({
    SupplierJobDetail? Function()? detail,
    bool? isLoading,
    bool? isSubmitting,
    String? Function()? errorMessage,
    String? Function()? actionMessage,
  }) {
    return SupplierJobDetailState(
      detail: detail != null ? detail() : this.detail,
      isLoading: isLoading ?? this.isLoading,
      isSubmitting: isSubmitting ?? this.isSubmitting,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
      actionMessage: actionMessage != null
          ? actionMessage()
          : this.actionMessage,
    );
  }
}

class SupplierJobDetailNotifier extends StateNotifier<SupplierJobDetailState> {
  SupplierJobDetailNotifier(
    this.jobId, {
    bool bootstrap = true,
    ApiClient? apiClient,
  }) : _api = apiClient ?? ApiClient.instance,
       super(const SupplierJobDetailState(isLoading: true)) {
    if (bootstrap) {
      // ignore: discarded_futures
      load();
    }
  }

  final int jobId;
  final ApiClient _api;
  int _generation = 0;

  Future<void> load() async {
    final generation = ++_generation;
    state = state.copyWith(
      isLoading: true,
      errorMessage: () => null,
      actionMessage: () => null,
    );

    try {
      final response = await _api.get('/supplier/jobs/$jobId');
      if (generation != _generation) return;
      final data = response.data;
      if (data is! Map) {
        throw const FormatException('Malformed supplier job detail');
      }
      state = state.copyWith(
        detail: () =>
            SupplierJobDetail.fromJson(Map<String, dynamic>.from(data)),
        isLoading: false,
        errorMessage: () => null,
      );
    } catch (e) {
      if (generation != _generation) return;
      state = state.copyWith(
        isLoading: false,
        detail: () => null,
        errorMessage: () => extractSupplierApiError(e),
      );
    }
  }

  Future<bool> accept({
    required int finalPriceMinor,
    required DateTime promisedDate,
  }) async {
    return _runAction(() async {
      await _api.post(
        '/supplier/jobs/$jobId/accept',
        data: {
          'finalPriceMinor': finalPriceMinor,
          'promisedDate': promisedDate.toUtc().toIso8601String(),
        },
      );
      return 'Job accepted — waiting for client payment authorization';
    });
  }

  Future<bool> decline({required String reason}) async {
    return _runAction(() async {
      await _api.post(
        '/supplier/jobs/$jobId/decline',
        data: {'reason': reason},
      );
      return 'Job declined — order re-queued for matching';
    }, reload: false);
  }

  Future<bool> updateProduction({
    required ProductionMilestone milestone,
    String? notes,
  }) async {
    return _runAction(() async {
      await _api.post(
        '/supplier/jobs/$jobId/production-status',
        data: {
          'milestone': milestone.apiValue,
          if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
        },
      );
      return 'Production status updated';
    });
  }

  /// Submits self-QC evidence. Evidence file bytes are required — notes-only
  /// posts are rejected client-side (server also returns `self_qc_evidence_required`).
  Future<bool> submitSelfQc({
    String? notes,
    Uint8List? fileBytes,
    String? fileName,
  }) async {
    if (fileBytes == null ||
        fileBytes.isEmpty ||
        fileName == null ||
        fileName.trim().isEmpty) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: () => 'Self-QC evidence file is required',
        actionMessage: () => null,
      );
      return false;
    }

    return _runAction(() async {
      final extension = getFileExtension(fileName);
      final contentType =
          DioMediaType.parse(mimeTypeForExtension(extension));
      final form = FormData.fromMap({
        'file': MultipartFile.fromBytes(
          fileBytes,
          filename: fileName,
          contentType: contentType,
        ),
        if (notes != null && notes.trim().isNotEmpty) 'notes': notes.trim(),
      });
      await _api.post(
        '/supplier/jobs/$jobId/self-qc',
        data: form,
        options: Options(contentType: 'multipart/form-data'),
      );
      return 'Self-QC submitted';
    });
  }

  Future<bool> readyForPickup() async {
    return _runAction(() async {
      await _api.post('/supplier/jobs/$jobId/ready-for-pickup');
      return 'Marked ready for pickup';
    });
  }

  Future<bool> _runAction(
    Future<String> Function() action, {
    bool reload = true,
  }) async {
    state = state.copyWith(
      isSubmitting: true,
      errorMessage: () => null,
      actionMessage: () => null,
    );
    try {
      final message = await action();
      if (reload) {
        await load();
      }
      state = state.copyWith(
        isSubmitting: false,
        actionMessage: () => message,
      );
      return true;
    } catch (e) {
      state = state.copyWith(
        isSubmitting: false,
        errorMessage: () => extractSupplierApiError(e),
      );
      return false;
    }
  }
}

final supplierJobDetailProvider = StateNotifierProvider.autoDispose
    .family<SupplierJobDetailNotifier, SupplierJobDetailState, int>((
      ref,
      jobId,
    ) {
      return SupplierJobDetailNotifier(jobId);
    });
