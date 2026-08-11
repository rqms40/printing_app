import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/home_feed_provider.dart';
import 'package:printing_app/features/customer/home/providers/tam_surveys_feed_provider.dart';
import 'package:printing_app/shared/services/websocket_service.dart';
import 'package:url_launcher/url_launcher.dart';

/// Right-column bento tile: "The Feed".
///
/// Renders whatever the server resolved for the slot — community feedback
/// carousel, an admin-configured promo card, or an invite state — and
/// refetches live when the admin changes the setting (`/ws/home-feed`).
class HomeFeedTile extends ConsumerStatefulWidget {
  const HomeFeedTile({super.key, required this.colors});
  final AppColorSet colors;

  @override
  ConsumerState<HomeFeedTile> createState() => _HomeFeedTileState();
}

class _HomeFeedTileState extends ConsumerState<HomeFeedTile> {
  Timer? _timer;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    Future.microtask(
      () => WebSocketService.instance.connectHomeFeed(
        onUpdated: _onHomeFeedUpdated,
      ),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    WebSocketService.instance.disconnectHomeFeed();
    super.dispose();
  }

  void _onHomeFeedUpdated() {
    if (!mounted) return;
    ref.invalidate(homeFeedProvider);
  }

  void _startTimer(int totalItems) {
    if (_timer?.isActive ?? false) return;
    _timer = Timer.periodic(const Duration(seconds: 4), (timer) {
      if (mounted) {
        setState(() {
          _currentPage = (_currentPage + 1) % totalItems;
        });
      }
    });
  }

  void _stopTimer() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> _openPromoTarget(String target) async {
    if (target.startsWith('/')) {
      context.push(target);
      return;
    }
    final uri = Uri.tryParse(target);
    if (uri == null || !(uri.scheme == 'https' || uri.scheme == 'http')) {
      return;
    }
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      // A dead promo link should never crash the home screen.
    }
  }

  void _showFeedbackModal(BuildContext context, FeedItem item) {
    showDialog(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: widget.colors.surface,
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderXl),
          title: Row(
            children: [
              Icon(Icons.star_rounded, color: widget.colors.brand, size: 20),
              const SizedBox(width: 8),
              Text(
                '${item.rating.toStringAsFixed(1)} / 5.0',
                style: AppTypography.bodyBold.copyWith(
                  color: widget.colors.onBackground,
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.userName,
                style: AppTypography.bodyBold.copyWith(
                  color: widget.colors.brand,
                ),
              ),
              Text(
                'Student',
                style: AppTypography.caption.copyWith(
                  color: widget.colors.onSurfaceDim,
                ),
              ),
              const SizedBox(height: 16),
              if (item.feedback != null && item.feedback!.isNotEmpty)
                Text(
                  item.feedback!,
                  style: AppTypography.body.copyWith(
                    color: widget.colors.onBackground,
                  ),
                )
              else
                Text(
                  'No additional comments.',
                  style: AppTypography.body.copyWith(
                    color: widget.colors.onSurfaceDim,
                    fontStyle: FontStyle.italic,
                  ),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: Text(
                'Close',
                style: TextStyle(color: widget.colors.brand),
              ),
            ),
          ],
        );
      },
    );
  }

  String _subtitleFor(AsyncValue<HomeFeedData> feedAsync) {
    final resolved = feedAsync.valueOrNull?.resolvedMode;
    return resolved == HomeFeedResolvedMode.promo
        ? 'News & offers.'
        : 'Community feedback.';
  }

  @override
  Widget build(BuildContext context) {
    final feedAsync = ref.watch(homeFeedProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          crossAxisAlignment: WrapCrossAlignment.end,
          spacing: 6,
          runSpacing: 2,
          children: [
            Text(
              'The Feed',
              style: AppTypography.h2.copyWith(
                color: widget.colors.onBackground,
                fontSize: 18,
                letterSpacing: -0.5,
                height: 1.0,
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(bottom: 2),
              child: Text(
                _subtitleFor(feedAsync),
                style: AppTypography.caption.copyWith(
                  color: widget.colors.brand,
                  fontSize: 10,
                ),
                softWrap: true,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Expanded(
          child: AnimatedSwitcher(
            duration: const Duration(milliseconds: 350),
            switchInCurve: Curves.easeOut,
            switchOutCurve: Curves.easeIn,
            child: feedAsync.when(
              data: (data) => _buildResolved(data),
              loading: () => Center(
                key: const ValueKey('home-feed-loading'),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    color: widget.colors.brand,
                    strokeWidth: 2.0,
                  ),
                ),
              ),
              error: (err, _) => _ErrorState(
                key: const ValueKey('home-feed-error'),
                colors: widget.colors,
                onRetry: () => ref.invalidate(homeFeedProvider),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildResolved(HomeFeedData data) {
    switch (data.resolvedMode) {
      case HomeFeedResolvedMode.promo:
        _stopTimer();
        return _PromoCarousel(
          key: const ValueKey('home-feed-promo'),
          colors: widget.colors,
          cards: data.promoCards,
          onCardTap: _openPromoTarget,
        );
      case HomeFeedResolvedMode.empty:
        _stopTimer();
        return _InviteState(
          key: const ValueKey('home-feed-empty'),
          colors: widget.colors,
        );
      case HomeFeedResolvedMode.community:
        final feed = data.feedItems;
        if (feed.isEmpty) {
          _stopTimer();
          return _InviteState(
            key: const ValueKey('home-feed-empty'),
            colors: widget.colors,
          );
        }
        return _buildCommunity(feed);
    }
  }

  Widget _buildCommunity(List<FeedItem> feed) {
    if (feed.length > 1) {
      _startTimer(feed.length);
    }

    final safeIndex = _currentPage < feed.length ? _currentPage : 0;
    final item = feed[safeIndex];

    return Container(
      key: const ValueKey('home-feed-community'),
      decoration: BoxDecoration(
        color: Colors.transparent,
        borderRadius: AppRadius.borderMd,
        border: Border.all(
          color: widget.colors.brand.withValues(alpha: 0.8),
          width: 0.75,
        ),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 600),
        switchInCurve: Curves.easeIn,
        switchOutCurve: Curves.easeOut,
        child: GestureDetector(
          key: ValueKey<int>(item.id),
          onTap: () => _showFeedbackModal(context, item),
          behavior: HitTestBehavior.opaque,
          child: LayoutBuilder(
            builder: (context, constraints) {
              final h = constraints.maxHeight;
              final w = constraints.maxWidth;
              final scale = (h / 122).clamp(0.85, 1.4);
              final starSize = (14 * scale).clamp(11.0, 18.0);
              final nameSize = (11 * scale).clamp(10.0, 14.0);
              final roleSize = (9 * scale).clamp(8.0, 12.0);
              final quoteSize = (9 * scale).clamp(8.0, 12.0);
              final gap = (4 * scale).clamp(2.0, 8.0);
              final hPad = (w * 0.06).clamp(6.0, 14.0);
              final hasFeedback =
                  item.feedback != null && item.feedback!.isNotEmpty;

              return Padding(
                padding: EdgeInsets.symmetric(
                  horizontal: hPad,
                  vertical: gap,
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (starIdx) {
                        final isFilled = starIdx < item.rating.round();
                        return Icon(
                          Icons.star_rounded,
                          color: isFilled
                              ? widget.colors.brand
                              : widget.colors.onSurfaceDim.withValues(
                                  alpha: 0.4,
                                ),
                          size: starSize,
                        );
                      }),
                    ),
                    SizedBox(height: gap),
                    Text(
                      item.userName,
                      style: AppTypography.bodyBold.copyWith(
                        color: widget.colors.onBackground,
                        fontSize: nameSize,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                    Text(
                      'Student',
                      style: AppTypography.caption.copyWith(
                        color: widget.colors.onSurfaceDim,
                        fontSize: roleSize,
                        fontStyle: FontStyle.italic,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    if (hasFeedback) ...[
                      SizedBox(height: gap),
                      Flexible(
                        child: Text(
                          '"${item.feedback!}"',
                          style: AppTypography.body.copyWith(
                            color: widget.colors.onBackground.withValues(
                              alpha: 0.9,
                            ),
                            fontSize: quoteSize,
                            height: 1.2,
                          ),
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// The 3x3 dot cluster from the GRIDGO mark; one accent dot, top-right.
class DotGridMotif extends StatelessWidget {
  const DotGridMotif({
    super.key,
    required this.dotColor,
    required this.accentColor,
    this.size = 28,
  });

  final Color dotColor;
  final Color accentColor;
  final double size;

  @override
  Widget build(BuildContext context) {
    final dot = size / 5;
    final gap = dot / 2;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (row) {
        return Padding(
          padding: EdgeInsets.only(bottom: row < 2 ? gap : 0),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: List.generate(3, (col) {
              final isAccent = row == 0 && col == 2;
              return Padding(
                padding: EdgeInsets.only(right: col < 2 ? gap : 0),
                child: Container(
                  width: dot,
                  height: dot,
                  decoration: BoxDecoration(
                    color: isAccent ? accentColor : dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
              );
            }),
          ),
        );
      }),
    );
  }
}

/// Swipeable marketing carousel — full-width image-led cards on an infinite
/// auto-advancing loop; a manual swipe pauses the loop briefly, then it
/// resumes. Dots show the true position.
class _PromoCarousel extends StatefulWidget {
  const _PromoCarousel({
    super.key,
    required this.colors,
    required this.cards,
    required this.onCardTap,
  });

  final AppColorSet colors;
  final List<HomeFeedPromo> cards;
  final ValueChanged<String> onCardTap;

  @override
  State<_PromoCarousel> createState() => _PromoCarouselState();
}

class _PromoCarouselState extends State<_PromoCarousel> {
  // Start deep into the range so the loop can also swipe backwards freely.
  static const _kLoopBase = 10000;

  late final PageController _controller;
  Timer? _autoTimer;
  int _page = 0;

  bool get _multi => widget.cards.length > 1;

  @override
  void initState() {
    super.initState();
    _controller = PageController(
      initialPage: _multi ? _kLoopBase * widget.cards.length : 0,
    );
    if (_multi) _startAutoTimer();
  }

  void _startAutoTimer() {
    _autoTimer?.cancel();
    _autoTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      if (!mounted || !_controller.hasClients) return;
      _controller.nextPage(
        duration: const Duration(milliseconds: 450),
        curve: Curves.easeOutCubic,
      );
    });
  }

  @override
  void dispose() {
    _autoTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _handleUserScroll(ScrollStartNotification notification) {
    // A manual swipe restarts the cadence so the loop never fights the user
    // mid-gesture, but auto-advance resumes 5 s later.
    if (notification.dragDetails != null && _multi) {
      _startAutoTimer();
    }
  }

  @override
  Widget build(BuildContext context) {
    final multi = _multi;
    return Column(
      children: [
        Expanded(
          child: NotificationListener<ScrollStartNotification>(
            onNotification: (n) {
              _handleUserScroll(n);
              return false;
            },
            child: PageView.builder(
              controller: _controller,
              itemCount: multi ? null : 1,
              onPageChanged: (index) =>
                  setState(() => _page = index % widget.cards.length),
              itemBuilder: (context, index) {
                final card = widget.cards[index % widget.cards.length];
                return _PromoSlide(
                  colors: widget.colors,
                  promo: card,
                  onTap: card.hasTapTarget
                      ? () => widget.onCardTap(card.ctaTarget!)
                      : null,
                );
              },
            ),
          ),
        ),
        if (multi) ...[
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.cards.length, (index) {
              final active = index == _page;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 2),
                width: active ? 12 : 4,
                height: 4,
                decoration: BoxDecoration(
                  color: active
                      ? widget.colors.brand
                      : widget.colors.onSurfaceDim.withValues(alpha: 0.4),
                  borderRadius: BorderRadius.circular(2),
                ),
              );
            }),
          ),
        ],
      ],
    );
  }
}

/// One campaign card. With an image: full-bleed photo, dark scrim, overlaid
/// copy. Without: the brand-yellow text card from v1.
class _PromoSlide extends StatelessWidget {
  const _PromoSlide({
    required this.colors,
    required this.promo,
    this.onTap,
  });

  final AppColorSet colors;
  final HomeFeedPromo promo;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final child = promo.imageUrl != null
        ? _buildImageCard()
        : _buildTextCard();
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: child,
    );
  }

  Widget _buildImageCard() {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF141414),
        borderRadius: AppRadius.borderMd,
      ),
      clipBehavior: Clip.antiAlias,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.network(
            promo.imageUrl!,
            fit: BoxFit.cover,
            errorBuilder: (_, e, s) => const SizedBox.shrink(),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                stops: const [0.35, 1.0],
                colors: [
                  Colors.transparent,
                  Colors.black.withValues(alpha: 0.82),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.end,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  promo.title,
                  style: AppTypography.bodyBold.copyWith(
                    color: Colors.white,
                    fontSize: 13,
                    height: 1.15,
                    letterSpacing: -0.2,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (promo.hasCta) ...[
                  const SizedBox(height: 6),
                  _PromoCtaChip(
                    label: promo.ctaLabel!,
                    background: colors.brand,
                    foreground: const Color(0xFF141414),
                    onTap: onTap ?? () {},
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextCard() {
    // Brand-filled card with dark ink — same pairing as the Start Printing
    // chip and the admin dashboard preview (#141414 on brand yellow/amber).
    const ink = Color(0xFF141414);
    return Container(
      decoration: BoxDecoration(
        color: colors.brand,
        borderRadius: AppRadius.borderMd,
      ),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    'FROM GRIDGO',
                    style: AppTypography.caption.copyWith(
                      color: ink.withValues(alpha: 0.65),
                      fontSize: 8.5,
                      letterSpacing: 1.4,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                DotGridMotif(
                  dotColor: ink.withValues(alpha: 0.85),
                  accentColor: ink.withValues(alpha: 0.35),
                  size: 13,
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              promo.title,
              style: AppTypography.bodyBold.copyWith(
                color: ink,
                fontSize: 14,
                height: 1.15,
                letterSpacing: -0.2,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            if (promo.body != null) ...[
              const SizedBox(height: 4),
              Flexible(
                child: Text(
                  promo.body!,
                  style: AppTypography.caption.copyWith(
                    color: ink.withValues(alpha: 0.8),
                    fontSize: 10,
                    height: 1.3,
                  ),
                  overflow: TextOverflow.ellipsis,
                  maxLines: 3,
                ),
              ),
            ],
            if (promo.hasCta) ...[
              const Spacer(),
              _PromoCtaChip(
                label: promo.ctaLabel!,
                background: ink,
                foreground: colors.brand,
                onTap: onTap ?? () {},
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _PromoCtaChip extends StatelessWidget {
  const _PromoCtaChip({
    required this.label,
    required this.background,
    required this.foreground,
    required this.onTap,
  });

  final String label;
  final Color background;
  final Color foreground;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              child: Text(
                label,
                style: AppTypography.caption.copyWith(
                  color: foreground,
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
            const SizedBox(width: 4),
            Icon(Icons.arrow_forward_rounded, color: foreground, size: 11),
          ],
        ),
      ),
    );
  }
}

/// Quiet empty state: an invitation, not an apology.
class _InviteState extends StatelessWidget {
  const _InviteState({super.key, required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.borderMd,
        border: Border.all(
          color: colors.brand.withValues(alpha: 0.8),
          width: 0.75,
        ),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          DotGridMotif(
            dotColor: colors.onSurfaceDim.withValues(alpha: 0.45),
            accentColor: colors.brand,
            size: 22,
          ),
          const SizedBox(height: 8),
          Text(
            'No community feedback yet.',
            style: AppTypography.caption.copyWith(
              color: colors.onBackground.withValues(alpha: 0.85),
              fontWeight: FontWeight.w600,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2),
          Text(
            'Reviews appear here.',
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
              fontSize: 9.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({super.key, required this.colors, required this.onRetry});

  final AppColorSet colors;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: AppRadius.borderMd,
        border: Border.all(
          color: colors.outlineVariant,
          width: 0.75,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            "Couldn't load the feed.",
            style: AppTypography.caption.copyWith(
              color: colors.onSurfaceDim,
            ),
            textAlign: TextAlign.center,
          ),
          TextButton(
            onPressed: onRetry,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              minimumSize: const Size(0, 28),
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: Text(
              'Retry',
              style: AppTypography.caption.copyWith(
                color: colors.brand,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
