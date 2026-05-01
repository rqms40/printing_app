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
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _multiDropKey = GlobalKey();
  final _paymentKey = GlobalKey();
  final _paymentSectionKey = GlobalKey();
  final _itemsKey = GlobalKey();
  final _placeOrderKey = GlobalKey();
  bool _advancedThisFrame = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShowCheckoutTutorial());
  }

  @override
  void dispose() {
    final state = ref.read(pipelineTutorialProvider);
    const pipelineSteps = {
      PipelineStep.checkoutItems,
      PipelineStep.checkoutDelivery,
      PipelineStep.checkoutPayment,
      PipelineStep.placeOrderButton,
    };
    if (state.active &&
        pipelineSteps.contains(state.step) &&
        !_advancedThisFrame) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Tutorial dismissed — replay anytime in Profile → Reset Tutorials.'),
        ),
      );
    }
    super.dispose();
  }

  void _maybeShowCheckoutTutorial() {
    if (!mounted) return;

    final pipeline = ref.read(pipelineTutorialProvider);
    if (pipeline.active && pipeline.step == PipelineStep.checkoutItems) {
      _firePipelineItems();
      return;
    }

    // Post-pipeline standalone visit: checkoutFeatures
    if (ref.read(tutorialSeenProvider(TutorialKey.pipeline)) &&
        !ref.read(tutorialSeenProvider(TutorialKey.checkoutFeatures))) {
      _startCheckoutFeaturesCoachMarks();
    }
  }

  void _firePipelineItems() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _itemsKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Items',
          body: "Quick review of what you're printing.",
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) _firePipelineDelivery();
        });
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _firePipelineDelivery() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _multiDropKey,
          icon: HugeIcons.strokeRoundedLocation01,
          title: 'Pick a delivery option',
          body: "Choose Delivery, Pickup, or Multi-drop. Tap 'Got it' to continue.",
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) _firePipelinePayment();
        });
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _firePipelinePayment() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _paymentSectionKey,
          icon: HugeIcons.strokeRoundedWallet01,
          title: 'Payment method',
          body: 'Choose how you want to pay — GRID Credits or GCash. Tap "Got it" when you\'ve picked one.',
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
        Future.delayed(const Duration(milliseconds: 300), () {
          if (mounted) _firePipelinePlaceOrder();
        });
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _firePipelinePlaceOrder() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _placeOrderKey,
          icon: HugeIcons.strokeRoundedCheckmarkCircle02,
          title: 'Place Order',
          body: 'All set — tap Place Order to send it.',
          advanceOnSpotlightTap: true,
          onSpotlightTap: () {
            _advancedThisFrame = true;
            ref.read(pipelineTutorialProvider.notifier).advance();
            _placeOrder(context);
          },
        ),
      ],
      () {},
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _startCheckoutFeaturesCoachMarks() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _multiDropKey,
          icon: HugeIcons.strokeRoundedRoute01,
          title: 'Multi-drop Delivery',
          body: 'Send prints to different addresses in one order. One rider, all the stops.',
          advanceOnSpotlightTap: false,
        ),
        TutorialStep(
          targetKey: _paymentKey,
          icon: HugeIcons.strokeRoundedCoins01,
          title: 'Pay with GRID Credits',
          body: 'No OTP, no app-switching. Top up anytime in Profile → Wallet.',
          advanceOnSpotlightTap: false,
        ),
      ],
      () => ref.read(tutorialProvider.notifier).markSeen(TutorialKey.checkoutFeatures),
    );
  }

  @override
  Widget build(BuildContext context) {
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
                  CheckoutItemsCard(tutorialKey: _itemsKey),
                  divider,
                  CheckoutDeliveryCard(segmentedKey: _multiDropKey),
                  divider,
                  const CheckoutSpeedCard(),
                  divider,
                  CheckoutPaymentCard(tutorialKey: _paymentKey, sectionKey: _paymentSectionKey),
                  divider,
                  const CheckoutSummaryCard(),
                  const SizedBox(height: 8),
                ],
              ),
      ),
      bottomNavigationBar: isEmpty
          ? null
          : CheckoutFooter(
              onPlaceOrder: () => _placeOrder(context),
              placeOrderKey: _placeOrderKey,
            ),
    );
  }

  Future<void> _placeOrder(BuildContext context) async {
    final pipeline = ref.read(pipelineTutorialProvider);
    if (pipeline.active && pipeline.step == PipelineStep.placeOrderButton) {
      _advancedThisFrame = true;
      ref.read(pipelineTutorialProvider.notifier).advance();
    }

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
