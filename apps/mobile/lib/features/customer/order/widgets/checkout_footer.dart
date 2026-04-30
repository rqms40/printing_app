import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutFooter extends ConsumerWidget {
  const CheckoutFooter({super.key, required this.onPlaceOrder});
  final VoidCallback onPlaceOrder;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fees = ref.watch(checkoutFeesProvider);
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final canPlace = state.items.isNotEmpty &&
        state.paymentMethod != null &&
        (state.mode == DeliveryMode.pickup ||
            state.singleAddress != null ||
            state.drops.isNotEmpty);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outline)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Text('Total', style: AppTypography.bodyBold),
              const Spacer(),
              Text(
                formatCurrency(fees.total),
                style: AppTypography.h3.copyWith(color: colors.onBackground),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AppButton(
            label: 'Place Order',
            variant: AppButtonVariant.brand,
            isFullWidth: true,
            onTap: canPlace ? onPlaceOrder : null,
          ),
        ],
      ),
    );
  }
}
