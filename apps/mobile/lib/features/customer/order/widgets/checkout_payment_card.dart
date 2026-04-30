import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/payment_method_sheet.dart';
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
  const CheckoutPaymentCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final method = state.paymentMethod;

    return InkWell(
      onTap: () async {
        final result = await PaymentMethodSheet.show(context, current: method);
        if (result != null) {
          ref.read(checkoutProvider.notifier).setPaymentMethod(result);
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderXl,
          border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
        ),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: [
            Text('Payment', style: AppTypography.bodyBold),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Text(
                method == null ? 'Choose payment method' : _labelFor(method),
                style: AppTypography.body,
                textAlign: TextAlign.right,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              'Change',
              style: AppTypography.bodyBold.copyWith(color: colors.brand),
            ),
          ],
        ),
      ),
    );
  }
}
