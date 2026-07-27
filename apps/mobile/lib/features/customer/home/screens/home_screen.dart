import 'package:flutter/material.dart';
import 'dart:async';
import 'dart:math' as math;
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart'
    show
        activeOrdersProvider,
        ordersInitialLoadAuthoritativeProvider,
        ordersInitialLoadCompleteProvider,
        ordersProvider;
import 'package:printing_app/features/customer/home/widgets/home_feed_tile.dart';
import 'package:printing_app/features/customer/home/widgets/daily_grid_section.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/features/customer/home/widgets/recent_orders_section.dart';
import 'package:printing_app/utils/formatters.dart';
import 'package:printing_app/features/customer/chat/providers/chat_provider.dart';
import 'package:printing_app/features/customer/chat/widgets/floating_chat_button.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/feature_overlay_card.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/shared/models/enums.dart';

const _activeDeliveryTutorialBlockingStatuses = {
  OrderStatus.riderAssigned,
  OrderStatus.pickedUp,
  OrderStatus.onTheWay,
  OrderStatus.arrivedAtDestination,
};

bool shouldDeferHomeTutorial({
  required bool ordersLoaded,
  required Iterable<OrderStatus> activeOrderStatuses,
}) {
  return !ordersLoaded ||
      activeOrderStatuses.any(_activeDeliveryTutorialBlockingStatuses.contains);
}

bool shouldShowFirstOrderTutorial({
  required bool ordersLoaded,
  required bool orderHistoryAuthoritative,
  required bool hasOrderHistory,
  required bool pipelineSeen,
  required Iterable<OrderStatus> activeOrderStatuses,
}) {
  return !pipelineSeen &&
      orderHistoryAuthoritative &&
      !hasOrderHistory &&
      !shouldDeferHomeTutorial(
        ordersLoaded: ordersLoaded,
        activeOrderStatuses: activeOrderStatuses,
      );
}

final homeTutorialReadyProvider = Provider<bool>((ref) {
  final ordersLoaded = ref.watch(ordersInitialLoadCompleteProvider);
  final orderHistoryAuthoritative = ref.watch(
    ordersInitialLoadAuthoritativeProvider,
  );
  final activeStatuses = ref
      .watch(activeOrdersProvider)
      .map((order) => order.orderStatus);
  return orderHistoryAuthoritative &&
      !shouldDeferHomeTutorial(
        ordersLoaded: ordersLoaded,
        activeOrderStatuses: activeStatuses,
      );
});

/// Customer home screen — editorial redesign.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  final _creditsTutorialKey = GlobalKey();
  final _chatFabTutorialKey = GlobalKey();
  final _startPrintingTutorialKey = GlobalKey();
  bool _homeTutorialAttempted = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(const AssetImage('assets/animations/bentobox.webp'), context);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final now = DateTime.now();
      final today =
          '${now.year.toString().padLeft(4, '0')}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
      final tomorrow = now.add(const Duration(days: 1));
      final tomStr =
          '${tomorrow.year.toString().padLeft(4, '0')}-${tomorrow.month.toString().padLeft(2, '0')}-${tomorrow.day.toString().padLeft(2, '0')}';
      ref.read(deliverySlotProvider(today).notifier).refresh();
      ref.read(deliverySlotProvider(tomStr).notifier).refresh();
    });
    ref.listenManual<bool>(homeTutorialReadyProvider, (_, ready) {
      if (!ready || !mounted) return;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _maybeShowHomeTutorial();
      });
    }, fireImmediately: true);
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning,';
    if (hour < 17) return 'Good afternoon,';
    return 'Good evening,';
  }

  String _formattedDate() {
    final now = DateTime.now();
    const days = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ];
    const months = [
      'JANUARY',
      'FEBRUARY',
      'MARCH',
      'APRIL',
      'MAY',
      'JUNE',
      'JULY',
      'AUGUST',
      'SEPTEMBER',
      'OCTOBER',
      'NOVEMBER',
      'DECEMBER',
    ];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  void _maybeShowHomeTutorial() {
    if (!mounted ||
        _homeTutorialAttempted ||
        !ref.read(homeTutorialReadyProvider)) {
      return;
    }

    final activeOrderStatuses = ref
        .read(activeOrdersProvider)
        .map((order) => order.orderStatus);
    final showFirstOrderTutorial = shouldShowFirstOrderTutorial(
      ordersLoaded: ref.read(ordersInitialLoadCompleteProvider),
      orderHistoryAuthoritative: ref.read(
        ordersInitialLoadAuthoritativeProvider,
      ),
      hasOrderHistory: ref.read(ordersProvider).isNotEmpty,
      pipelineSeen: ref.read(tutorialSeenProvider(TutorialKey.pipeline)),
      activeOrderStatuses: activeOrderStatuses,
    );

    // First-time pipeline: show welcome card → user taps "Show me how →" to start
    if (showFirstOrderTutorial) {
      _homeTutorialAttempted = true;
      _showPipelineWelcomeCard();
      return;
    }

    // Post-pipeline: home features (Credits + GridBot)
    if (!ref.read(tutorialSeenProvider(TutorialKey.homeFeatures))) {
      _homeTutorialAttempted = true;
      _startHomeFeaturesCoachMarks();
      return;
    }
  }

  void _showPipelineWelcomeCard() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (sheetCtx) {
        final media = MediaQuery.of(sheetCtx);
        // viewInsets covers keyboard; viewPadding covers system gestures/nav bar.
        final extraBottom = media.viewInsets.bottom > 0
            ? media.viewInsets.bottom
            : media.viewPadding.bottom;
        return Padding(
          padding: EdgeInsets.only(bottom: extraBottom),
          child: FeatureOverlayCard(
            heroIcon: HugeIcons.strokeRoundedPrinter,
            title: "Let's print something.",
            body: "We'll walk you through your first order.",
            iconTiles: const [],
            ctaLabel: 'Show me how →',
            showSkip: false,
            onCta: () {
              Navigator.of(sheetCtx).pop();
              ref.read(pipelineTutorialProvider.notifier).start();
              _showPipelineStartCoachMark();
            },
            onSkip: () {},
          ),
        );
      },
    );
  }

  void _showPipelineStartCoachMark() {
    if (!mounted) return;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _startPrintingTutorialKey,
          icon: HugeIcons.strokeRoundedPrinter,
          title: 'Start Printing',
          body: 'Tap here to start your first print order.',
          shape: ShapeLightFocus.RRect,
          advanceOnSpotlightTap: true,
          onSpotlightTap: () {
            ref.read(pipelineTutorialProvider.notifier).advance();
            if (mounted) context.push('/customer/order/new');
          },
        ),
      ],
      () {},
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  void _startHomeFeaturesCoachMarks() {
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _creditsTutorialKey,
          icon: HugeIcons.strokeRoundedCoins01,
          title: 'GRIDGO Credits',
          body:
              'Top up GRIDGO Credits and pay at checkout — no GCash OTP, no app-switching.',
          advanceOnSpotlightTap: false,
        ),
        TutorialStep(
          targetKey: _chatFabTutorialKey,
          icon: HugeIcons.strokeRoundedMessage01,
          title: 'Meet GridBot',
          body:
              'Need help? GridBot answers anything — order specs, pricing, delivery status. 24/7.',
          shape: ShapeLightFocus.Circle,
          advanceOnSpotlightTap: false,
        ),
      ],
      () => ref
          .read(tutorialProvider.notifier)
          .markSeen(TutorialKey.homeFeatures),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final authState = ref.watch(authProvider);
    final firstName = (authState.user?.fullName ?? 'there').split(' ').first;
    final cart = ref.watch(checkoutProvider);

    final credits = (double.tryParse(authState.user?.credits ?? '0') ?? 0.0)
        .toInt();

    // NextBatchDialog is now triggered at the customer-shell level via
    // NextBatchSessionTrigger so it fires reliably on first login regardless
    // of which tab the user lands on.

    return Stack(
      children: [
        ColoredBox(
          color: colors.background,
          child: SafeArea(
            child: RefreshIndicator(
              color: colors.brand,
              backgroundColor: colors.surface,
              onRefresh: ref.read(ordersProvider.notifier).refreshOrders,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                clipBehavior: Clip
                    .none, // allows Daily Grid carousel to bleed to screen edge
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Semantics(
                  container: true,
                  focused: false,
                  label: 'Customer home content',
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SizedBox(height: 28),

                      // ── Header ─────────────────────────────────────────────
                      Row(
                            crossAxisAlignment: CrossAxisAlignment.center,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _formattedDate(),
                                      style: AppTypography.overline.copyWith(
                                        color: colors.onSurfaceDim,
                                        fontSize: 10,
                                        letterSpacing: 1.5,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    RichText(
                                      text: TextSpan(
                                        style: AppTypography.h2.copyWith(
                                          color: colors.onBackground,
                                        ),
                                        children: [
                                          TextSpan(text: '${_greeting()} '),
                                          TextSpan(
                                            text: firstName,
                                            style: AppTypography.h2.copyWith(
                                              color: colors.brand,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Cart
                              _CartWidget(
                                colors: colors,
                                itemCount: cart.items.length,
                              ),

                              const SizedBox(width: AppSpacing.xs),

                              // Credits chip
                              KeyedSubtree(
                                key: _creditsTutorialKey,
                                child: _CreditsWidget(
                                  colors: colors,
                                  credits: credits,
                                ),
                              ),
                            ],
                          )
                          .animate()
                          .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                          .slideY(
                            begin: 0.03,
                            duration: 400.ms,
                            curve: Curves.easeOut,
                          ),

                      const SizedBox(height: 28),

                      if (cart.items.isNotEmpty) ...[
                        _ResumeQueueCard(colors: colors, cart: cart)
                            .animate()
                            .fadeIn(duration: 300.ms, curve: Curves.easeOut)
                            .slideY(
                              begin: 0.02,
                              duration: 300.ms,
                              curve: Curves.easeOut,
                            ),
                        const SizedBox(height: AppSpacing.md),
                      ],

                      // ── Hero banner ────────────────────────────────────────
                      const HeroBanner(),

                      const SizedBox(height: AppSpacing.md),

                      // ── Two-column: map + right tiles ─────────────────────
                      SizedBox(
                        height: 324,
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Left: map tile (50%)
                            const Expanded(child: MapTrackingTile()),
                            const SizedBox(width: AppSpacing.sm),
                            // Right: 3 stacked tiles (50%)
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  // 1: Start Printing (flex 5)
                                  Expanded(
                                    flex: 5,
                                    child: _StartPrintingTile(
                                      colors: colors,
                                      tutorialKey: _startPrintingTutorialKey,
                                      onTap: () =>
                                          context.push('/customer/order/new'),
                                    ),
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  // 2: The Data Grid (flex 5)
                                  Expanded(
                                    flex: 5,
                                    child: _DataGridTile(colors: colors),
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  // 3: The Feed (flex 9)
                                  Expanded(
                                    flex: 9,
                                    child: HomeFeedTile(colors: colors),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ).animate().fadeIn(
                        duration: 400.ms,
                        delay: 100.ms,
                        curve: Curves.easeOut,
                      ),

                      const SizedBox(height: 28),

                      // ── Daily Grid ─────────────────────────────────────────
                      const DailyGridSection().animate().fadeIn(
                        duration: 400.ms,
                        delay: 200.ms,
                        curve: Curves.easeOut,
                      ),

                      const SizedBox(height: 28),

                      // ── Recent Orders ──────────────────────────────────────
                      const RecentOrdersSection().animate().fadeIn(
                        duration: 400.ms,
                        delay: 300.ms,
                        curve: Curves.easeOut,
                      ),

                      const SizedBox(height: AppSpacing.xxl),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        Positioned(
          right: AppSpacing.xl,
          // The shell reports the nav bar's true height (66 + device inset)
          // via MediaQuery padding — anchor above it instead of hard-coding.
          bottom: MediaQuery.of(context).padding.bottom + AppSpacing.md,
          child: Consumer(
            builder: (_, ref, _) {
              final unread =
                  ref.watch(chatUnreadCountProvider).asData?.value ?? 0;
              return FloatingChatButton(
                unreadCount: unread,
                tutorialKey: _chatFabTutorialKey,
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ResumeQueueCard extends StatelessWidget {
  const _ResumeQueueCard({required this.colors, required this.cart});

  final AppColorSet colors;
  final CheckoutState cart;

  @override
  Widget build(BuildContext context) {
    final count = cart.itemCount;
    final printJobLabel = count == 1 ? 'print job' : 'print jobs';
    final formattedSubtotal = formatCurrency(cart.subtotal);
    final semanticsLabel =
        'Resume your queue, $count $printJobLabel, $formattedSubtotal subtotal';

    void openQueue() => context.push('/customer/order/checkout');

    return Semantics(
      button: true,
      label: semanticsLabel,
      onTap: openQueue,
      child: ExcludeSemantics(
        child: Material(
          color: colors.surface,
          borderRadius: AppRadius.borderLg,
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: openQueue,
            borderRadius: AppRadius.borderLg,
            child: Container(
              decoration: BoxDecoration(
                borderRadius: AppRadius.borderLg,
                border: Border.all(color: colors.outline, width: 1),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
              child: Row(
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      color: colors.brand,
                      borderRadius: AppRadius.borderMd,
                    ),
                    alignment: Alignment.center,
                    child: const HugeIcon(
                      icon: HugeIcons.strokeRoundedShoppingBasket01,
                      size: 18,
                      color: Colors.black,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          'Resume your queue',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.onBackground,
                            fontSize: 13.5,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '$count $printJobLabel',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                            fontSize: 11.5,
                          ),
                        ),
                        Text(
                          '$formattedSubtotal subtotal',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                            fontSize: 11.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    'View queue',
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontWeight: FontWeight.w700,
                      fontSize: 11.5,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    super.key,
    required this.onTap,
    required this.colors,
    required this.child,
    required this.semanticLabel,
  });

  final VoidCallback onTap;
  final AppColorSet colors;
  final Widget child;

  /// Required: the child is icon-only, so without this the button reaches
  /// screen readers (and axe) as a control with no accessible name.
  final String semanticLabel;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: semanticLabel,
      container: true,
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: AppRadius.borderMd,
          ),
          child: Center(child: ExcludeSemantics(child: child)),
        ),
      ),
    );
  }
}

// ── Credits chip + dropdown ──────────────────────────────────────────────────

String _formatCredits(int c) {
  if (c >= 1000) {
    return '${c ~/ 1000},${(c % 1000).toString().padLeft(3, '0')}';
  }
  return '$c';
}

class _CreditsWidget extends StatefulWidget {
  const _CreditsWidget({required this.colors, required this.credits});
  final AppColorSet colors;
  final int credits;

  @override
  State<_CreditsWidget> createState() => _CreditsWidgetState();
}

class _CreditsWidgetState extends State<_CreditsWidget>
    with SingleTickerProviderStateMixin {
  final LayerLink _layerLink = LayerLink();
  OverlayEntry? _overlay;
  late final AnimationController _animCtrl;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _fadeAnim;
  bool _isOpen = false;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 230),
    );
    _scaleAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutBack);
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _overlay?.remove();
    _overlay = null;
    _animCtrl.dispose();
    super.dispose();
  }

  void _toggle() => _isOpen ? _close() : _open();

  void _open() {
    final stateCtx = context;
    final entry = _buildOverlay(stateCtx);
    Overlay.of(context).insert(entry);
    _overlay = entry;
    _animCtrl.forward(from: 0);
    setState(() => _isOpen = true);
  }

  void _close() {
    setState(() => _isOpen = false);
    _animCtrl.reverse().then((_) {
      if (!mounted) return;
      _overlay?.remove();
      _overlay = null;
    });
  }

  OverlayEntry _buildOverlay(BuildContext stateCtx) {
    return OverlayEntry(
      builder: (_) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: _close,
        child: Stack(
          children: [
            const Positioned.fill(child: ColoredBox(color: Colors.transparent)),
            CompositedTransformFollower(
              link: _layerLink,
              showWhenUnlinked: false,
              targetAnchor: Alignment.bottomRight,
              followerAnchor: Alignment.topRight,
              offset: const Offset(0, 8),
              child: Material(
                color: Colors.transparent,
                child: GestureDetector(
                  onTap: () {},
                  child: FadeTransition(
                    opacity: _fadeAnim,
                    child: ScaleTransition(
                      scale: _scaleAnim,
                      alignment: Alignment.topRight,
                      child: _CreditsDropdown(
                        colors: widget.colors,
                        credits: widget.credits,
                        onTopUp: () {
                          _close();
                          Future.delayed(const Duration(milliseconds: 180), () {
                            if (stateCtx.mounted) {
                              stateCtx.push('/customer/profile/top-up');
                            }
                          });
                        },
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

  @override
  Widget build(BuildContext context) {
    return CompositedTransformTarget(
      link: _layerLink,
      child: GestureDetector(
        onTap: _toggle,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          height: 38,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: _isOpen
                ? widget.colors.brand.withValues(alpha: 0.14)
                : widget.colors.surfaceVariant,
            borderRadius: AppRadius.borderMd,
            border: Border.all(
              color: _isOpen
                  ? widget.colors.brand.withValues(alpha: 0.55)
                  : widget.colors.outline.withValues(alpha: 0.3),
              width: 0.75,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.monetization_on_rounded,
                size: 15,
                color: widget.colors.brand,
              ),
              const SizedBox(width: 5),
              Text(
                _formatCredits(widget.credits),
                style: AppTypography.bodyBold.copyWith(
                  color: widget.colors.brand,
                  fontSize: 12,
                  height: 1.0,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CreditsDropdown extends StatelessWidget {
  const _CreditsDropdown({
    required this.colors,
    required this.credits,
    required this.onTopUp,
  });

  final AppColorSet colors;
  final int credits;
  final VoidCallback onTopUp;

  @override
  Widget build(BuildContext context) {
    final pesoEquiv = _formatCredits(credits);
    final brand = colors.brand;

    return Container(
      width: 210,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: brand.withValues(alpha: 0.18), width: 0.75),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: brand.withValues(alpha: 0.06),
            blurRadius: 32,
            spreadRadius: -4,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Header row ──────────────────────────────────────────────
          Row(
            children: [
              Container(
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: brand.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: brand.withValues(alpha: 0.25),
                    width: 0.75,
                  ),
                ),
                child: Center(
                  child: Icon(
                    Icons.monetization_on_rounded,
                    size: 15,
                    color: brand,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'GRIDGO CREDITS',
                style: AppTypography.overline.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 9,
                  letterSpacing: 1.8,
                ),
              ),
            ],
          ),

          const SizedBox(height: AppSpacing.sm),

          // ── Balance ──────────────────────────────────────────────────
          Text(
            _formatCredits(credits),
            style: AppTypography.display.copyWith(
              color: brand,
              fontSize: 36,
              height: 1.0,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            'G$pesoEquiv equivalent',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 10,
            ),
          ),

          const SizedBox(height: AppSpacing.sm),
          Divider(
            height: 1,
            thickness: 0.5,
            color: colors.outline.withValues(alpha: 0.25),
          ),
          const SizedBox(height: AppSpacing.sm),

          // ── Top Up row ───────────────────────────────────────────────
          GestureDetector(
            onTap: onTopUp,
            child: Row(
              children: [
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: brand,
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: const Center(
                    child: Icon(
                      Icons.add_rounded,
                      size: 18,
                      color: Colors.black,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Text(
                  'Top Up Credits',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 12,
                  ),
                ),
                const Spacer(),
                Icon(
                  Icons.chevron_right_rounded,
                  size: 16,
                  color: colors.disabled,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Notification bell + dropdown ────────────────────────────────────────────

class _CartWidget extends ConsumerStatefulWidget {
  const _CartWidget({required this.colors, required this.itemCount});

  final AppColorSet colors;
  final int itemCount;

  @override
  ConsumerState<_CartWidget> createState() => _CartWidgetState();
}

class _CartWidgetState extends ConsumerState<_CartWidget>
    with SingleTickerProviderStateMixin {
  final GlobalKey _anchorKey = GlobalKey();
  OverlayEntry? _overlay;
  late final AnimationController _animCtrl;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _fadeAnim;
  bool _isOpen = false;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 230),
    );
    _scaleAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutBack);
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
  }

  @override
  void dispose() {
    _overlay?.remove();
    _overlay = null;
    _animCtrl.dispose();
    super.dispose();
  }

  void _toggle() => _isOpen ? _close() : _open();

  void _open() {
    final entry = _buildOverlay(context);
    Overlay.of(context).insert(entry);
    _overlay = entry;
    _animCtrl.forward(from: 0);
    setState(() => _isOpen = true);
  }

  void _close() {
    setState(() => _isOpen = false);
    _animCtrl.reverse().then((_) {
      if (!mounted) return;
      _overlay?.remove();
      _overlay = null;
    });
  }

  /// Close the dropdown, then push [route] once the collapse animation ends.
  void _closeThen(BuildContext stateCtx, String route) {
    _close();
    Future.delayed(const Duration(milliseconds: 180), () {
      if (stateCtx.mounted) stateCtx.push(route);
    });
  }

  OverlayEntry _buildOverlay(BuildContext stateCtx) {
    return OverlayEntry(
      builder: (overlayCtx) {
        // Position the dropdown using the button's *actual* screen
        // coordinates, so it stays inside the viewport regardless of device
        // width or where the button sits in the layout.
        final media = MediaQuery.of(overlayCtx);
        final screenWidth = media.size.width;
        final viewPadding = media.viewPadding;

        const sideMargin = 12.0;
        final maxWidth = math.min(360.0, screenWidth - sideMargin * 2);

        final anchorCtx = _anchorKey.currentContext;
        final anchorBox = anchorCtx?.findRenderObject() as RenderBox?;
        double topPos;
        double rightInset;
        if (anchorBox != null && anchorBox.hasSize && anchorBox.attached) {
          final anchorPos = anchorBox.localToGlobal(Offset.zero);
          final anchorSize = anchorBox.size;
          topPos = anchorPos.dy + anchorSize.height + 8;
          final desiredRight = screenWidth - (anchorPos.dx + anchorSize.width);
          rightInset = desiredRight.clamp(
            sideMargin,
            screenWidth - maxWidth - sideMargin,
          );
        } else {
          topPos = viewPadding.top + 64;
          rightInset = sideMargin;
        }

        return GestureDetector(
          behavior: HitTestBehavior.translucent,
          onTap: _close,
          child: Stack(
            children: [
              const Positioned.fill(
                child: ColoredBox(color: Colors.transparent),
              ),
              Positioned(
                top: topPos,
                right: rightInset,
                width: maxWidth,
                child: Padding(
                  padding: EdgeInsets.only(bottom: viewPadding.bottom),
                  child: Material(
                    color: Colors.transparent,
                    child: GestureDetector(
                      onTap: () {},
                      child: FadeTransition(
                        opacity: _fadeAnim,
                        child: ScaleTransition(
                          scale: _scaleAnim,
                          alignment: Alignment.topRight,
                          child: _CartDropdown(
                            colors: widget.colors,
                            onCheckout: () => _closeThen(
                              stateCtx,
                              '/customer/order/checkout',
                            ),
                            onStartPrinting: () =>
                                _closeThen(stateCtx, '/customer/order/new'),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    final itemCount = widget.itemCount;

    return _HeaderIconButton(
      key: _anchorKey,
      onTap: _toggle,
      colors: colors,
      semanticLabel: itemCount > 0
          ? 'Cart, $itemCount ${itemCount == 1 ? 'item' : 'items'}'
          : 'Cart, empty',
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedShoppingBasket01,
            size: 22,
            color: colors.onBackground,
          ),
          if (itemCount > 0)
            Positioned(
              top: -3,
              right: -3,
              child: Container(
                width: 16,
                height: 16,
                decoration: BoxDecoration(
                  color: colors.brand,
                  shape: BoxShape.circle,
                ),
                child: Center(
                  child: Text(
                    itemCount > 9 ? '9+' : '$itemCount',
                    style: AppTypography.overline.copyWith(
                      color: colors.background,
                      fontSize: 8,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _CartDropdown extends ConsumerWidget {
  const _CartDropdown({
    required this.colors,
    required this.onCheckout,
    required this.onStartPrinting,
  });

  final AppColorSet colors;
  final VoidCallback onCheckout;
  final VoidCallback onStartPrinting;

  static const _maxInlineItems = 4;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cart = ref.watch(checkoutProvider);
    final items = cart.items;
    final visible = items.take(_maxInlineItems).toList();
    final overflowCount = items.length - visible.length;

    return Container(
      width: double.infinity,
      constraints: const BoxConstraints(maxHeight: 400),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: colors.outline.withValues(alpha: 0.18),
          width: 0.75,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ── Header ──────────────────────────────────────────────────
          Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.md,
              AppSpacing.xs,
            ),
            child: Row(
              children: [
                Text(
                  'Cart',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                if (items.isNotEmpty)
                  Text(
                    items.length == 1
                        ? '1 print job'
                        : '${items.length} print jobs',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                    ),
                  ),
              ],
            ),
          ),

          Divider(
            height: 1,
            thickness: 0.5,
            color: colors.outline.withValues(alpha: 0.25),
          ),

          // ── Empty state ──────────────────────────────────────────────
          if (items.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.lg,
                vertical: AppSpacing.lg,
              ),
              child: Column(
                children: [
                  HugeIcon(
                    icon: HugeIcons.strokeRoundedShoppingBasket01,
                    size: 26,
                    color: colors.onSurfaceDim,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Your cart is empty',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    'Files you add to an order wait here.',
                    textAlign: TextAlign.center,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  GestureDetector(
                    onTap: onStartPrinting,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Start printing',
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.brand,
                            fontSize: 12,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Icon(
                          Icons.arrow_forward_rounded,
                          size: 13,
                          color: colors.brand,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            )
          else ...[
            // ── Cart rows ──────────────────────────────────────────────
            Flexible(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                shrinkWrap: true,
                itemCount: visible.length,
                itemBuilder: (context, index) {
                  final item = visible[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.md,
                      vertical: 6,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: colors.surfaceVariant,
                            borderRadius: AppRadius.borderSm,
                          ),
                          child: Center(
                            child: HugeIcon(
                              icon: item.category == '3d'
                                  ? HugeIcons.strokeRoundedCube
                                  : HugeIcons.strokeRoundedFile02,
                              size: 16,
                              color: colors.brand,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.fileName,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                  fontSize: 12,
                                  height: 1.2,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${item.categoryName ?? item.category}'
                                ' · ×${item.quantity}',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                  fontSize: 10.5,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          formatCurrency(item.printSubtotal),
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurface,
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
            if (overflowCount > 0)
              Padding(
                padding: const EdgeInsets.only(
                  left: AppSpacing.md,
                  right: AppSpacing.md,
                  bottom: AppSpacing.xs,
                ),
                child: Text(
                  '+$overflowCount more in checkout',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 10.5,
                  ),
                ),
              ),

            Divider(
              height: 1,
              thickness: 0.5,
              color: colors.outline.withValues(alpha: 0.25),
            ),

            // ── Footer ─────────────────────────────────────────────────
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Text(
                        'Subtotal',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontSize: 11,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        formatCurrency(cart.subtotal),
                        style: AppTypography.bodyBold.copyWith(
                          color: colors.onBackground,
                          fontSize: 13,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  GestureDetector(
                    onTap: onCheckout,
                    child: Container(
                      height: 40,
                      decoration: BoxDecoration(
                        color: colors.brand,
                        borderRadius: AppRadius.borderMd,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        'Review & check out',
                        style: AppTypography.bodyBold.copyWith(
                          color: Colors.black,
                          fontSize: 12.5,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

// ── Shared yellow-border tile shell ─────────────────────────────────────────
/// Icon chip on the LEFT (solid brand square when emphasized, tinted
/// otherwise — same motif as the resume-queue card), text + chevron RIGHT.
class _YellowBorderTile extends StatefulWidget {
  const _YellowBorderTile({
    required this.colors,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
    this.tutorialKey,
    this.emphasized = false,
  });

  final AppColorSet colors;
  final dynamic icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;
  final GlobalKey? tutorialKey;

  /// Marks the primary action of the pair: solid brand chip + black icon.
  final bool emphasized;

  @override
  State<_YellowBorderTile> createState() => _YellowBorderTileState();
}

class _YellowBorderTileState extends State<_YellowBorderTile> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap?.call();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          key: widget.tutorialKey,
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderXl,
            border: Border.all(
              color: widget.colors.outline.withValues(alpha: 0.4),
              width: 0.5,
            ),
          ),
          child: Row(
            children: [
              // ── Icon chip ────────────────────────────────────────
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: widget.emphasized
                      ? widget.colors.brand
                      : widget.colors.brand.withValues(alpha: 0.10),
                  borderRadius: AppRadius.borderMd,
                  border: widget.emphasized
                      ? null
                      : Border.all(
                          color: widget.colors.brand.withValues(alpha: 0.25),
                          width: 0.75,
                        ),
                ),
                child: Center(
                  child: HugeIcon(
                    icon: widget.icon,
                    size: 20,
                    color: widget.emphasized
                        ? Colors.black
                        : widget.colors.brand,
                  ),
                ),
              ),

              const SizedBox(width: 10),

              // ── Text ─────────────────────────────────────────────
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      widget.title,
                      style: AppTypography.bodyBold.copyWith(
                        color: widget.colors.onBackground,
                        fontSize: 12,
                        height: 1.2,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (widget.subtitle != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        widget.subtitle!,
                        style: AppTypography.caption.copyWith(
                          color: widget.colors.onSurfaceDim,
                          fontSize: 10,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),

              Icon(
                Icons.chevron_right_rounded,
                size: 16,
                color: widget.colors.disabled,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

class _StartPrintingTile extends StatelessWidget {
  const _StartPrintingTile({
    required this.colors,
    required this.onTap,
    this.tutorialKey,
  });
  final AppColorSet colors;
  final VoidCallback onTap;
  final GlobalKey? tutorialKey;

  @override
  Widget build(BuildContext context) => _YellowBorderTile(
    colors: colors,
    icon: HugeIcons.strokeRoundedPrinter,
    title: 'Start Printing',
    subtitle: 'New order',
    onTap: onTap,
    tutorialKey: tutorialKey,
    emphasized: true,
  );
}

class _DataGridTile extends StatelessWidget {
  const _DataGridTile({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) => _YellowBorderTile(
    colors: colors,
    icon: HugeIcons.strokeRoundedCloudUpload,
    title: 'The Data Grid',
    subtitle: 'Your uploads',
    onTap: () => context.push('/customer/uploads'),
  );
}
