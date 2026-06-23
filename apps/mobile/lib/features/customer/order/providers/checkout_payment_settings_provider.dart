import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

class CheckoutPaymentSettings {
  const CheckoutPaymentSettings({required this.creditsOnlyMode});

  factory CheckoutPaymentSettings.fromJson(Map<String, dynamic> json) {
    return CheckoutPaymentSettings(
      creditsOnlyMode: json['creditsOnlyMode'] == true,
    );
  }

  final bool creditsOnlyMode;

  bool isMethodEnabled(PaymentMethod method, {required double creditsBalance}) {
    // Legacy server/admin flag used during beta checkout. Keep e-wallets
    // available for testers; only suspend cash collection.
    if (creditsOnlyMode && method == PaymentMethod.cod) return false;
    if (method == PaymentMethod.gridCredits && creditsBalance <= 0) {
      return false;
    }
    return true;
  }

  String? disabledSubtitleFor(
    PaymentMethod method, {
    required double creditsBalance,
  }) {
    if (creditsOnlyMode && method == PaymentMethod.cod) {
      return 'Temporarily unavailable';
    }
    if (method == PaymentMethod.gridCredits && creditsBalance <= 0) {
      return 'No credits — top up to use';
    }
    return null;
  }
}

final checkoutPaymentSettingsProvider =
    FutureProvider.autoDispose<CheckoutPaymentSettings>((ref) async {
      try {
        final dio = ref.watch(dioProvider);
        final response = await dio.get<Map<String, dynamic>>(
          '/credits/settings',
        );
        return CheckoutPaymentSettings.fromJson(response.data ?? const {});
      } catch (_) {
        return const CheckoutPaymentSettings(creditsOnlyMode: false);
      }
    });
