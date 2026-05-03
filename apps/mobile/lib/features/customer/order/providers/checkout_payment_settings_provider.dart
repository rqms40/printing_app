import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

class CheckoutPaymentSettings {
  const CheckoutPaymentSettings({required this.creditsOnlyMode});

  factory CheckoutPaymentSettings.fromJson(Map<String, dynamic> json) {
    return CheckoutPaymentSettings(
      creditsOnlyMode: json['creditsOnlyMode'] == true,
    );
  }

  final bool creditsOnlyMode;
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
