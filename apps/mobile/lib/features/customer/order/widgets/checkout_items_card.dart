import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutItemsCard extends ConsumerWidget {
  const CheckoutItemsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
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
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('Your prints', style: AppTypography.bodyBold),
              const Spacer(),
              TextButton(
                onPressed: () => context.push('/customer/order/new?mode=add'),
                child: Text(
                  '+ Add Items',
                  style: AppTypography.bodyBold.copyWith(color: colors.brand),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in state.items)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.fileName, style: AppTypography.bodyBold),
                        Text(
                          formatCurrency(item.printSubtotal),
                          style: AppTypography.caption,
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.remove),
                        onPressed: () => ref
                            .read(checkoutProvider.notifier)
                            .setQuantity(
                              item.id,
                              (item.quantity - 1).clamp(1, 9999),
                            ),
                      ),
                      Text('${item.quantity}', style: AppTypography.bodyBold),
                      IconButton(
                        icon: const Icon(Icons.add),
                        onPressed: () => ref
                            .read(checkoutProvider.notifier)
                            .setQuantity(item.id, item.quantity + 1),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
