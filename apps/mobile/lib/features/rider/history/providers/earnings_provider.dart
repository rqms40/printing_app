import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/rider/deliveries/providers/deliveries_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Earnings data for the rider.
class EarningsData {
  const EarningsData({
    required this.total,
    required this.deliveries,
    required this.today,
    required this.thisWeek,
    required this.thisMonth,
  });

  final double total;
  final int deliveries;
  final double today;
  final double thisWeek;
  final double thisMonth;

  EarningsData copyWith({
    double? total,
    int? deliveries,
    double? today,
    double? thisWeek,
    double? thisMonth,
  }) {
    return EarningsData(
      total: total ?? this.total,
      deliveries: deliveries ?? this.deliveries,
      today: today ?? this.today,
      thisWeek: thisWeek ?? this.thisWeek,
      thisMonth: thisMonth ?? this.thisMonth,
    );
  }
}

class EarningsNotifier extends StateNotifier<EarningsData> {
  EarningsNotifier(this.ref)
    : super(
        const EarningsData(
          total: 0,
          deliveries: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
        ),
      ) {
    _fetchEarnings();
    ref.listen(deliveriesProvider, (previous, next) {
      if (_deliveredSignature(previous) == _deliveredSignature(next)) return;
      _applyLocalBreakdown();
      unawaited(_fetchEarnings());
    });
  }

  final Ref ref;

  String _deliveredSignature(DeliveriesState? state) {
    if (state == null) return '';
    final rows = state.views
        .where((view) => view.status == DeliveryStatus.delivered)
        .map(
          (view) =>
              '${view.id}:${view.assignment.deliveredAt?.toIso8601String() ?? view.assignment.updatedAt.toIso8601String()}:${view.order.deliveryFeePesos}',
        )
        .toList()
      ..sort();
    return rows.join('|');
  }

  Future<void> _fetchEarnings() async {
    try {
      final response = await ApiClient.instance.get('/riders/earnings');
      if (!mounted) return;
      final json = response.data as Map<String, dynamic>;
      final breakdown = _computeBreakdown();
      final hasServerToday = json.containsKey('today');
      state = EarningsData(
        total: (json['total'] as num?)?.toDouble() ?? breakdown.total,
        deliveries: (json['deliveries'] as num?)?.toInt() ?? breakdown.deliveries,
        today: hasServerToday
            ? (json['today'] as num?)?.toDouble() ?? 0
            : breakdown.today,
        thisWeek: json.containsKey('thisWeek')
            ? (json['thisWeek'] as num?)?.toDouble() ?? 0
            : breakdown.thisWeek,
        thisMonth: json.containsKey('thisMonth')
            ? (json['thisMonth'] as num?)?.toDouble() ?? 0
            : breakdown.thisMonth,
      );
    } catch (_) {
      if (!mounted) return;
      _applyLocalBreakdown();
    }
  }

  void _applyLocalBreakdown() {
    if (!mounted) return;
    final breakdown = _computeBreakdown();
    state = EarningsData(
      total: breakdown.total,
      deliveries: breakdown.deliveries,
      today: breakdown.today,
      thisWeek: breakdown.thisWeek,
      thisMonth: breakdown.thisMonth,
    );
  }

  ({
    double total,
    int deliveries,
    double today,
    double thisWeek,
    double thisMonth,
  }) _computeBreakdown() {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final startOfWeek = startOfDay.subtract(Duration(days: now.weekday - 1));
    final startOfMonth = DateTime(now.year, now.month);

    double total = 0;
    double today = 0;
    double thisWeek = 0;
    double thisMonth = 0;
    var deliveries = 0;

    final delivered = ref
        .read(deliveriesProvider)
        .views
        .where((v) => v.status == DeliveryStatus.delivered);

    for (final view in delivered) {
      final deliveredAt =
          view.assignment.deliveredAt ?? view.assignment.updatedAt;
      final fee = view.order.deliveryFeePesos;
      deliveries += 1;
      total += fee;
      if (!deliveredAt.isBefore(startOfDay)) today += fee;
      if (!deliveredAt.isBefore(startOfWeek)) thisWeek += fee;
      if (!deliveredAt.isBefore(startOfMonth)) thisMonth += fee;
    }

    return (
      total: total,
      deliveries: deliveries,
      today: today,
      thisWeek: thisWeek,
      thisMonth: thisMonth,
    );
  }

  Future<void> refreshEarnings() async => _fetchEarnings();
}

final earningsProvider =
    StateNotifierProvider.autoDispose<EarningsNotifier, EarningsData>(
      (ref) => EarningsNotifier(ref),
    );
