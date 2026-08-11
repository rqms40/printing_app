import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/dio_provider.dart';

/// Checkout rails available in the marketplace pilot.
///
/// Live GCash/Maya are hidden unless [showLiveWallets] is true
/// (`--dart-define=ENABLE_SANDBOX_PAYMENTS=true`).
class CheckoutPaymentSettings {
  const CheckoutPaymentSettings({
    required this.creditsOnlyMode,
    this.showLiveWallets = false,
  });

  factory CheckoutPaymentSettings.fromJson(
    Map<String, dynamic> json, {
    bool showLiveWallets = false,
  }) {
    return CheckoutPaymentSettings(
      creditsOnlyMode: json['creditsOnlyMode'] == true,
      showLiveWallets: showLiveWallets,
    );
  }

  final bool creditsOnlyMode;

  /// When false, GCash/Maya are omitted from the chooser (not merely disabled).
  final bool showLiveWallets;

  /// Methods the sheet should render (enabled or disabled with reason).
  List<PaymentMethod> get visibleMethods {
    if (creditsOnlyMode) {
      return const [PaymentMethod.gridCredits];
    }
    final methods = <PaymentMethod>[
      PaymentMethod.gridCredits,
      PaymentMethod.qrPhInstapay,
      PaymentMethod.cod,
    ];
    if (showLiveWallets) {
      methods.addAll(const [PaymentMethod.gcash, PaymentMethod.maya]);
    }
    return methods;
  }

  bool isMethodEnabled(PaymentMethod method, {required double creditsBalance}) {
    if (!visibleMethods.contains(method)) return false;
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
    if (!visibleMethods.contains(method)) {
      return 'Unavailable';
    }
    if (creditsOnlyMode && method != PaymentMethod.gridCredits) {
      return 'Unavailable during beta testing';
    }
    if (method == PaymentMethod.gridCredits && creditsBalance <= 0) {
      return 'No Pilot Credits available';
    }
    return null;
  }

  /// Helper subtitle for enabled COD (rules shown in UI; server enforces).
  static const String codRulesSubtitle =
      'Max ₱1,500 final total · one unpaid COD order at a time';
}

final checkoutPaymentSettingsProvider =
    FutureProvider.autoDispose<CheckoutPaymentSettings>((ref) async {
      final betaStatus = await ref.watch(betaStatusProvider.future);
      final betaCreditsOnly =
          betaStatus?.globallyEnabled == true && betaStatus?.isBetaUser == true;
      const showLiveWallets = AppConstants.enableSandboxPayments;
      try {
        final dio = ref.watch(dioProvider);
        final response = await dio.get<Map<String, dynamic>>(
          '/credits/settings',
        );
        final serverSettings = CheckoutPaymentSettings.fromJson(
          response.data ?? const {},
          showLiveWallets: showLiveWallets,
        );
        return CheckoutPaymentSettings(
          creditsOnlyMode: betaCreditsOnly || serverSettings.creditsOnlyMode,
          showLiveWallets: showLiveWallets,
        );
      } catch (_) {
        return CheckoutPaymentSettings(
          creditsOnlyMode: betaCreditsOnly,
          showLiveWallets: showLiveWallets,
        );
      }
    });
