import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutFooter extends ConsumerWidget {
  const CheckoutFooter({
    super.key,
    required this.onPlaceOrder,
    this.placeOrderKey,
  });
  final VoidCallback onPlaceOrder;
  final GlobalKey? placeOrderKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fees = ref.watch(checkoutFeesProvider);
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final hasDeliveryAddress =
        state.singleAddress != null ||
        (state.temporaryAddress?.isValid ?? false);
    final hasMultidropDestinations =
        state.drops.isNotEmpty &&
        state.drops.every((drop) => drop.hasValidDestination);
    final hasRequiredDestination = switch (state.mode) {
      DeliveryMode.pickup => true,
      DeliveryMode.delivery => hasDeliveryAddress,
      DeliveryMode.multidrop => hasMultidropDestinations,
    };
    final canPlace =
        state.items.isNotEmpty &&
        state.paymentMethod != null &&
        hasRequiredDestination;

    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(
          top: BorderSide(color: colors.outline.withValues(alpha: 0.25)),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 24,
            offset: const Offset(0, -6),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Total',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    formatCurrency(fees.total),
                    style: AppTypography.h2.copyWith(
                      color: colors.onBackground,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      height: 1.0,
                    ),
                  ),
                ],
              ),
              const Spacer(),
              GestureDetector(
                onTap: () => context.go('/customer/home'),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: Row(
                    children: [
                      HugeIcon(
                        icon: HugeIcons.strokeRoundedHome01,
                        size: 16,
                        color: colors.onSurfaceDim,
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Home',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontWeight: FontWeight.w700,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          KeyedSubtree(
            key: placeOrderKey,
            child: _PlaceOrderButton(
              enabled: canPlace,
              onTap: canPlace ? onPlaceOrder : null,
              colors: colors,
            ),
          ),
        ],
      ),
    );
  }
}

class _PlaceOrderButton extends StatelessWidget {
  const _PlaceOrderButton({
    required this.enabled,
    required this.onTap,
    required this.colors,
  });
  final bool enabled;
  final VoidCallback? onTap;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: AppRadius.borderXl,
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: 56,
          width: double.infinity,
          decoration: BoxDecoration(
            color: enabled ? colors.brand : colors.brand.withValues(alpha: 0.4),
            borderRadius: AppRadius.borderXl,
            boxShadow: enabled
                ? [
                    BoxShadow(
                      color: colors.brand.withValues(alpha: 0.4),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Place Order',
                style: AppTypography.bodyBold.copyWith(
                  color: colors.background,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                ),
              ),
              const SizedBox(width: 8),
              HugeIcon(
                icon: HugeIcons.strokeRoundedArrowRight01,
                size: 20,
                color: colors.background,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
