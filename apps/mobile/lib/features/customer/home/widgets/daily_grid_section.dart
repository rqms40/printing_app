import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/providers/daily_grid_provider.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/shared/models/daily_grid_item.dart';
import 'package:printing_app/shared/services/websocket_service.dart';

// ─── Fallback data (shown on error / while server is unreachable) ─────────────

const _kFallback = [
  DailyGridItem(
    id: -1,
    title: 'Bond Paper A4',
    subtitle: '₱15 / page',
    imageUrl:
        'https://images.unsplash.com/photo-1588580000645-4562a6d2c839'
        '?w=160&h=160&fit=crop&q=80',
    category: 'paper',
    specs: {'paper_size': 'a4', 'color_mode': 'black_and_white'},
    sortOrder: 0,
  ),
  DailyGridItem(
    id: -2,
    title: 'A3 Poster',
    subtitle: '₱75 / sheet',
    imageUrl:
        'https://images.unsplash.com/photo-1503455637927-730bce8583c0'
        '?w=160&h=160&fit=crop&q=80',
    category: 'paper',
    specs: {
      'paper_size': 'a3',
      'color_mode': 'full_color',
      'media_type': 'glossy',
    },
    sortOrder: 1,
  ),
  DailyGridItem(
    id: -3,
    title: '3D Print',
    subtitle: 'From ₱120',
    imageUrl:
        'https://images.unsplash.com/photo-1617839625591-e5a789593135'
        '?w=160&h=160&fit=crop&q=80',
    category: '3d',
    specs: {
      'file_format': 'stl',
      'material': 'pla',
      'color': 'white',
      'infill_percentage': '20',
      'layer_height': '0.2',
      'supports': 'false',
    },
    sortOrder: 2,
  ),
  DailyGridItem(
    id: -4,
    title: 'Large Banner',
    subtitle: 'From ₱350',
    imageUrl:
        'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c'
        '?w=160&h=160&fit=crop&q=80',
    category: 'paper',
    specs: {
      'paper_size': 'a1',
      'color_mode': 'full_color',
      'media_type': 'glossy',
    },
    sortOrder: 3,
  ),
  DailyGridItem(
    id: -5,
    title: 'Flyer Print',
    subtitle: '₱12 / sheet',
    imageUrl:
        'https://images.unsplash.com/photo-1601645191163-3fc0d5d64e35'
        '?w=160&h=160&fit=crop&q=80',
    category: 'paper',
    specs: {
      'paper_size': 'a5',
      'color_mode': 'full_color',
      'media_type': 'matte',
    },
    sortOrder: 4,
  ),
];

// ─── Dimensions ───────────────────────────────────────────────────────────────

const double _kCardH = 88.0;
const double _kCircleD = _kCardH;
const double _kCircleOverhang = _kCircleD / 2;
const double _kCardPadL = _kCircleOverhang + 10.0;
const int _kInitialPage = 10000;

// ─── Section widget ───────────────────────────────────────────────────────────

class DailyGridSection extends ConsumerStatefulWidget {
  const DailyGridSection({super.key});

  @override
  ConsumerState<DailyGridSection> createState() => _DailyGridSectionState();
}

class _DailyGridSectionState extends ConsumerState<DailyGridSection> {
  late final PageController _pageController;
  Timer? _autoScrollTimer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: _kInitialPage,
      viewportFraction: 0.47,
    );
    _autoScrollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (_pageController.hasClients) {
        _pageController.nextPage(
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      }
    });
    unawaited(
      WebSocketService.instance.connectDailyGrid(
        onUpdated: _onDailyGridUpdated,
      ),
    );
  }

  @override
  void dispose() {
    _autoScrollTimer?.cancel();
    _pageController.dispose();
    WebSocketService.instance.disconnectDailyGrid();
    super.dispose();
  }

  void _onCardTap(BuildContext context, DailyGridItem card) {
    final notifier = ref.read(orderFlowProvider.notifier);
    final catalog = ref.read(productCatalogProvider).catalog;
    final fallback = ProductCatalog.legacyFallback();
    final category =
        catalog.categoryBySlug(card.category) ??
        fallback.categoryBySlug(card.category) ??
        fallback.categoryBySlug(card.category == '3d' ? '3d' : 'paper')!;
    final selectedSpecs = card.specs ?? const <String, dynamic>{};
    final displayValues = card.specDisplayValues.isNotEmpty
        ? card.specDisplayValues
        : category.displayValues(
            category.defaultSpecValues(overrides: selectedSpecs),
          );

    notifier.reset();
    // setCategory must come before spec setters because it clears spec state.
    notifier.setCategory(
      category.slug,
      categoryName: card.categoryName ?? category.name,
    );
    if (selectedSpecs.isNotEmpty) {
      notifier.setCatalogSpecs(
        specs: selectedSpecs,
        displayValues: displayValues,
      );
    }
    notifier.goToStep(1);
    context.push(
      category.fileProcessingType == 'document' || category.slug == 'paper'
          ? '/customer/order/paper-specs'
          : '/customer/order/3d-specs',
    );
  }

  void _onDailyGridUpdated() {
    if (mounted) ref.invalidate(dailyGridProvider);
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final gridAsync = ref.watch(dailyGridProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // ── Section header ─────────────────────────────────────────────
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'The Daily Grid',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.h2.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    Text(
                      'Ready-to-print essentials.',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.brand,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
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

        // ── Carousel ───────────────────────────────────────────────────
        SizedBox(
          height: _kCardH,
          child: gridAsync.when(
            loading: () => _buildShimmer(colors),
            error: (_, _) => _buildCarousel(_kFallback, colors),
            data: (items) =>
                _buildCarousel(items.isEmpty ? _kFallback : items, colors),
          ),
        ),
      ],
    );
  }

  Widget _buildCarousel(List<DailyGridItem> items, AppColorSet colors) {
    return LayoutBuilder(
      builder: (context, constraints) => OverflowBox(
        alignment: Alignment.centerLeft,
        maxWidth: constraints.maxWidth + AppSpacing.xl,
        child: SizedBox(
          width: constraints.maxWidth + AppSpacing.xl,
          height: _kCardH,
          child: PageView.builder(
            padEnds: false,
            controller: _pageController,
            itemCount: null,
            itemBuilder: (context, index) {
              final item = items[index % items.length];
              return Padding(
                padding: const EdgeInsets.only(right: AppSpacing.sm),
                child: _DailyGridCard(
                  item: item,
                  colors: colors,
                  onTap: () => _onCardTap(context, item),
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  Widget _buildShimmer(AppColorSet colors) {
    return LayoutBuilder(
      builder: (context, constraints) => OverflowBox(
        alignment: Alignment.centerLeft,
        maxWidth: double.infinity,
        child: SizedBox(
          width: constraints.maxWidth + AppSpacing.xl,
          height: _kCardH,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: 3,
            itemBuilder: (context, i) {
              final viewportWidth =
                  (constraints.maxWidth + AppSpacing.xl) * 0.47;
              return Padding(
                padding: const EdgeInsets.only(right: AppSpacing.sm),
                child: Shimmer.fromColors(
                  baseColor: colors.surfaceVariant,
                  highlightColor: colors.surface,
                  child: SizedBox(
                    width: viewportWidth,
                    height: _kCardH,
                    child: Stack(
                      clipBehavior: Clip.none,
                      children: [
                        Positioned(
                          left: _kCircleOverhang,
                          right: 0,
                          top: 0,
                          bottom: 0,
                          child: Container(
                            decoration: BoxDecoration(
                              color: colors.surfaceVariant,
                              borderRadius: AppRadius.borderLg,
                            ),
                          ),
                        ),
                        Positioned(
                          left: 0,
                          top: 0,
                          child: Container(
                            width: _kCircleD,
                            height: _kCircleD,
                            decoration: BoxDecoration(
                              color: colors.surfaceVariant,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

// ─── Card ─────────────────────────────────────────────────────────────────────

class _DailyGridCard extends StatefulWidget {
  const _DailyGridCard({
    required this.item,
    required this.colors,
    required this.onTap,
  });

  final DailyGridItem item;
  final AppColorSet colors;
  final VoidCallback onTap;

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
        widget.onTap();
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
                      color: widget.colors.outline.withValues(alpha: 0.5),
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
                      if (widget.item.subtitle != null) ...[
                        const SizedBox(height: 2),
                        Text(
                          widget.item.subtitle!,
                          style: AppTypography.caption.copyWith(
                            color: widget.colors.onSurfaceDim,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ),

              // ── Circle photo ─────────────────────────────────────────
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

// ─── Circle photo ─────────────────────────────────────────────────────────────

class _CirclePhoto extends StatelessWidget {
  const _CirclePhoto({
    required this.imageUrl,
    required this.diameter,
    required this.borderColor,
  });

  final String? imageUrl;
  final double diameter;
  final Color borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: diameter,
      height: diameter,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: borderColor, width: 2.5),
        boxShadow: const [
          BoxShadow(
            color: Color(0x55000000),
            blurRadius: 10,
            offset: Offset(0, 3),
          ),
        ],
      ),
      child: ExcludeSemantics(
        child: ClipOval(
          child: imageUrl != null && imageUrl!.isNotEmpty
              ? CachedNetworkImage(
                  imageUrl: imageUrl!,
                  fit: BoxFit.cover,
                  color: Colors.black.withValues(alpha: 0.20),
                  colorBlendMode: BlendMode.darken,
                  placeholder: (_, _) => _placeholder(),
                  errorWidget: (_, _, _) => _placeholder(),
                )
              : _placeholder(),
        ),
      ),
    );
  }

  Widget _placeholder() {
    return Container(
      color: const Color(0xFF1E1E1E),
      child: const Center(
        child: SizedBox(
          width: 16,
          height: 16,
          child: CircularProgressIndicator(
            strokeWidth: 1.5,
            color: AppColors.brandLogo,
          ),
        ),
      ),
    );
  }
}
