import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/order/providers/checkout_payment_settings_provider.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/payment_method_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';
import 'package:printing_app/features/customer/order/widgets/payment_method_glyph.dart';
import 'package:printing_app/shared/models/enums.dart';

String _labelFor(PaymentMethod m) {
  switch (m) {
    case PaymentMethod.gcash:
      return 'GCash';
    case PaymentMethod.maya:
      return 'Maya';
    case PaymentMethod.cod:
      return 'Cash on Delivery';
    case PaymentMethod.gridCredits:
      return 'Pilot Credits';
    case PaymentMethod.qrPhInstapay:
      return 'QR Ph (Instapay)';
  }
}

class CheckoutPaymentCard extends ConsumerStatefulWidget {
  const CheckoutPaymentCard({
    super.key,
    this.tutorialKey,
    this.sectionKey,
    this.methodPickerKey,
  });

  /// Spotlights the whole payment section (kept for compatibility, may be unused).
  final GlobalKey? sectionKey;

  /// Spotlights just the GRIDGO Credits row (post-pipeline checkoutFeatures tutorial).
  final GlobalKey? tutorialKey;

  /// Spotlights the actual payment-method selector tile (pipeline tutorial step payment).
  final GlobalKey? methodPickerKey;

  @override
  ConsumerState<CheckoutPaymentCard> createState() =>
      _CheckoutPaymentCardState();
}

class _CheckoutPaymentCardState extends ConsumerState<CheckoutPaymentCard> {
  void _syncCheckoutPayment({
    required PaymentMethod? defaultMethod,
    required CheckoutPaymentSettings? paymentSettings,
    required bool settingsReady,
    required double creditsBalance,
  }) {
    if (!settingsReady) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final current = ref.read(checkoutProvider).paymentMethod;
      final notifier = ref.read(checkoutProvider.notifier);
      final settings = paymentSettings!;

      if (current != null &&
          !settings.isMethodEnabled(current, creditsBalance: creditsBalance)) {
        notifier.clearPaymentMethod();
        return;
      }

      if (current == null &&
          defaultMethod != null &&
          settings.isMethodEnabled(
            defaultMethod,
            creditsBalance: creditsBalance,
          )) {
        notifier.setPaymentMethod(defaultMethod);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(checkoutProvider);
    final settings = ref.watch(checkoutPaymentSettingsProvider);
    final defaultMethod = ref.watch(
      authProvider.select((state) => state.user?.defaultPaymentMethod),
    );
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final method = state.paymentMethod;
    final paymentSettings = settings.valueOrNull;
    final creditsOnlyMode = paymentSettings?.creditsOnlyMode ?? false;
    final creditsBalance =
        double.tryParse(ref.watch(authProvider).user?.credits ?? '0') ?? 0.0;

    _syncCheckoutPayment(
      defaultMethod: defaultMethod,
      paymentSettings: paymentSettings,
      settingsReady: settings.hasValue,
      creditsBalance: creditsBalance,
    );

    return KeyedSubtree(
      key: widget.sectionKey,
      child: KeyedSubtree(
        key: widget.tutorialKey,
        child: CheckoutSectionCard(
          title: 'Payment method',
          trailing: GestureDetector(
            onTap: () => _openPaymentSheet(context, method),
            child: Text(
              'Change',
              style: AppTypography.body.copyWith(
                color: colors.brand,
                fontWeight: FontWeight.w700,
                fontSize: 14,
              ),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              KeyedSubtree(
                key: widget.methodPickerKey,
                child: Semantics(
                  button: true,
                  label: method == null
                      ? 'Choose payment method'
                      : 'Change payment method. ${_labelFor(method)}',
                  onTap: () => _openPaymentSheet(context, method),
                  child: ExcludeSemantics(
                    child: InkWell(
                      borderRadius: AppRadius.borderLg,
                      onTap: () => _openPaymentSheet(context, method),
                      child: Container(
                        padding: const EdgeInsets.all(AppSpacing.md),
                        decoration: BoxDecoration(
                          color: colors.background,
                          borderRadius: AppRadius.borderLg,
                          border: Border.all(
                            color: colors.outline.withValues(alpha: 0.4),
                          ),
                        ),
                        child: method == null
                            ? _EmptyPaymentRow(colors: colors)
                            : _SelectedPaymentRow(
                                method: method,
                                colors: colors,
                              ),
                      ),
                    ),
                  ),
                ),
              ),
              if (creditsOnlyMode) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Beta orders use Pilot Credits only.',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.sm),
              Text(
                'You pay with this method after the supplier sends the final price.',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _openPaymentSheet(
    BuildContext context,
    PaymentMethod? method,
  ) async {
    final result = await PaymentMethodSheet.show(context, current: method);
    if (!mounted || result == null) return;
    ref.read(checkoutProvider.notifier).setPaymentMethod(result);
  }
}

class _EmptyPaymentRow extends StatelessWidget {
  const _EmptyPaymentRow({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: colors.surface,
            shape: BoxShape.circle,
            border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
          ),
          child: Center(
            child: HugeIcon(
              icon: HugeIcons.strokeRoundedAdd01,
              size: 16,
              color: colors.onSurfaceDim,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            'Choose payment method',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 14,
            ),
          ),
        ),
        HugeIcon(
          icon: HugeIcons.strokeRoundedArrowRight01,
          size: 18,
          color: colors.onSurfaceDim,
        ),
      ],
    );
  }
}

class _SelectedPaymentRow extends StatelessWidget {
  const _SelectedPaymentRow({required this.method, required this.colors});

  final PaymentMethod method;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        PaymentMethodGlyph(method: method, size: 36),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                _labelFor(method),
                style: AppTypography.bodyBold.copyWith(
                  color: colors.onBackground,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                method == PaymentMethod.gridCredits
                    ? 'Pay with your GRIDGO balance'
                    : method == PaymentMethod.qrPhInstapay
                    ? 'Scan QR · upload receipt to place order'
                    : 'Tap Change to pick another',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),
        HugeIcon(
          icon: HugeIcons.strokeRoundedTick02,
          size: 18,
          color: colors.brand,
        ),
      ],
    );
  }
}
