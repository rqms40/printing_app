import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class SupplierAccessState {
  const SupplierAccessState({
    this.isLoading = true,
    this.canAccess = false,
    this.verificationStatus = 'pending',
    this.message,
    this.errorMessage,
    this.needsServiceFocusSetup = false,
    this.serviceFocusRanks = const [],
  });

  final bool isLoading;
  final bool canAccess;
  final String verificationStatus;
  final String? message;
  final String? errorMessage;
  final bool needsServiceFocusSetup;
  final List<String> serviceFocusRanks;

  SupplierAccessState copyWith({
    bool? isLoading,
    bool? canAccess,
    String? verificationStatus,
    String? message,
    String? errorMessage,
    bool? needsServiceFocusSetup,
    List<String>? serviceFocusRanks,
  }) {
    return SupplierAccessState(
      isLoading: isLoading ?? this.isLoading,
      canAccess: canAccess ?? this.canAccess,
      verificationStatus: verificationStatus ?? this.verificationStatus,
      message: message ?? this.message,
      errorMessage: errorMessage,
      needsServiceFocusSetup:
          needsServiceFocusSetup ?? this.needsServiceFocusSetup,
      serviceFocusRanks: serviceFocusRanks ?? this.serviceFocusRanks,
    );
  }
}

class SupplierAccessNotifier extends StateNotifier<SupplierAccessState> {
  SupplierAccessNotifier({ApiClient? apiClient})
    : _api = apiClient ?? ApiClient.instance,
      super(const SupplierAccessState());

  final ApiClient _api;

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _api.get('/suppliers/me/access');
      if (!mounted) return;
      final data = res.data;
      if (data is Map) {
        final ranksRaw =
            data['serviceFocusRanks'] ?? data['service_focus_ranks'];
        final ranks = <String>[];
        if (ranksRaw is List) {
          for (final r in ranksRaw) {
            final s = r?.toString().trim() ?? '';
            if (s.isNotEmpty) ranks.add(s);
          }
        }
        state = SupplierAccessState(
          isLoading: false,
          canAccess: data['canAccessSupplierInterface'] == true,
          verificationStatus: (data['verificationStatus'] ?? 'pending')
              .toString(),
          message: data['message']?.toString(),
          needsServiceFocusSetup:
              data['needsServiceFocusSetup'] == true || ranks.isEmpty,
          serviceFocusRanks: ranks,
        );
        return;
      }
      state = const SupplierAccessState(
        isLoading: false,
        canAccess: false,
        verificationStatus: 'pending',
        message: 'Unable to determine supplier verification status.',
      );
    } on DioException catch (e) {
      if (!mounted) return;
      final data = e.response?.data;
      String? code;
      String? message;
      if (data is Map) {
        code = data['code']?.toString();
        message = data['message']?.toString();
      }
      state = SupplierAccessState(
        isLoading: false,
        canAccess: false,
        verificationStatus: code == 'supplier_not_verified'
            ? 'pending'
            : 'pending',
        message:
            message ??
            'Your supplier account is not verified. Contact Super Admin.',
        errorMessage: message,
      );
    } catch (e) {
      if (!mounted) return;
      state = SupplierAccessState(
        isLoading: false,
        canAccess: false,
        verificationStatus: 'pending',
        message: e.toString(),
        errorMessage: e.toString(),
      );
    }
  }
}

final supplierAccessProvider =
    StateNotifierProvider<SupplierAccessNotifier, SupplierAccessState>((ref) {
      return SupplierAccessNotifier();
    });
