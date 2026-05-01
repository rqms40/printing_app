import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
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
      return 'GRID Credits';
  }
}

class CheckoutPaymentCard extends ConsumerWidget {
  const CheckoutPaymentCard({super.key, this.tutorialKey, this.sectionKey});

  /// Spotlights the whole payment section (pipeline tutorial step 7).
  final GlobalKey? sectionKey;

  /// Spotlights just the GRID Credits row (post-pipeline checkoutFeatures tutorial).
  final GlobalKey? tutorialKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final method = state.paymentMethod;

    return KeyedSubtree(
      key: sectionKey,
      child: KeyedSubtree(
      key: tutorialKey,
      child: CheckoutSectionCard(
      title: 'Payment method',
      trailing: GestureDetector(
        onTap: () async {
          final result = await PaymentMethodSheet.show(context, current: method);
          if (result != null) {
            ref.read(checkoutProvider.notifier).setPaymentMethod(result);
          }
        },
        child: Text(
          'Change',
          style: AppTypography.body.copyWith(
            color: colors.brand,
            fontWeight: FontWeight.w700,
            fontSize: 14,
          ),
        ),
      ),
      child: InkWell(
        borderRadius: AppRadius.borderLg,
        onTap: () async {
          final result = await PaymentMethodSheet.show(context, current: method);
          if (result != null) {
            ref.read(checkoutProvider.notifier).setPaymentMethod(result);
          }
        },
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.background,
            borderRadius: AppRadius.borderLg,
            border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
          ),
          child: method == null
              ? Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: colors.surface,
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: colors.outline.withValues(alpha: 0.4)),
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
                )
              : Row(
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
                                ? 'Pay with your GRID balance'
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
                ),
        ),
      ),
    ),
    ),
    );
  }
}
