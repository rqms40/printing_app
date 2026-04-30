import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
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

    // Sections sit on `surface`. The thin gap between sections uses
    // `background` (a darker shade), giving a Grab/FoodPanda-style
    // segmented look without bordered cards.
    final divider = Container(
      height: 8,
      color: colors.background,
    );

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: colors.surface,
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
        titleSpacing: 0,
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
            padding: const EdgeInsets.only(right: 18),
            child: Center(
              child: Text(
                '${state.itemCount} ${state.itemCount == 1 ? 'item' : 'items'}',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: colors.outline.withValues(alpha: 0.2)),
        ),
      ),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            const CheckoutItemsCard(),
            divider,
            const CheckoutDeliveryCard(),
            divider,
            const CheckoutSpeedCard(),
            divider,
            const CheckoutPaymentCard(),
            divider,
            const CheckoutSummaryCard(),
            const SizedBox(height: 8),
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
