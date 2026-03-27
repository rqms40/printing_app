import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Mock earnings data for the driver.
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

final earningsProvider = Provider<EarningsData>(
  (ref) => const EarningsData(
    today: 450.0,
    thisWeek: 2350.0,
    thisMonth: 8900.0,
  ),
);
