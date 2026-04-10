import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/section_header.dart';

/// Horizontal carousel of popular print type cards with real photo previews.
class PopularPrintsSection extends StatefulWidget {
  const PopularPrintsSection({super.key});

  @override
  State<PopularPrintsSection> createState() => _PopularPrintsSectionState();
}

class _PopularPrintsSectionState extends State<PopularPrintsSection> {
  late final ScrollController _scrollController;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _scrollController = ScrollController();
    _startTimer();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _scrollController.dispose();
    super.dispose();
  }

  void _startTimer() {
    _timer = Timer.periodic(const Duration(seconds: 3), (timer) {
      if (!_scrollController.hasClients) return;
      
      final maxScroll = _scrollController.position.maxScrollExtent;
      final currentScroll = _scrollController.position.pixels;
      
      if (currentScroll >= maxScroll - 10) {
        // Rewind to the start
        _scrollController.animateTo(
          0.0,
          duration: const Duration(milliseconds: 800),
          curve: Curves.fastOutSlowIn,
        );
      } else {
        // Scroll forward by one item width (140 width + 12 gap)
        _scrollController.animateTo(
          currentScroll + 152.0,
          duration: const Duration(milliseconds: 600),
          curve: Curves.fastOutSlowIn,
        );
      }
    });
  }

  static const _prints = <_PrintTypeData>[
    _PrintTypeData(
      title: 'Documents',
      price: 'from ₱3',
      unit: '/ page',
      imageUrl:
          'https://images.unsplash.com/photo-1568667256549-094345857637?w=400&h=300&fit=crop&q=80',
    ),
    _PrintTypeData(
      title: 'ID Photos',
      price: 'from ₱15',
      unit: '/ set',
      imageUrl:
          'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop&q=80',
    ),
    _PrintTypeData(
      title: 'Posters',
      price: 'from ₱45',
      unit: '/ pc',
      imageUrl:
          'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&h=300&fit=crop&q=80',
    ),
    _PrintTypeData(
      title: 'Thesis Bind',
      price: 'from ₱120',
      unit: '/ copy',
      imageUrl:
          'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=400&h=300&fit=crop&q=80',
    ),
    _PrintTypeData(
      title: '3D Prints',
      price: 'from ₱150',
      unit: '/ model',
      imageUrl:
          'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400&h=300&fit=crop&q=80',
    ),
    _PrintTypeData(
      title: 'Stickers',
      price: 'from ₱25',
      unit: '/ sheet',
      imageUrl:
          'https://images.unsplash.com/photo-1635048424329-a9bfb146d7aa?w=400&h=300&fit=crop&q=80',
    ),
  ];

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Popular Prints',
          actionLabel: 'See All',
          onAction: () => context.push('/customer/order/new'),
        ),
        SizedBox(
          height: 190,
          child: ListView.separated(
            controller: _scrollController,
            scrollDirection: Axis.horizontal,
            clipBehavior: Clip.none,
            itemCount: _prints.length,
            separatorBuilder: (_, _) => const SizedBox(width: 12),
            itemBuilder: (context, index) {
              final printType = _prints[index];
              return _PrintCard(
                data: printType,
                colors: colors,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: (80 * index).ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.12,
                    duration: 400.ms,
                    delay: (80 * index).ms,
                    curve: Curves.easeOut,
                  );
            },
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------
class _PrintTypeData {
  final String title;
  final String price;
  final String unit;
  final String imageUrl;

  const _PrintTypeData({
    required this.title,
    required this.price,
    required this.unit,
    required this.imageUrl,
  });
}

// ---------------------------------------------------------------------------
// Print card
// ---------------------------------------------------------------------------
class _PrintCard extends StatefulWidget {
  const _PrintCard({
    required this.data,
    required this.colors,
    required this.onTap,
  });

  final _PrintTypeData data;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  State<_PrintCard> createState() => _PrintCardState();
}

class _PrintCardState extends State<_PrintCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return GestureDetector(
      onTapDown: (_) => setState(() => _pressed = true),
      onTapUp: (_) {
        setState(() => _pressed = false);
        widget.onTap();
      },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: Container(
          width: 140,
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderXl,
            border: Border.all(
              color: isDark
                  ? widget.colors.outline.withValues(alpha: 0.4)
                  : widget.colors.outlineVariant,
            ),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Image area with gradient overlay
              SizedBox(
                height: 110,
                width: double.infinity,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    CachedNetworkImage(
                      imageUrl: widget.data.imageUrl,
                      fit: BoxFit.cover,
                      placeholder: (_, _) => Container(
                        color: isDark
                            ? widget.colors.surfaceVariant
                            : widget.colors.surfaceDim,
                      ),
                      errorWidget: (_, _, _) => Container(
                        color: isDark
                            ? widget.colors.surfaceVariant
                            : widget.colors.surfaceDim,
                        child: Icon(
                          Icons.image_outlined,
                          color: widget.colors.disabled,
                          size: 28,
                        ),
                      ),
                    ),
                    // Bottom gradient fade for text readability
                    Positioned(
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 40,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              widget.colors.surface.withValues(alpha: 0.6),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              // Text body
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        widget.data.title,
                        style: AppTypography.bodyBold.copyWith(
                          color: widget.colors.onBackground,
                          fontSize: 13,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text.rich(
                        TextSpan(
                          children: [
                            TextSpan(
                              text: widget.data.price,
                              style: AppTypography.caption.copyWith(
                                color: widget.colors.brand,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            TextSpan(
                              text: ' ${widget.data.unit}',
                              style: AppTypography.caption.copyWith(
                                color: widget.colors.onSurfaceDim,
                              ),
                            ),
                          ],
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
