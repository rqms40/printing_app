import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/beta/exceptions/beta_order_limit_exception.dart';
import 'package:printing_app/features/customer/beta/widgets/beta_order_limit_sheet.dart';
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
import 'package:printing_app/features/tutorial/providers/checkout_tutorial_session_provider.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _multiDropKey = GlobalKey();
  final _multiDropTabKey = GlobalKey();
  final _paymentMethodKey = GlobalKey();
  final _itemsKey = GlobalKey();
  final _placeOrderKey = GlobalKey();
  bool _advancedThisFrame = false;
  PipelineTutorialNotifier? _pipelineNotifier;
  PipelineState _pipelineState = const PipelineState();

  @override
  void initState() {
    super.initState();
    _pipelineNotifier = ref.read(pipelineTutorialProvider.notifier);
    ref.listenManual<PipelineState>(
      pipelineTutorialProvider,
      (_, next) => _pipelineState = next,
      fireImmediately: true,
    );
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _maybeShowCheckoutTutorial(),
    );
  }

  @override
  void dispose() {
    const pipelineSteps = {
      PipelineStep.checkoutItems,
      PipelineStep.checkoutDelivery,
      PipelineStep.checkoutPayment,
      PipelineStep.placeOrderButton,
    };
    if (_pipelineState.active &&
        pipelineSteps.contains(_pipelineState.step) &&
        !_advancedThisFrame) {
      _pipelineNotifier?.abandon();
    }
    super.dispose();
  }

  Future<void> _ensureVisible(GlobalKey key) async {
    final ctx = key.currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 250),
      alignment: 0.0, // align to top of viewport
    );
    // Let the scroll settle one more frame before measuring renderbox.
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }

  void _maybeShowCheckoutTutorial() async {
    if (!mounted) return;

    final pipeline = ref.read(pipelineTutorialProvider);
    if (pipeline.active && pipeline.step == PipelineStep.checkoutItems) {
      final addresses = ref.read(addressProvider);
      if (addresses.isEmpty) {
        _showAddAddressPrompt();
        return;
      }
      await _firePipelineItems();
      return;
    }

    // Post-pipeline standalone visit: checkoutFeatures (Step A — multidrop only).
    // Only fires when multidrop hasn't been seen in this session yet.
    // If multidropSeenInSession is already true, the payment sheet handles Step B.
    final multidropDone = ref.read(checkoutMultidropSeenInSessionProvider);
    if (ref.read(tutorialSeenProvider(TutorialKey.pipeline)) &&
        !ref.read(tutorialSeenProvider(TutorialKey.checkoutFeatures)) &&
        !multidropDone) {
      await _startCheckoutFeaturesCoachMarks();
    }
  }

  void _showAddAddressPrompt() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        final media = MediaQuery.of(sheetCtx);
        final extraBottom = media.viewInsets.bottom > 0
            ? media.viewInsets.bottom
            : media.viewPadding.bottom;
        return Padding(
          padding: EdgeInsets.only(bottom: extraBottom),
          child: FeatureOverlayCard(
            heroIcon: HugeIcons.strokeRoundedLocation01,
            title: 'Add a delivery address',
            body:
                "Save your address once and you'll never have to type it again — let's add your first one before we continue.",
            iconTiles: const [],
            ctaLabel: 'Add address →',
            showSkip: true,
            onCta: () async {
              Navigator.of(sheetCtx).pop();
              await context.push('/customer/addresses/new');
              // After they return, retry the entry. Pipeline state still in
              // checkoutItems, so this re-enters the address-check; if they
              // added one, it'll fall through to _firePipelineItems.
              if (mounted) _maybeShowCheckoutTutorial();
            },
            onSkip: () {
              Navigator.of(sheetCtx).pop();
              ref.read(pipelineTutorialProvider.notifier).abandon();
            },
          ),
        );
      },
    );
  }

  Future<void> _firePipelineItems() async {
    if (!mounted) return;
    await _ensureVisible(_itemsKey);
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _itemsKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Items',
          body: "Quick review of what you're printing.",
          align: ContentAlign.bottom,
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

  Future<void> _firePipelineDelivery() async {
    if (!mounted) return;
    await _ensureVisible(_multiDropKey);
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _multiDropKey,
          icon: HugeIcons.strokeRoundedLocation01,
          title: 'Pick a delivery option',
          body:
              "Choose Delivery, Pickup, or Multi-drop. Tap 'Got it' to continue.",
          // After ensureVisible scrolls the segmented to the top of the
          // viewport, the bubble sits cleanly below it.
          align: ContentAlign.bottom,
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

  Future<void> _firePipelinePayment() async {
    if (!mounted) return;
    await _ensureVisible(_paymentMethodKey);
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _paymentMethodKey,
          icon: HugeIcons.strokeRoundedWallet01,
          title: 'Payment method',
          body:
              'Review the available payment option and your GRIDGO Credits balance.',
          align: ContentAlign.bottom,
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

  Future<void> _firePipelinePlaceOrder() async {
    if (!mounted) return;
    await _ensureVisible(_placeOrderKey);
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _placeOrderKey,
          icon: HugeIcons.strokeRoundedCheckmarkCircle02,
          title: 'Place Order',
          body:
              "That's the Place Order button — tap it whenever you're ready to send your order.",
          align: ContentAlign.top,
          advanceOnSpotlightTap: false,
        ),
      ],
      () {
        ref.read(pipelineTutorialProvider.notifier).advance();
      },
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  Future<void> _startCheckoutFeaturesCoachMarks() async {
    if (!mounted) return;
    await _ensureVisible(_multiDropTabKey);
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _multiDropTabKey,
          icon: HugeIcons.strokeRoundedRoute01,
          title: 'Multi-drop Delivery',
          body:
              'Tap Multi-drop to send prints to different addresses in one order — one rider handles all the stops.',
          align: ContentAlign.bottom,
          advanceOnSpotlightTap: false,
          // Tighten the spotlight: the GestureDetector spans a full
          // one-third of the segmented row. paddingFocus: 4 keeps the
          // oval close to the tab pill rather than the default 8 px halo.
          paddingFocus: 4,
        ),
      ],
      () {
        // Mark Step A done for this session so the sheet knows to fire Step B.
        ref.read(checkoutMultidropSeenInSessionProvider.notifier).state = true;
        // Hint the user to open the payment sheet for the next coach mark.
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text(
                "One more thing — tap 'Choose payment method' to see GRIDGO Credits.",
              ),
              duration: Duration(seconds: 4),
            ),
          );
        }
        // Do NOT mark checkoutFeatures seen here — Step B (in the sheet) does that.
      },
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
    final divider = Container(height: 8, color: colors.background);

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
          child: Container(
            height: 1,
            color: colors.outline.withValues(alpha: 0.2),
          ),
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
                  CheckoutDeliveryCard(
                    segmentedKey: _multiDropKey,
                    multiDropTabKey: _multiDropTabKey,
                  ),
                  divider,
                  const CheckoutSpeedCard(),
                  divider,
                  CheckoutPaymentCard(methodPickerKey: _paymentMethodKey),
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
      final firstNumericId = placed.isEmpty
          ? null
          : int.tryParse(placed.first.id);
      context.go(
        '/customer/order/success',
        extra: {'orderRefs': refs, 'firstOrderId': firstNumericId},
      );
    } on BetaOrderLimitException {
      if (!context.mounted) return;
      await BetaOrderLimitSheet.show(context);
    } on DioException catch (e) {
      if (!context.mounted) return;
      final data = e.response?.data;
      String msg = 'Could not place order. Please try again.';
      if (data is Map && data['code'] == 'beta_credits_only') {
        msg =
            'Beta checkout uses Pilot Credits only. '
            'Switch your payment method to Pilot Credits.';
      } else if (data is Map && data['message'] is String) {
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
