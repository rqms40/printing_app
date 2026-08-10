import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class SupplierPayout {
  const SupplierPayout({
    required this.id,
    required this.orderId,
    required this.orderRef,
    required this.grossMinor,
    required this.commissionMinor,
    required this.netMinor,
    required this.settlementState,
    this.holdReason,
    this.holdExpiresAt,
    this.createdAt,
  });

  final int id;
  final int orderId;
  final String orderRef;
  final String grossMinor;
  final String commissionMinor;
  final String netMinor;
  final String settlementState;
  final String? holdReason;
  final DateTime? holdExpiresAt;
  final DateTime? createdAt;

  factory SupplierPayout.fromJson(Map<String, dynamic> json) {
    final order = json['order'];
    String orderRef = '${json['orderId'] ?? ''}';
    if (order is Map && order['orderId'] != null) {
      orderRef = order['orderId'].toString();
    }
    return SupplierPayout(
      id: (json['id'] as num).toInt(),
      orderId: (json['orderId'] as num).toInt(),
      orderRef: orderRef,
      grossMinor: '${json['grossMinor'] ?? '0'}',
      commissionMinor: '${json['commissionMinor'] ?? '0'}',
      netMinor: '${json['netMinor'] ?? '0'}',
      settlementState: '${json['settlementState'] ?? 'pending'}',
      holdReason: json['holdReason'] as String?,
      holdExpiresAt: json['holdExpiresAt'] != null
          ? DateTime.tryParse(json['holdExpiresAt'].toString())
          : null,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'].toString())
          : null,
    );
  }

  double get netPesos => (num.tryParse(netMinor) ?? 0) / 100.0;
}

class SupplierPayoutsState {
  const SupplierPayoutsState({
    this.payouts = const [],
    this.isLoading = false,
    this.errorMessage,
  });

  final List<SupplierPayout> payouts;
  final bool isLoading;
  final String? errorMessage;

  SupplierPayoutsState copyWith({
    List<SupplierPayout>? payouts,
    bool? isLoading,
    String? Function()? errorMessage,
  }) {
    return SupplierPayoutsState(
      payouts: payouts ?? this.payouts,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
    );
  }
}

class SupplierPayoutsNotifier extends StateNotifier<SupplierPayoutsState> {
  SupplierPayoutsNotifier({
    ApiClient? apiClient,
    bool bootstrap = true,
  })  : _api = apiClient ?? ApiClient.instance,
        super(const SupplierPayoutsState(isLoading: true)) {
    if (bootstrap) {
      // ignore: discarded_futures
      refresh();
    }
  }

  final ApiClient _api;

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, errorMessage: () => null);
    try {
      final res = await _api.dio.get('/payouts/mine');
      final list = (res.data as List? ?? [])
          .whereType<Map>()
          .map((e) => SupplierPayout.fromJson(Map<String, dynamic>.from(e)))
          .toList();
      state = state.copyWith(payouts: list, isLoading: false);
    } catch (e) {
      String msg = e.toString();
      if (e is DioException) {
        msg = e.message ?? msg;
      }
      state = state.copyWith(isLoading: false, errorMessage: () => msg);
    }
  }
}

final supplierPayoutsProvider =
    StateNotifierProvider.autoDispose<SupplierPayoutsNotifier, SupplierPayoutsState>(
  (ref) => SupplierPayoutsNotifier(),
);
