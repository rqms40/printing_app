import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutSummaryCard extends ConsumerWidget {
  const CheckoutSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fees = ref.watch(checkoutFeesProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        children: [
          _row('Subtotal', fees.subtotal),
          _row('Delivery', fees.deliveryFee),
          if (fees.priorityFee > 0) _row('Priority', fees.priorityFee),
          if (fees.extraDropFee > 0) _row('Extra drop', fees.extraDropFee),
          _row('Service fee', fees.serviceFee),
        ],
      ),
    );
  }

  Widget _row(String label, double value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 2),
        child: Row(
          children: [
            Expanded(child: Text(label, style: AppTypography.body)),
            Text(formatCurrency(value), style: AppTypography.bodyBold),
          ],
        ),
      );
}
