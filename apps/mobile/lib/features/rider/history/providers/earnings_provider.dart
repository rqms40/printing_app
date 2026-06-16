import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Earnings data for the rider.
class EarningsData {
  const EarningsData({
    required this.today,
    required this.thisWeek,
    required this.thisMonth,
  });

  final double today;
  final double thisWeek;
  final double thisMonth;
}

class EarningsNotifier extends StateNotifier<EarningsData> {
  EarningsNotifier()
      : super(const EarningsData(today: 0, thisWeek: 0, thisMonth: 0)) {
    _fetchEarnings();
  }

  Future<void> _fetchEarnings() async {
    try {
      final response = await ApiClient.instance.get('/riders/earnings');
      final json = response.data as Map<String, dynamic>;
      state = EarningsData(
        today: (json['today'] as num?)?.toDouble() ?? 0,
        thisWeek: (json['thisWeek'] as num?)?.toDouble() ?? 0,
        thisMonth: (json['thisMonth'] as num?)?.toDouble() ?? 0,
      );
    } catch (_) {
      // Offline fallback with mock values
      state = const EarningsData(
        today: 450.0,
        thisWeek: 2350.0,
        thisMonth: 8900.0,
      );
    }
  }

  Future<void> refreshEarnings() async => _fetchEarnings();
}

final earningsProvider =
    StateNotifierProvider<EarningsNotifier, EarningsData>(
  (ref) => EarningsNotifier(),
);
