import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/admin/queue/providers/queue_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

import 'package:printing_app/shared/models/order.dart';

/// Matches the dashboard analytics point structure
class DashboardAnalyticsPoint {
  const DashboardAnalyticsPoint({required this.label, required this.value});

  final String label;
  final num value;
}

class DashboardAnalyticsResponse {
  const DashboardAnalyticsResponse({
    required this.tatTrend,
    required this.volume,
    required this.paperSizeDemand,
  });

  final List<DashboardAnalyticsPoint> tatTrend;
  final List<DashboardAnalyticsPoint> volume;
  final List<DashboardAnalyticsPoint> paperSizeDemand;
}

enum DashboardAnalyticsPeriod { days7, days30, months6 }

final ordersAnalyticsPeriodProvider = StateProvider<DashboardAnalyticsPeriod>(
  (ref) => DashboardAnalyticsPeriod.days7,
);

DateTime _startOfUtcDay(DateTime date) {
  return DateTime.utc(date.year, date.month, date.day);
}

DateTime _startOfUtcMonth(DateTime date) {
  return DateTime.utc(date.year, date.month, 1);
}

const _monthLabels = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

String _formatDayLabel(DateTime date) {
  return '${_monthLabels[date.month - 1]} ${date.day.toString().padLeft(2, "0")}';
}

String _formatMonthLabel(DateTime date) {
  return _monthLabels[date.month - 1];
}

class _Bucket {
  _Bucket({required this.key, required this.label, required this.start});
  final String key;
  final String label;
  final DateTime start;
}

List<_Bucket> _buildBuckets(DashboardAnalyticsPeriod period, DateTime now) {
  if (period == DashboardAnalyticsPeriod.months6) {
    final currentMonth = _startOfUtcMonth(now);
    final start = DateTime.utc(currentMonth.year, currentMonth.month - 5, 1);

    return List.generate(6, (index) {
      final d = DateTime.utc(start.year, start.month + index, 1);
      return _Bucket(
        key: '${d.year}-${d.month.toString().padLeft(2, "0")}',
        label: _formatMonthLabel(d),
        start: d,
      );
    });
  }

  final days = period == DashboardAnalyticsPeriod.days7 ? 7 : 30;
  final currentDay = _startOfUtcDay(now);
  final start = currentDay.subtract(Duration(days: days - 1));

  return List.generate(days, (index) {
    final d = start.add(Duration(days: index));
    final key =
        '${d.year}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}';
    return _Bucket(key: key, label: _formatDayLabel(d), start: d);
  });
}

String _getBucketKey(DateTime date, DashboardAnalyticsPeriod period) {
  if (period == DashboardAnalyticsPeriod.months6) {
    return '${date.year}-${date.month.toString().padLeft(2, "0")}';
  }
  final d = _startOfUtcDay(date);
  return '${d.year}-${d.month.toString().padLeft(2, "0")}-${d.day.toString().padLeft(2, "0")}';
}

bool _isExcludedFromPaperDemand(OrderStatus status) {
  return status == OrderStatus.cancelled || status == OrderStatus.fileRejected;
}

DashboardAnalyticsResponse _deriveDashboardAnalyticsFromOrders(
  List<Order> orders,
  DashboardAnalyticsPeriod period, [
  DateTime? now,
]) {
  final currentNow = now ?? DateTime.now();
  final buckets = _buildBuckets(period, currentNow);
  final earliestBucket = buckets.isEmpty ? currentNow : buckets.first.start;

  final tatTrend = <String, int>{for (var b in buckets) b.key: 0};
  final volume = <String, int>{for (var b in buckets) b.key: 0};
  final paperSizeDemand = <String, int>{};

  for (final order in orders) {
    final createdAt = order.createdAt;

    if (createdAt.isBefore(earliestBucket)) continue;

    final bucketKey = _getBucketKey(createdAt, period);
    if (!tatTrend.containsKey(bucketKey) || !volume.containsKey(bucketKey)) {
      continue;
    }

    volume[bucketKey] = (volume[bucketKey] ?? 0) + 1;

    if (order.estimatedCompletionAt != null) {
      // Mock TAT increment just like Web Admin
      tatTrend[bucketKey] = (tatTrend[bucketKey] ?? 0) + 120;
    }

    if (!_isExcludedFromPaperDemand(order.orderStatus)) {
      final paperItems = order.items
          .where((item) => item.category == 'paper' && item.paperSpecs != null)
          .toList();

      if (paperItems.isNotEmpty) {
        for (final item in paperItems) {
          final size = item.paperSpecs!.paperSize.name.toUpperCase();
          paperSizeDemand[size] = (paperSizeDemand[size] ?? 0) + item.quantity;
        }
      } else if (order.category == 'paper' && order.paperSpecs != null) {
        final size = order.paperSpecs!.paperSize.name.toUpperCase();
        paperSizeDemand[size] = (paperSizeDemand[size] ?? 0) + order.quantity;
      }
    }
  }

  // Sort paper size demand by count descending
  final paperDemandList = paperSizeDemand.entries
      .toList()
      .map((e) => DashboardAnalyticsPoint(label: e.key, value: e.value))
      .toList();
  paperDemandList.sort((a, b) => b.value.compareTo(a.value));

  return DashboardAnalyticsResponse(
    tatTrend: buckets
        .map(
          (b) => DashboardAnalyticsPoint(
            label: b.label,
            value: tatTrend[b.key] ?? 0,
          ),
        )
        .toList(),
    volume: buckets
        .map(
          (b) => DashboardAnalyticsPoint(
            label: b.label,
            value: volume[b.key] ?? 0,
          ),
        )
        .toList(),
    paperSizeDemand: paperDemandList,
  );
}

final ordersAnalyticsProvider = Provider<DashboardAnalyticsResponse>((ref) {
  final orders = ref.watch(queueProvider).orders;
  final period = ref.watch(ordersAnalyticsPeriodProvider);
  return _deriveDashboardAnalyticsFromOrders(orders, period);
});

final recentOrdersProvider = Provider<List<Order>>((ref) {
  final orders = ref.watch(queueProvider).orders;
  // Sort by 'updatedAt' descending
  final sorted = List.of(orders);
  sorted.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
  return sorted.take(5).toList();
});
