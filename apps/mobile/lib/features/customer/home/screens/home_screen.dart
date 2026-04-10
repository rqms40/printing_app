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
import 'package:printing_app/features/customer/home/widgets/daily_grid_section.dart';
import 'package:printing_app/features/customer/home/widgets/hero_banner.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/features/customer/home/widgets/recent_orders_section.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
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

    final unreadCount = MockData.notifications
        .where((n) =>
            n.userId == (authState.user?.id ?? 'usr_001') && !n.isRead)
        .length;

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: RefreshIndicator(
          color: colors.brand,
          backgroundColor: colors.surface,
          onRefresh: () async {
            await Future.delayed(const Duration(milliseconds: 500));
          },
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
                    _HeaderIconButton(
                      onTap: () =>
                          context.push('/customer/notifications'),
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
                                    unreadCount > 9
                                        ? '9+'
                                        : '$unreadCount',
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

                    const SizedBox(width: AppSpacing.xs),

                    // Settings
                    _HeaderIconButton(
                      onTap: () =>
                          context.push('/customer/profile'),
                      colors: colors,
                      child: HugeIcon(
                        icon: HugeIcons.strokeRoundedSettings01,
                        size: 22,
                        color: colors.onBackground,
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
            placeholder: (_, __) => Container(color: colors.surfaceVariant),
            errorWidget: (_, __, ___) =>
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
