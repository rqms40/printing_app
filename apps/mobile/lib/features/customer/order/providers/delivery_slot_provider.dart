import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

class DeliverySlotState {
  const DeliverySlotState({
    this.slots = const [],
    this.isLoading = false,
    this.error,
  });

  final List<DeliverySlot> slots;
  final bool isLoading;
  final String? error;

  DeliverySlotState copyWith({
    List<DeliverySlot>? slots,
    bool? isLoading,
    String? error,
  }) =>
      DeliverySlotState(
        slots: slots ?? this.slots,
        isLoading: isLoading ?? this.isLoading,
        error: error,
      );
}

final webSocketServiceProvider =
    Provider<WebSocketService>((_) => WebSocketService.instance);

class DeliverySlotNotifier extends StateNotifier<DeliverySlotState> {
  DeliverySlotNotifier(this._date, this._dio, this._ws)
      : super(const DeliverySlotState());

  final String _date;
  final Dio _dio;
  final WebSocketService _ws;
  VoidCallback? _removeListener;

  Future<void> initialize() async {
    await refresh();
    await _ws.connectDeliverySlots();
    _ws.subscribeSlots(_date);
    _removeListener = _ws.listenForSlotUpdates(_handleUpdate);
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    try {
      final res =
          await _dio.get<List<dynamic>>('/delivery-slots?date=$_date');
      final slots = (res.data ?? [])
          .map((e) => DeliverySlot.fromJson(e as Map<String, dynamic>))
          .toList();
      state = state.copyWith(slots: slots, isLoading: false, error: null);
    } catch (e) {
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void applyUpdate(Map<String, dynamic> payload) {
    if (payload['date'] != _date) return;
    final templateId = payload['templateId'] as int;
    final newCount = payload['bookedCount'] as int;
    state = state.copyWith(
      slots: state.slots
          .map((s) =>
              s.templateId == templateId ? s.copyWith(bookedCount: newCount) : s)
          .toList(),
    );
  }

  void _handleUpdate(Map<String, dynamic> payload) => applyUpdate(payload);

  @visibleForTesting
  void debugSeedSlotsForTest(List<DeliverySlot> slots) {
    state = state.copyWith(slots: slots);
  }

  @override
  void dispose() {
    _removeListener?.call();
    _ws.unsubscribeSlots(_date);
    super.dispose();
  }
}

final deliverySlotProvider = StateNotifierProvider.family
    .autoDispose<DeliverySlotNotifier, DeliverySlotState, String>(
  (ref, date) => DeliverySlotNotifier(
    date,
    ref.read(dioProvider),
    ref.read(webSocketServiceProvider),
  ),
);
