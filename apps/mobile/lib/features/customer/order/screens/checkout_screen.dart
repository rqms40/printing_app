import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_delivery_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_footer.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_items_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_payment_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_speed_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_summary_card.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';

class CheckoutScreen extends ConsumerWidget {
  const CheckoutScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        scrolledUnderElevation: 0,
        leading: IconButton(
          icon: HugeIcon(
            icon: HugeIcons.strokeRoundedArrowLeft01,
            color: colors.onBackground,
            size: 22,
          ),
          onPressed: () => context.pop(),
        ),
        title: Text(
          'Checkout',
          style: AppTypography.h3.copyWith(
            color: colors.onBackground,
            fontWeight: FontWeight.w800,
            letterSpacing: -0.3,
          ),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: AppSpacing.md),
            child: _ItemCountPill(count: state.itemCount, colors: colors),
          ),
        ],
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            AppSpacing.sm,
            AppSpacing.md,
            AppSpacing.lg,
          ),
          children: const [
            CheckoutItemsCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutDeliveryCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutSpeedCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutPaymentCard(),
            SizedBox(height: AppSpacing.md),
            CheckoutSummaryCard(),
            SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
      bottomNavigationBar: CheckoutFooter(
        onPlaceOrder: () => _placeOrder(context, ref),
      ),
    );
  }

  Future<void> _placeOrder(BuildContext context, WidgetRef ref) async {
    final notifier = ref.read(ordersProvider.notifier);
    try {
      await notifier.placeCheckout(ref.read(checkoutProvider));
      ref.read(checkoutProvider.notifier).reset();
      if (context.mounted) context.go('/customer/home');
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class _ItemCountPill extends StatelessWidget {
  const _ItemCountPill({required this.count, required this.colors});
  final int count;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: colors.brand.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: colors.brand.withValues(alpha: 0.4), width: 0.75),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedShoppingBag03,
            size: 13,
            color: colors.brand,
          ),
          const SizedBox(width: 5),
          Text(
            '$count ${count == 1 ? 'job' : 'jobs'}',
            style: AppTypography.caption.copyWith(
              color: colors.brand,
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }
}
