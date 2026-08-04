import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

import 'package:printing_app/shared/services/websocket_service.dart';

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
    this.avgTatMins = 0,
  });

  final int newOrdersCount;
  final int inProductionCount;
  final int readyForPickupCount;
  final double monthlyRevenue;
  final int deliveredCount;
  final int avgTatMins;
}

class DashboardKpisNotifier extends StateNotifier<DashboardKpis> {
  DashboardKpisNotifier()
      : super(const DashboardKpis(
          newOrdersCount: 0,
          inProductionCount: 0,
          readyForPickupCount: 0,
          monthlyRevenue: 0,
          deliveredCount: 0,
          avgTatMins: 0,
        )) {
    _fetchKpis();
    _listenToOrderUpdates();
  }

  void _listenToOrderUpdates() {
    WebSocketService.instance.listenForOrderUpdates((_) => _fetchKpis());
    WebSocketService.instance.connectOrders();
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
        avgTatMins: (json['avgTatMins'] as num?)?.toInt() ?? 45, // Mock default
      );
    } catch (_) {
      // Offline fallback: compute from mock data
      final orders = MockData.orders;

      final newOrders = orders
          .where((o) =>
              o.orderStatus == OrderStatus.submitted ||
              o.orderStatus == OrderStatus.needsQa ||
              o.orderStatus == OrderStatus.approvedForMatching)
          .length;

      final inProduction = orders
          .where((o) =>
              o.orderStatus == OrderStatus.paymentAuthorized ||
              o.orderStatus == OrderStatus.production ||
              o.orderStatus == OrderStatus.supplierSelfQc)
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
              o.orderStatus == OrderStatus.collectedByCustomer)
          .length;

      state = DashboardKpis(
        newOrdersCount: newOrders,
        inProductionCount: inProduction,
        readyForPickupCount: readyForPickup,
        monthlyRevenue: revenue,
        deliveredCount: delivered,
        avgTatMins: 45, // Fallback MockData TAT
      );
    }
  }

  Future<void> refreshKpis() async => _fetchKpis();
}

/// Provider exposing dashboard KPI data.
final dashboardKpisProvider =
    StateNotifierProvider.autoDispose<DashboardKpisNotifier, DashboardKpis>(
  (ref) => DashboardKpisNotifier(),
);


