import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
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
    if (creditsOnlyMode && method != PaymentMethod.gridCredits) return false;
    if (method == PaymentMethod.gridCredits && creditsBalance <= 0) {
      return false;
    }
    return true;
  }

  String? disabledSubtitleFor(
    PaymentMethod method, {
    required double creditsBalance,
  }) {
    if (creditsOnlyMode && method != PaymentMethod.gridCredits) {
      return 'Unavailable during beta testing';
    }
    if (method == PaymentMethod.gridCredits && creditsBalance <= 0) {
      return 'No credits — top up to use';
    }
    return null;
  }
}

final checkoutPaymentSettingsProvider =
    FutureProvider.autoDispose<CheckoutPaymentSettings>((ref) async {
      final betaStatus = await ref.watch(betaStatusProvider.future);
      final betaCreditsOnly =
          betaStatus?.globallyEnabled == true && betaStatus?.isBetaUser == true;
      try {
        final dio = ref.watch(dioProvider);
        final response = await dio.get<Map<String, dynamic>>(
          '/credits/settings',
        );
        final serverSettings = CheckoutPaymentSettings.fromJson(
          response.data ?? const {},
        );
        return CheckoutPaymentSettings(
          creditsOnlyMode:
              betaCreditsOnly || serverSettings.creditsOnlyMode,
        );
      } catch (_) {
        return CheckoutPaymentSettings(creditsOnlyMode: betaCreditsOnly);
      }
    });
