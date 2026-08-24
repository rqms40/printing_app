import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/order.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

/// Admin Delivery → Fee Settings used by customer checkout.
class DeliveryFeeSettings {
  const DeliveryFeeSettings({
    required this.deliveryFeePerKm,
    required this.priorityFeeAmount,
    required this.extraDestinationSurcharge,
    this.serviceFeePercent = 0,
  });

  final double deliveryFeePerKm;
  final double priorityFeeAmount;
  final double extraDestinationSurcharge;
  /// Percent of print subtotal (10 = 10%).
  final double serviceFeePercent;

  static const fallback = DeliveryFeeSettings(
    deliveryFeePerKm: 25,
    priorityFeeAmount: 50,
    extraDestinationSurcharge: 30,
    serviceFeePercent: 0,
  );

  double serviceFeeOn(double subtotal) {
    if (serviceFeePercent <= 0 || subtotal <= 0) return 0;
    return (subtotal * serviceFeePercent).round() / 100;
  }

  /// Catalog print subtotal, or the supplier's quoted print price when set.
  double printBasePesos(Order order) {
    final quoted = order.assignedSupplier?.quotedPriceMinor;
    if (quoted != null && quoted > 0) return quoted / 100.0;
    return order.totalPrice;
  }

  /// Printing cost shown in Price Breakdown (print + % service fee).
  double printingCostOf(Order order) {
    final base = printBasePesos(order);
    return base + serviceFeeOn(base);
  }

  /// List-card / breakdown total: printing cost + delivery option + extra drops.
  double customerFacingTotalOf(Order order) {
    return printingCostOf(order) +
        order.deliveryFee +
        order.priorityFee +
        order.extraDestinationFee;
  }

  factory DeliveryFeeSettings.fromJson(Map<String, dynamic> json) {
    double read(String camel, String snake, double fallback) {
      final raw = json[camel] ?? json[snake];
      if (raw is num) return raw.toDouble();
      if (raw is String) return double.tryParse(raw) ?? fallback;
      return fallback;
    }

    return DeliveryFeeSettings(
      deliveryFeePerKm: read('deliveryFeePerKm', 'delivery_fee_per_km', 25),
      priorityFeeAmount: read(
        'priorityFeeAmount',
        'priority_fee_amount',
        50,
      ),
      extraDestinationSurcharge: read(
        'extraDestinationSurcharge',
        'extra_destination_surcharge',
        30,
      ),
      serviceFeePercent: read(
        'serviceFeePercent',
        'service_fee_percent',
        0,
      ),
    );
  }
}

final deliveryFeeSettingsProvider =
    FutureProvider<DeliveryFeeSettings>((ref) async {
  try {
    final dio = ref.watch(dioProvider);
    final response = await dio.get<Map<String, dynamic>>('/delivery-settings');
    final data = response.data;
    if (data == null) return DeliveryFeeSettings.fallback;
    return DeliveryFeeSettings.fromJson(data);
  } catch (_) {
    return DeliveryFeeSettings.fallback;
  }
});
