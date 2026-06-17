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
}

class EarningsNotifier extends StateNotifier<EarningsData> {
  EarningsNotifier(this.ref)
      : super(const EarningsData(
          total: 0,
          deliveries: 0,
          today: 0,
          thisWeek: 0,
          thisMonth: 0,
        )) {
    _fetchEarnings();
  }

  final Ref ref;

  Future<void> _fetchEarnings() async {
    try {
      final response = await ApiClient.instance.get('/riders/earnings');
      final json = response.data as Map<String, dynamic>;
      final total = (json['total'] as num?)?.toDouble() ?? 0;
      final deliveries = (json['deliveries'] as num?)?.toInt() ?? 0;
      final breakdown = _computeBreakdown();
      state = EarningsData(
        total: total,
        deliveries: deliveries,
        today: breakdown.today,
        thisWeek: breakdown.thisWeek,
        thisMonth: breakdown.thisMonth,
      );
    } catch (_) {
      final breakdown = _computeBreakdown();
      state = EarningsData(
        total: breakdown.thisMonth,
        deliveries: ref.read(deliveriesProvider).completedAssignments
            .where((v) => v.status == DeliveryStatus.delivered)
            .length,
        today: breakdown.today,
        thisWeek: breakdown.thisWeek,
        thisMonth: breakdown.thisMonth,
      );
    }
  }

  ({double today, double thisWeek, double thisMonth}) _computeBreakdown() {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final startOfWeek = startOfDay.subtract(Duration(days: now.weekday - 1));
    final startOfMonth = DateTime(now.year, now.month);

    double today = 0;
    double thisWeek = 0;
    double thisMonth = 0;

    final delivered = ref.read(deliveriesProvider).views.where(
          (v) => v.status == DeliveryStatus.delivered,
        );

    for (final view in delivered) {
      final deliveredAt = view.assignment.deliveredAt;
      if (deliveredAt == null) continue;
      final fee = view.order.deliveryFee;
      if (!deliveredAt.isBefore(startOfDay)) today += fee;
      if (!deliveredAt.isBefore(startOfWeek)) thisWeek += fee;
      if (!deliveredAt.isBefore(startOfMonth)) thisMonth += fee;
    }

    return (today: today, thisWeek: thisWeek, thisMonth: thisMonth);
  }

  Future<void> refreshEarnings() async => _fetchEarnings();
}

final earningsProvider =
    StateNotifierProvider<EarningsNotifier, EarningsData>(
  (ref) => EarningsNotifier(ref),
);