import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutSummaryCard extends ConsumerWidget {
  const CheckoutSummaryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fees = ref.watch(checkoutFeesProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return CheckoutSectionCard(
      title: 'Payment details',
      child: Column(
        children: [
          _row('Subtotal', fees.subtotal, colors),
          _row('Delivery', fees.deliveryFee, colors),
          if (fees.priorityFee > 0) _row('Priority', fees.priorityFee, colors),
          if (fees.extraDropFee > 0) _row('Extra drop', fees.extraDropFee, colors),
          _row('Service fee', fees.serviceFee, colors),
        ],
      ),
    );
  }

  Widget _row(String label, double value, AppColorSet colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: AppTypography.body.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 13,
              ),
            ),
          ),
          Text(
            formatCurrency(value),
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }
}

