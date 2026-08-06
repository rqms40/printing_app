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
  });

  final bool isLoading;
  final bool canAccess;
  final String verificationStatus;
  final String? message;
  final String? errorMessage;

  SupplierAccessState copyWith({
    bool? isLoading,
    bool? canAccess,
    String? verificationStatus,
    String? message,
    String? errorMessage,
  }) {
    return SupplierAccessState(
      isLoading: isLoading ?? this.isLoading,
      canAccess: canAccess ?? this.canAccess,
      verificationStatus: verificationStatus ?? this.verificationStatus,
      message: message ?? this.message,
      errorMessage: errorMessage,
    );
  }
}

class SupplierAccessNotifier extends StateNotifier<SupplierAccessState> {
  SupplierAccessNotifier({ApiClient? apiClient})
    : _api = apiClient ?? ApiClient.instance,
      super(const SupplierAccessState()) {
    refresh();
  }

  final ApiClient _api;

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final res = await _api.get('/suppliers/me/access');
      final data = res.data;
      if (data is Map) {
        state = SupplierAccessState(
          isLoading: false,
          canAccess: data['canAccessSupplierInterface'] == true,
          verificationStatus:
              (data['verificationStatus'] ?? 'pending').toString(),
          message: data['message']?.toString(),
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
