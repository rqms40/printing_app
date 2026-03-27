import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

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

/// Provider exposing dashboard KPI data from mock orders.
final dashboardKpisProvider = Provider<DashboardKpis>((ref) {
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

  return DashboardKpis(
    newOrdersCount: newOrders,
    inProductionCount: inProduction,
    readyForPickupCount: readyForPickup,
    monthlyRevenue: revenue,
    deliveredCount: delivered,
  );
});

/// Provider exposing 6-month sales trend data.
final salesDataProvider = Provider<List<MonthlyDataPoint>>((ref) {
  return const [
    MonthlyDataPoint(month: 'Oct', value: 45200),
    MonthlyDataPoint(month: 'Nov', value: 52800),
    MonthlyDataPoint(month: 'Dec', value: 68500),
    MonthlyDataPoint(month: 'Jan', value: 41300),
    MonthlyDataPoint(month: 'Feb', value: 57900),
    MonthlyDataPoint(month: 'Mar', value: 63400),
  ];
});

/// Provider exposing 6-month order volume data.
final volumeDataProvider = Provider<List<MonthlyDataPoint>>((ref) {
  return const [
    MonthlyDataPoint(month: 'Oct', value: 38),
    MonthlyDataPoint(month: 'Nov', value: 45),
    MonthlyDataPoint(month: 'Dec', value: 62),
    MonthlyDataPoint(month: 'Jan', value: 35),
    MonthlyDataPoint(month: 'Feb', value: 48),
    MonthlyDataPoint(month: 'Mar', value: 55),
  ];
});
