import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart'
    show ordersProvider;
import 'package:printing_app/features/customer/home/widgets/daily_grid_section.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/features/customer/home/widgets/recent_orders_section.dart';
import 'package:printing_app/features/customer/notifications/providers/notifications_provider.dart';
import 'package:printing_app/shared/services/draft_storage_service.dart';

/// Customer home screen — editorial redesign.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  bool _draftDismissed = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    precacheImage(
      const AssetImage('assets/animations/bentobox.webp'),
      context,
    );
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
      'SUNDAY'
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
      'DECEMBER'
    ];
    return '${days[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final authState = ref.watch(authProvider);
    final firstName = (authState.user?.fullName ?? 'there').split(' ').first;
    final hasDraft = !_draftDismissed && DraftStorageService.hasDraft;

    final unreadCount = ref.watch(unreadNotificationsCountProvider);

    final creditsStr = authState.user?.credits ?? '0.00';
    final credits = double.tryParse(creditsStr)?.toInt() ?? 0;

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: RefreshIndicator(
          color: colors.brand,
          backgroundColor: colors.surface,
          onRefresh: ref.read(ordersProvider.notifier).refreshOrders,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            clipBehavior: Clip.none, // allows Daily Grid carousel to bleed to screen edge
            padding:
                const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SizedBox(height: AppSpacing.lg),

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

                    // Notification bell
                    _NotificationWidget(
                      colors: colors,
                      unreadCount: unreadCount,
                    ),

                    const SizedBox(width: AppSpacing.xs),

                    // Credits chip
                    _CreditsWidget(colors: colors, credits: credits),
                  ],
                )
                    .animate()
                    .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                    .slideY(
                      begin: 0.03,
                      duration: 400.ms,
                      curve: Curves.easeOut,
                    ),

                const SizedBox(height: AppSpacing.lg),

                // ── Draft banner ───────────────────────────────────────
                if (hasDraft) ...[
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: AppRadius.borderMd,
                      border: Border.all(color: colors.brand),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.edit_note_rounded,
                            color: colors.brand),
                        const SizedBox(width: AppSpacing.sm),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('Continue your order',
                                  style: AppTypography.bodyBold),
                              Text('You have an unfinished order',
                                  style: AppTypography.caption),
                            ],
                          ),
                        ),
                        TextButton(
                          onPressed: () =>
                              context.push('/customer/order/new'),
                          child: Text(
                            'Resume',
                            style: TextStyle(color: colors.brand),
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close, size: 18),
                          onPressed: () {
                            DraftStorageService.clearDraft();
                            setState(() => _draftDismissed = true);
                          },
                        ),
                      ],
                    ),
                  )
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

                const SizedBox(height: AppSpacing.sm + 2),

                // ── Two-column: map + right tiles ─────────────────────
                SizedBox(
                  height: 250,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Left: map tile (50%)
                      const Expanded(
                        child: MapTrackingTile(),
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      // Right: 3 stacked tiles (50%)
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // 1: Start Printing (flex 2)
                            Expanded(
                              flex: 2,
                              child: _StartPrintingTile(
                                colors: colors,
                                onTap: () => context
                                    .push('/customer/order/new'),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.xs + 2),
                            // 2: The Data Grid (flex 2)
                            Expanded(
                              flex: 2,
                              child: _DataGridTile(colors: colors),
                            ),
                            const SizedBox(height: AppSpacing.xs + 2),
                            // 3: Ad — taller (flex 3)
                            Expanded(
                              flex: 3,
                              child: _AdTile(colors: colors),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(
                      duration: 400.ms,
                      delay: 100.ms,
                      curve: Curves.easeOut,
                    ),

                const SizedBox(height: AppSpacing.lg),

                // ── Daily Grid ─────────────────────────────────────────
                const DailyGridSection()
                    .animate()
                    .fadeIn(
                      duration: 400.ms,
                      delay: 200.ms,
                      curve: Curves.easeOut,
                    ),

                const SizedBox(height: AppSpacing.lg),

                // ── Recent Orders ──────────────────────────────────────
                const RecentOrdersSection()
                    .animate()
                    .fadeIn(
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
    );
  }
}

class _HeaderIconButton extends StatelessWidget {
  const _HeaderIconButton({
    required this.onTap,
    required this.colors,
    required this.child,
  });

  final VoidCallback onTap;
  final AppColorSet colors;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 38,
        height: 38,
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: AppRadius.borderMd,
        ),
        child: Center(child: child),
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

  static const Color _kBrand = Color(0xFFFFDE58);

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
                ? _kBrand.withValues(alpha: 0.14)
                : widget.colors.surfaceVariant,
            borderRadius: AppRadius.borderMd,
            border: Border.all(
              color: _isOpen
                  ? _kBrand.withValues(alpha: 0.55)
                  : widget.colors.outline.withValues(alpha: 0.3),
              width: 0.75,
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.monetization_on_rounded,
                size: 15,
                color: _kBrand,
              ),
              const SizedBox(width: 5),
              Text(
                _formatCredits(widget.credits),
                style: AppTypography.bodyBold.copyWith(
                  color: _kBrand,
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

  static const Color _kBrand = Color(0xFFFFDE58);

  @override
  Widget build(BuildContext context) {
    final pesoEquiv = _formatCredits(credits);

    return Container(
      width: 210,
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(
          color: _kBrand.withValues(alpha: 0.18),
          width: 0.75,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.45),
            blurRadius: 24,
            offset: const Offset(0, 10),
          ),
          BoxShadow(
            color: _kBrand.withValues(alpha: 0.06),
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
                  color: _kBrand.withValues(alpha: 0.12),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: _kBrand.withValues(alpha: 0.25),
                    width: 0.75,
                  ),
                ),
                child: const Center(
                  child: Icon(
                    Icons.monetization_on_rounded,
                    size: 15,
                    color: _kBrand,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                'GRID CREDITS',
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
              color: _kBrand,
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
                    color: _kBrand,
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: const Center(
                    child: Icon(Icons.add_rounded, size: 18, color: Colors.black),
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

String _relativeTime(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inSeconds < 60) return 'just now';
  if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
  if (diff.inHours < 24) return '${diff.inHours}h ago';
  if (diff.inDays < 7) return '${diff.inDays}d ago';
  return '${dt.day}/${dt.month}';
}

class _NotificationWidget extends ConsumerStatefulWidget {
  const _NotificationWidget({
    required this.colors,
    required this.unreadCount,
  });

  final AppColorSet colors;
  final int unreadCount;

  @override
  ConsumerState<_NotificationWidget> createState() =>
      _NotificationWidgetState();
}

class _NotificationWidgetState extends ConsumerState<_NotificationWidget>
    with SingleTickerProviderStateMixin {
  final LayerLink _layerLink = LayerLink();
  OverlayEntry? _overlay;
  late final AnimationController _animCtrl;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _fadeAnim;
  bool _isOpen = false;

  /// IDs hidden from the home dropdown without touching the global state.
  /// The notifications screen always shows the full list from the provider.
  final Set<String> _locallyDismissed = {};

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 230),
    );
    _scaleAnim =
        CurvedAnimation(parent: _animCtrl, curve: Curves.easeOutBack);
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

  OverlayEntry _buildOverlay(BuildContext stateCtx) {
    return OverlayEntry(
      builder: (_) => GestureDetector(
        behavior: HitTestBehavior.translucent,
        onTap: _close,
        child: Stack(
          children: [
            const Positioned.fill(
                child: ColoredBox(color: Colors.transparent)),
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
                      child: _NotificationDropdown(
                        colors: widget.colors,
                        dismissedIds: _locallyDismissed,
                        onClose: _close,
                        onViewAll: () {
                          _close();
                          Future.delayed(
                              const Duration(milliseconds: 180), () {
                            if (stateCtx.mounted) {
                              stateCtx.push('/customer/notifications');
                            }
                          });
                        },
                        onTapNotification: (id) {
                          ref
                              .read(notificationsProvider.notifier)
                              .markAsRead(id);
                          _close();
                          Future.delayed(
                              const Duration(milliseconds: 180), () {
                            if (stateCtx.mounted) {
                              stateCtx.push('/customer/notifications');
                            }
                          });
                        },
                        onMarkAllRead: () {
                          ref
                              .read(notificationsProvider.notifier)
                              .markAllAsRead();
                          _overlay?.markNeedsBuild();
                        },
                        onClear: () {
                          // Dismiss from home view only — notifications screen
                          // keeps the full history.
                          final ids = ref
                              .read(notificationsProvider)
                              .map((n) => n.id)
                              .toSet();
                          setState(() => _locallyDismissed.addAll(ids));
                          _close();
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
    final colors = widget.colors;
    final unreadCount = widget.unreadCount;

    return CompositedTransformTarget(
      link: _layerLink,
      child: _HeaderIconButton(
        onTap: _toggle,
        colors: colors,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            HugeIcon(
              icon: HugeIcons.strokeRoundedNotification02,
              size: 22,
              color: colors.onBackground,
            ),
            if (unreadCount > 0)
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
                      unreadCount > 9 ? '9+' : '$unreadCount',
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
      ),
    );
  }
}

class _NotificationDropdown extends ConsumerWidget {
  const _NotificationDropdown({
    required this.colors,
    required this.onClose,
    required this.onViewAll,
    required this.onTapNotification,
    required this.onMarkAllRead,
    required this.onClear,
    required this.dismissedIds,
  });

  final AppColorSet colors;
  final VoidCallback onClose;
  final VoidCallback onViewAll;
  final void Function(String id) onTapNotification;
  final VoidCallback onMarkAllRead;
  final VoidCallback onClear;
  /// IDs locally dismissed from the home dropdown — not cleared from DB.
  final Set<String> dismissedIds;

  Color _dotColor(String type, AppColorSet colors) {
    final t = type.toLowerCase();
    if (t.contains('order')) return colors.brand;
    if (t.contains('credit') || t.contains('top')) return Colors.green;
    return colors.onSurfaceDim;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(notificationsProvider);
    // Filter out locally-dismissed items (home-only, not deleted from DB)
    final visible = notifications
        .where((n) => !dismissedIds.contains(n.id))
        .toList();
    final recent = visible.take(5).toList();
    final unreadCount = visible.where((n) => !n.isRead).length;

    return Container(
      width: 320,
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
                AppSpacing.md, AppSpacing.md, AppSpacing.sm, AppSpacing.xs),
            child: Row(
              children: [
                Text(
                  'Notifications',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 13,
                  ),
                ),
                const Spacer(),
                if (visible.isNotEmpty)
                  GestureDetector(
                    onTap: onClear,
                    child: Text(
                      'Clear',
                      style: AppTypography.caption.copyWith(
                        color: Colors.redAccent,
                        fontSize: 11,
                      ),
                    ),
                  ),
                if (unreadCount > 0) ...[
                  const SizedBox(width: AppSpacing.sm),
                  GestureDetector(
                    onTap: onMarkAllRead,
                    child: Text(
                      'Mark all read',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontSize: 11,
                      ),
                    ),
                  ),
                ],
                const SizedBox(width: AppSpacing.xs),
              ],
            ),
          ),

          Divider(
            height: 1,
            thickness: 0.5,
            color: colors.outline.withValues(alpha: 0.25),
          ),

          // ── Notification rows ────────────────────────────────────────
          if (recent.isEmpty)
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Center(
                child: Text(
                  'No notifications',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
              ),
            )
          else
            Flexible(
              child: ListView.builder(
                padding: EdgeInsets.zero,
                shrinkWrap: true,
                itemCount: recent.length,
                itemBuilder: (context, index) {
                  final n = recent[index];
                  return GestureDetector(
                    onTap: () => onTapNotification(n.id),
                    child: Container(
                      color: n.isRead
                          ? Colors.transparent
                          : colors.brand.withValues(alpha: 0.06),
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md,
                        vertical: AppSpacing.sm,
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(top: 5),
                            child: Container(
                              width: 7,
                              height: 7,
                              decoration: BoxDecoration(
                                color: _dotColor(n.type, colors),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  n.title,
                                  style: AppTypography.bodyBold.copyWith(
                                    color: colors.onBackground,
                                    fontSize: 12,
                                    height: 1.2,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  n.message,
                                  style: AppTypography.caption.copyWith(
                                    color: colors.onSurfaceDim,
                                    fontSize: 11,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Text(
                            _relativeTime(n.createdAt),
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                              fontSize: 10,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),

          Divider(
            height: 1,
            thickness: 0.5,
            color: colors.outline.withValues(alpha: 0.25),
          ),

          // ── Footer ───────────────────────────────────────────────────
          GestureDetector(
            onTap: onViewAll,
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    'View all',
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
          ),
        ],
      ),
    );
  }
}

// ── Shared yellow-border tile shell ─────────────────────────────────────────
/// Icon panel on the LEFT (big, yellow-tinted bg), text + chevron on the RIGHT.
class _YellowBorderTile extends StatefulWidget {
  const _YellowBorderTile({
    required this.colors,
    required this.icon,
    required this.title,
    this.subtitle,
    this.onTap,
  });

  final AppColorSet colors;
  final dynamic icon;
  final String title;
  final String? subtitle;
  final VoidCallback? onTap;

  @override
  State<_YellowBorderTile> createState() => _YellowBorderTileState();
}

class _YellowBorderTileState extends State<_YellowBorderTile> {
  bool _pressed = false;

  static const _kBrand = Color(0xFFFFDE58);

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
          width: double.infinity,
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderXl,
            border: Border.all(
              color: widget.colors.outline.withValues(alpha: 0.4),
              width: 0.5,
            ),
          ),
          child: ClipRRect(
            borderRadius: AppRadius.borderXl,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Left icon panel — no bg tint, no divider ─────────
                SizedBox(
                  width: 52,
                  child: Center(
                    child: HugeIcon(
                      icon: widget.icon,
                      size: 26,
                      color: _kBrand,
                    ),
                  ),
                ),

                // ── Right text area ──────────────────────────────────
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: AppSpacing.xs,
                    ),
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
                ),

                // Chevron
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: Icon(
                    Icons.chevron_right_rounded,
                    size: 14,
                    color: widget.colors.disabled,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Convenience wrappers ─────────────────────────────────────────────────────

class _StartPrintingTile extends StatelessWidget {
  const _StartPrintingTile({required this.colors, required this.onTap});
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _YellowBorderTile(
        colors: colors,
        icon: HugeIcons.strokeRoundedPrinter,
        title: 'Start Printing',
        subtitle: 'New order',
        onTap: onTap,
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
      );
}

// ── Right-column tile: Advertisement (photo background) ─────────────────────
class _AdTile extends StatelessWidget {
  const _AdTile({required this.colors});
  final AppColorSet colors;

  // Dark-toned industrial/print photo — consistent via seed
  static const _imgUrl =
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64'
      '?w=400&q=70&fit=crop&auto=format';

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Stack(
        fit: StackFit.expand,
        children: [
          // Photo base — forced dark with blend
          CachedNetworkImage(
            imageUrl: _imgUrl,
            fit: BoxFit.cover,
            color: Colors.black.withValues(alpha: 0.48),
            colorBlendMode: BlendMode.darken,
            placeholder: (_, _) => Container(color: colors.surfaceVariant),
            errorWidget: (_, _, _) =>
                Container(color: colors.surfaceVariant),
          ),

          // Bottom-up gradient scrim so text stays legible
          Positioned.fill(
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.55, 1.0],
                  colors: [
                    Colors.black.withValues(alpha: 0.0),
                    Colors.black.withValues(alpha: 0.35),
                    Colors.black.withValues(alpha: 0.80),
                  ],
                ),
              ),
            ),
          ),

          // Ad copy — anchored to bottom-left
          Positioned(
            left: AppSpacing.sm,
            right: AppSpacing.sm,
            bottom: AppSpacing.sm,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFDE58),
                    borderRadius: AppRadius.borderFull,
                  ),
                  child: Text(
                    '20% OFF',
                    style: AppTypography.overline.copyWith(
                      color: Colors.black,
                      fontSize: 7,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Large Prints',
                  style: AppTypography.bodyBold.copyWith(
                    color: Colors.white,
                    fontSize: 13,
                    height: 1.1,
                  ),
                ),
                Text(
                  'This weekend only',
                  style: AppTypography.caption.copyWith(
                    color: Colors.white.withValues(alpha: 0.65),
                    fontSize: 9,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
