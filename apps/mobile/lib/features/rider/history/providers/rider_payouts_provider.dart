import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

class RiderPayoutItem {
  const RiderPayoutItem({
    required this.assignmentId,
    required this.orderId,
    required this.orderRef,
    required this.amountMinor,
    required this.status,
    this.deliveredAt,
    this.paidAt,
    this.adminReceiptUrl,
  });

  final int assignmentId;
  final int orderId;
  final String orderRef;
  final String amountMinor;
  final String status;
  final DateTime? deliveredAt;
  final DateTime? paidAt;
  final String? adminReceiptUrl;

  double get amountPesos => (num.tryParse(amountMinor) ?? 0) / 100.0;

  bool get isPaid => status == 'paid';

  factory RiderPayoutItem.fromJson(Map<String, dynamic> json) {
    return RiderPayoutItem(
      assignmentId: (json['assignmentId'] as num?)?.toInt() ?? 0,
      orderId: (json['orderId'] as num?)?.toInt() ?? 0,
      orderRef: '${json['orderRef'] ?? json['orderId'] ?? ''}',
      amountMinor: '${json['amountMinor'] ?? '0'}',
      status: '${json['status'] ?? 'unpaid'}',
      deliveredAt: json['deliveredAt'] != null
          ? DateTime.tryParse(json['deliveredAt'].toString())
          : null,
      paidAt: json['paidAt'] != null
          ? DateTime.tryParse(json['paidAt'].toString())
          : null,
      adminReceiptUrl: json['adminReceiptUrl']?.toString() ??
          json['admin_receipt_url']?.toString(),
    );
  }
}

class RiderPayoutsState {
  const RiderPayoutsState({
    this.items = const [],
    this.payoutQrUrl,
    this.isLoading = false,
    this.errorMessage,
  });

  final List<RiderPayoutItem> items;
  final String? payoutQrUrl;
  final bool isLoading;
  final String? errorMessage;

  RiderPayoutsState copyWith({
    List<RiderPayoutItem>? items,
    String? Function()? payoutQrUrl,
    bool? isLoading,
    String? Function()? errorMessage,
  }) {
    return RiderPayoutsState(
      items: items ?? this.items,
      payoutQrUrl: payoutQrUrl != null ? payoutQrUrl() : this.payoutQrUrl,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage != null ? errorMessage() : this.errorMessage,
    );
  }
}

class RiderPayoutsNotifier extends StateNotifier<RiderPayoutsState> {
  RiderPayoutsNotifier({
    ApiClient? apiClient,
    bool bootstrap = true,
  })  : _api = apiClient ?? ApiClient.instance,
        super(const RiderPayoutsState(isLoading: true)) {
    if (bootstrap) {
      // ignore: discarded_futures
      refresh();
    }
  }

  final ApiClient _api;

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true, errorMessage: () => null);
    try {
      final res = await _api.dio.get('/riders/payouts');
      final data = res.data is Map ? Map<String, dynamic>.from(res.data as Map) : <String, dynamic>{};
      final rawItems = data['items'];
      final items = (rawItems is List ? rawItems : const [])
          .whereType<Map>()
          .map((row) => RiderPayoutItem.fromJson(Map<String, dynamic>.from(row)))
          .toList();
      state = state.copyWith(
        items: items,
        payoutQrUrl: () =>
            data['payoutQrUrl']?.toString() ?? data['payout_qr_url']?.toString(),
        isLoading: false,
      );
    } catch (e) {
      String msg = e.toString();
      if (e is DioException) {
        msg = e.message ?? msg;
      }
      state = state.copyWith(isLoading: false, errorMessage: () => msg);
    }
  }
}

final riderPayoutsProvider =
    StateNotifierProvider.autoDispose<RiderPayoutsNotifier, RiderPayoutsState>(
  (ref) => RiderPayoutsNotifier(),
);
