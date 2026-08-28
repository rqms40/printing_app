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
    this.authorizedAt,
    this.adminReceiptUrl,
    this.depositAmountMinor,
    this.completionAmountMinor,
    this.completionAuthorizedAt,
    this.completionReceiptUrl,
    this.payoutQrUrl,
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
  final DateTime? authorizedAt;
  final String? adminReceiptUrl;
  final String? depositAmountMinor;
  final String? completionAmountMinor;
  final DateTime? completionAuthorizedAt;
  final String? completionReceiptUrl;
  final String? payoutQrUrl;

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
      authorizedAt: json['authorizedAt'] != null
          ? DateTime.tryParse(json['authorizedAt'].toString())
          : null,
      adminReceiptUrl: json['adminReceiptUrl']?.toString() ??
          json['admin_receipt_url']?.toString(),
      depositAmountMinor: json['depositAmountMinor']?.toString() ??
          json['deposit_amount_minor']?.toString(),
      completionAmountMinor: json['completionAmountMinor']?.toString() ??
          json['completion_amount_minor']?.toString(),
      completionAuthorizedAt: json['completionAuthorizedAt'] != null
          ? DateTime.tryParse(json['completionAuthorizedAt'].toString())
          : json['completion_authorized_at'] != null
              ? DateTime.tryParse(
                  json['completion_authorized_at'].toString(),
                )
              : null,
      completionReceiptUrl: json['completionReceiptUrl']?.toString() ??
          json['completion_receipt_url']?.toString(),
      payoutQrUrl: json['payoutQrUrl']?.toString() ??
          json['payout_qr_url']?.toString(),
    );
  }

  double get grossPesos => (num.tryParse(grossMinor) ?? 0) / 100.0;

  double get depositPesos {
    final stored = num.tryParse(depositAmountMinor ?? '');
    if (stored != null) return stored / 100.0;
    return (grossPesos / 2).floorToDouble();
  }

  double get completionPesos {
    final stored = num.tryParse(completionAmountMinor ?? '');
    if (stored != null) return stored / 100.0;
    return grossPesos - depositPesos;
  }

  String get displayStatus {
    final state = settlementState.toLowerCase();
    if (state == 'cancelled') return 'Cancelled';
    if (state == 'held' && authorizedAt == null) return 'Held';
    if (authorizedAt != null && completionAuthorizedAt == null) {
      return '50% paid';
    }
    return 'Paid';
  }
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
