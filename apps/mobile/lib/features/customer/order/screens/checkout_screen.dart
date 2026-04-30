import 'package:dio/dio.dart';
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

    final isEmpty = state.items.isEmpty;

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        scrolledUnderElevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
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
        child: isEmpty
            ? _CheckoutEmptyState(colors: colors)
            : ListView(
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
      bottomNavigationBar: isEmpty
          ? null
          : CheckoutFooter(
              onPlaceOrder: () => _placeOrder(context, ref),
            ),
    );
  }

  Future<void> _placeOrder(BuildContext context, WidgetRef ref) async {
    final notifier = ref.read(ordersProvider.notifier);
    try {
      final placed = await notifier.placeCheckout(ref.read(checkoutProvider));
      ref.read(checkoutProvider.notifier).reset();
      if (!context.mounted) return;
      final refs = placed.map((o) => o.orderId).toList();
      final firstNumericId =
          placed.isEmpty ? null : int.tryParse(placed.first.id);
      context.go(
        '/customer/order/success',
        extra: {'orderRefs': refs, 'firstOrderId': firstNumericId},
      );
    } on DioException catch (e) {
      if (!context.mounted) return;
      final data = e.response?.data;
      String msg = 'Could not place order. Please try again.';
      if (data is Map && data['message'] is String) {
        msg = data['message'] as String;
      }
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } catch (e) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e')));
    }
  }
}

class _CheckoutEmptyState extends StatelessWidget {
  const _CheckoutEmptyState({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                shape: BoxShape.circle,
                border: Border.all(color: colors.outline, width: 1),
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedShoppingBasket01,
                  size: 36,
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'No orders yet',
              style: AppTypography.h2.copyWith(
                color: colors.onBackground,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Your queue is empty. Start a new print order and items you add will show up here.',
              textAlign: TextAlign.center,
              style: AppTypography.body.copyWith(
                color: colors.onSurfaceDim,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: Material(
                color: colors.brand,
                borderRadius: BorderRadius.circular(12),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: () => context.go('/customer/order/new'),
                  child: const Padding(
                    padding: EdgeInsets.symmetric(vertical: 14),
                    child: Center(
                      child: Text(
                        'Start a new order',
                        style: TextStyle(
                          fontFamily: 'Satoshi',
                          color: Colors.black,
                          fontWeight: FontWeight.w700,
                          fontSize: 14,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
