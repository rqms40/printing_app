import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';

// ─── Data ────────────────────────────────────────────────────────────────────

class _GridItem {
  const _GridItem({
    required this.title,
    required this.subtitle,
    required this.imageUrl,
  });

  final String title;
  final String subtitle;
  final String imageUrl;
}

const _kItems = [
  _GridItem(
    title: 'Bond Paper A4',
    subtitle: '₱15 / page',
    // crisp top-down white paper stack
    imageUrl:
        'https://images.unsplash.com/photo-1588580000645-4562a6d2c839'
        '?w=160&h=160&fit=crop&q=80',
  ),
  _GridItem(
    title: 'A3 Poster',
    subtitle: '₱75 / sheet',
    // rolled / printed poster on white surface
    imageUrl:
        'https://images.unsplash.com/photo-1503455637927-730bce8583c0'
        '?w=160&h=160&fit=crop&q=80',
  ),
  _GridItem(
    title: '3D Print',
    subtitle: 'From ₱120',
    // dark 3-D printed object
    imageUrl:
        'https://images.unsplash.com/photo-1617839625591-e5a789593135'
        '?w=160&h=160&fit=crop&q=80',
  ),
  _GridItem(
    title: 'Large Banner',
    subtitle: 'From ₱350',
    // wide-format print / signage
    imageUrl:
        'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c'
        '?w=160&h=160&fit=crop&q=80',
  ),
  _GridItem(
    title: 'Flyer Print',
    subtitle: '₱12 / sheet',
    // stack of printed leaflets
    imageUrl:
        'https://images.unsplash.com/photo-1601645191163-3fc0d5d64e35'
        '?w=160&h=160&fit=crop&q=80',
  ),
];

// ─── Dimensions ──────────────────────────────────────────────────────────────

/// Card height AND circle diameter (user requirement: same value).
const double _kCardH = 88.0;

/// Circle diameter == card height so circle perfectly spans the card vertically.
const double _kCircleD = _kCardH;

/// Half the circle extends to the LEFT of the card body.
const double _kCircleOverhang = _kCircleD / 2;

/// Left padding inside card body = half-circle width + small gap.
const double _kCardPadL = _kCircleOverhang + 10.0;

/// Start in the middle of a large range to allow scrolling both ways.
/// Value = 5 items × 2000 — effectively infinite.
const int _kInitialPage = 10000;

// ─── Section widget ──────────────────────────────────────────────────────────

class DailyGridSection extends StatefulWidget {
  const DailyGridSection({super.key});

  @override
  State<DailyGridSection> createState() => _DailyGridSectionState();
}

class _DailyGridSectionState extends State<DailyGridSection> {
  late final PageController _pageController;
  Timer? _autoScrollTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: _kInitialPage,
      // 0.47 → 2 full items + ~6% peek of 3rd on the right
      viewportFraction: 0.47,
    );

    // Auto-advance every 3 seconds
    _autoScrollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (_pageController.hasClients) {
        _pageController.nextPage(
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      }
    });
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Section header ─────────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'The Daily Grid',
                    style: AppTypography.h2.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  Text(
                    'Ready-to-print essentials.',
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => context.push('/customer/order/new'),
                child: Text(
                  'Order Now',
                  style: AppTypography.body.copyWith(color: colors.brand),
                ),
              ),
            ],
          ),
        ),

        // ── Infinite auto-scrolling carousel ───────────────────────────────
        // OverflowBox lets the carousel bleed past the parent's right padding
        // without using a negative margin (which Flutter asserts against).
        SizedBox(
          height: _kCardH,
          child: LayoutBuilder(
            builder: (context, constraints) => OverflowBox(
              alignment: Alignment.centerLeft,
              maxWidth: constraints.maxWidth + AppSpacing.xl,
              child: SizedBox(
                width: constraints.maxWidth + AppSpacing.xl,
                height: _kCardH,
                child: PageView.builder(
                  padEnds: false,
                  controller: _pageController,
                  itemCount: null, // infinite
                  itemBuilder: (context, index) {
                    final item = _kItems[index % _kItems.length];
                    return Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.sm),
                      child: _DailyGridCard(item: item, colors: colors),
                    );
                  },
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class _DailyGridCard extends StatefulWidget {
  const _DailyGridCard({required this.item, required this.colors});

  final _GridItem item;
  final AppColorSet colors;

  @override
  State<_DailyGridCard> createState() => _DailyGridCardState();
}

class _DailyGridCardState extends State<_DailyGridCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        context.push('/customer/order/new');
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: SizedBox(
          height: _kCardH,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // ── Card body ────────────────────────────────────────────
              Positioned(
                left: _kCircleOverhang,
                right: 0,
                top: 0,
                bottom: 0,
                child: Container(
                  decoration: BoxDecoration(
                    color: widget.colors.surface,
                    borderRadius: AppRadius.borderLg,
                    border: Border.all(
                      color:
                          widget.colors.outline.withValues(alpha: 0.5),
                      width: 0.5,
                    ),
                  ),
                  padding: const EdgeInsets.only(
                    left: _kCardPadL,
                    right: AppSpacing.sm,
                    top: AppSpacing.sm,
                    bottom: AppSpacing.sm,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        widget.item.title,
                        style: AppTypography.bodyBold.copyWith(
                          color: widget.colors.onBackground,
                          fontSize: 12,
                          height: 1.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.item.subtitle,
                        style: AppTypography.caption.copyWith(
                          color: widget.colors.onSurfaceDim,
                          fontSize: 10,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // ── Circle photo — diameter == card height ───────────────
              Positioned(
                left: 0,
                top: 0,
                child: _CirclePhoto(
                  imageUrl: widget.item.imageUrl,
                  diameter: _kCircleD,
                  borderColor: widget.colors.background,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Circle photo widget ──────────────────────────────────────────────────────

class _CirclePhoto extends StatelessWidget {
  const _CirclePhoto({
    required this.imageUrl,
    required this.diameter,
    required this.borderColor,
  });

  final String imageUrl;
  final double diameter;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        // Border matches the page background so the circle "floats"
        border: Border.all(color: borderColor, width: 2.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: ClipOval(
        child: CachedNetworkImage(
          imageUrl: imageUrl,
          fit: BoxFit.cover,
          // Dark tone overlay so image matches the dark UI
          color: Colors.black.withValues(alpha: 0.20),
          colorBlendMode: BlendMode.darken,
          placeholder: (_, _) => Container(
            color: const Color(0xFF1E1E1E),
            child: const Center(
              child: SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(
                  strokeWidth: 1.5,
                  color: Color(0xFFFFDE58),
                ),
              ),
            ),
          ),
          errorWidget: (_, _, _) => Container(
            color: const Color(0xFF1A1A1A),
            child: const Icon(
              Icons.image_rounded,
              color: Color(0xFF3A3A3A),
              size: 22,
            ),
          ),
        ),
      ),
    );
  }
}
