import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

/// Monthly data point for charts.
class MonthlyDataPoint {
  const MonthlyDataPoint({required this.month, required this.value});

  final String month;
  final double value;
}

/// KPI snapshot for the admin dashboard.
class DashboardKpis {
  const DashboardKpis({
    required this.newOrdersCount,
    required this.inProductionCount,
    required this.readyForPickupCount,
    required this.monthlyRevenue,
    required this.deliveredCount,
  });

  final int newOrdersCount;
  final int inProductionCount;
  final int readyForPickupCount;
  final double monthlyRevenue;
  final int deliveredCount;
}

class DashboardKpisNotifier extends StateNotifier<DashboardKpis> {
  DashboardKpisNotifier()
      : super(const DashboardKpis(
          newOrdersCount: 0,
          inProductionCount: 0,
          readyForPickupCount: 0,
          monthlyRevenue: 0,
          deliveredCount: 0,
        )) {
    _fetchKpis();
  }

  Future<void> _fetchKpis() async {
    try {
      final response = await ApiClient.instance.get('/admin/dashboard');
      final json = response.data as Map<String, dynamic>;
      state = DashboardKpis(
        newOrdersCount: (json['newOrdersCount'] as num?)?.toInt() ?? 0,
        inProductionCount: (json['inProductionCount'] as num?)?.toInt() ?? 0,
        readyForPickupCount: (json['readyForPickupCount'] as num?)?.toInt() ?? 0,
        monthlyRevenue: (json['monthlyRevenue'] as num?)?.toDouble() ?? 0,
        deliveredCount: (json['deliveredCount'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      // Offline fallback: compute from mock data
      final orders = MockData.orders;

      final newOrders = orders
          .where((o) => o.orderStatus == OrderStatus.orderPlaced)
          .length;

      final inProduction = orders
          .where((o) =>
              o.orderStatus == OrderStatus.printingInProgress ||
              o.orderStatus == OrderStatus.finishingMounting ||
              o.orderStatus == OrderStatus.qualityChecked)
          .length;

      final readyForPickup = orders
          .where((o) => o.orderStatus == OrderStatus.readyForDispatch)
          .length;

      final revenue = orders
          .where((o) => o.paymentStatus == PaymentStatus.paid)
          .fold<double>(0, (sum, o) => sum + o.totalPrice);

      final delivered = orders
          .where((o) =>
              o.orderStatus == OrderStatus.delivered ||
              o.orderStatus == OrderStatus.completedPickup)
          .length;

      state = DashboardKpis(
        newOrdersCount: newOrders,
        inProductionCount: inProduction,
        readyForPickupCount: readyForPickup,
        monthlyRevenue: revenue,
        deliveredCount: delivered,
      );
    }
  }

  Future<void> refreshKpis() async => _fetchKpis();
}

/// Provider exposing dashboard KPI data.
final dashboardKpisProvider =
    StateNotifierProvider<DashboardKpisNotifier, DashboardKpis>(
  (ref) => DashboardKpisNotifier(),
);

class SalesDataNotifier extends StateNotifier<List<MonthlyDataPoint>> {
  SalesDataNotifier() : super(const []) {
    _fetchSalesData();
  }

  Future<void> _fetchSalesData() async {
    try {
      final response = await ApiClient.instance.get('/admin/dashboard/sales');
      final data = response.data as List<dynamic>;
      state = data
          .map((json) {
            final map = json as Map<String, dynamic>;
            return MonthlyDataPoint(
              month: map['month'] as String? ?? '',
              value: (map['value'] as num?)?.toDouble() ?? 0,
            );
          })
          .toList();
    } catch (_) {
      // Offline fallback
      state = const [
        MonthlyDataPoint(month: 'Oct', value: 45200),
        MonthlyDataPoint(month: 'Nov', value: 52800),
        MonthlyDataPoint(month: 'Dec', value: 68500),
        MonthlyDataPoint(month: 'Jan', value: 41300),
        MonthlyDataPoint(month: 'Feb', value: 57900),
        MonthlyDataPoint(month: 'Mar', value: 63400),
      ];
    }
  }

  Future<void> refreshSalesData() async => _fetchSalesData();
}

/// Provider exposing 6-month sales trend data.
final salesDataProvider =
    StateNotifierProvider<SalesDataNotifier, List<MonthlyDataPoint>>(
  (ref) => SalesDataNotifier(),
);

class VolumeDataNotifier extends StateNotifier<List<MonthlyDataPoint>> {
  VolumeDataNotifier() : super(const []) {
    _fetchVolumeData();
  }

  Future<void> _fetchVolumeData() async {
    try {
      final response = await ApiClient.instance.get('/admin/dashboard/volume');
      final data = response.data as List<dynamic>;
      state = data
          .map((json) {
            final map = json as Map<String, dynamic>;
            return MonthlyDataPoint(
              month: map['month'] as String? ?? '',
              value: (map['value'] as num?)?.toDouble() ?? 0,
            );
          })
          .toList();
    } catch (_) {
      // Offline fallback
      state = const [
        MonthlyDataPoint(month: 'Oct', value: 38),
        MonthlyDataPoint(month: 'Nov', value: 45),
        MonthlyDataPoint(month: 'Dec', value: 62),
        MonthlyDataPoint(month: 'Jan', value: 35),
        MonthlyDataPoint(month: 'Feb', value: 48),
        MonthlyDataPoint(month: 'Mar', value: 55),
      ];
    }
  }

  Future<void> refreshVolumeData() async => _fetchVolumeData();
}

/// Provider exposing 6-month order volume data.
final volumeDataProvider =
    StateNotifierProvider<VolumeDataNotifier, List<MonthlyDataPoint>>(
  (ref) => VolumeDataNotifier(),
);
