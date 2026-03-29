import 'package:flutter/material.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/grid_logo.dart';

/// Bento grid matching the original design screenshot.
class BentoGrid extends StatelessWidget {
  const BentoGrid({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeOrderCount = MockData.orders
        .where((o) =>
            o.orderStatus != OrderStatus.delivered &&
            o.orderStatus != OrderStatus.completedPickup &&
            o.orderStatus != OrderStatus.cancelled)
        .length;

    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final cellSize = (w - 30) / 4;

        return StaggeredGrid.extent(
          maxCrossAxisExtent: cellSize,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          children: [
            // Hero (2×2)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 2,
              child: _HeroTile(colors: colors, isDark: isDark)
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut),
            ),
            // Paper Printing (2×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _ServiceTile(
                title: 'Paper Printing',
                subtitle: 'Docs & posters',
                colors: colors,
                isDark: isDark,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 80.ms, curve: Curves.easeOut),
            ),
            // 3D Printing (2×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _ServiceTile(
                title: '3D Printing',
                subtitle: 'Models & prototypes',
                colors: colors,
                isDark: isDark,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 140.ms, curve: Curves.easeOut),
            ),
            // Active count (1×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 1,
              mainAxisCellCount: 1,
              child: _CountTile(
                count: '$activeOrderCount',
                label: 'Active',
                colors: colors,
                isDark: isDark,
                onTap: () => context.go('/customer/orders'),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 200.ms, curve: Curves.easeOut),
            ),
            // Promo (3×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 3,
              mainAxisCellCount: 1,
              child: _PromoTile(colors: colors, isDark: isDark)
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),
            ),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Hero Tile — matches screenshot: large text, subtitle, logo watermark
// ---------------------------------------------------------------------------
class _HeroTile extends StatelessWidget {
  const _HeroTile({required this.colors, required this.isDark});
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: isDark ? colors.surfaceVariant : colors.accent,
          borderRadius: AppRadius.borderXl,
        ),
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned(
              right: -10,
              bottom: -10,
              child: Opacity(
                opacity: isDark ? 0.08 : 0.12,
                child: GridLogo(
                  size: 100,
                  foregroundColor:
                      isDark ? colors.onBackground : colors.background,
                ),
              ),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Flexible(
                  child: Text(
                    'Professional\nprinting,\ndelivered.',
                    style: AppTypography.h2.copyWith(
                      color:
                          isDark ? colors.onBackground : colors.background,
                      height: 1.15,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 3,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Paper & 3D printing\nservices',
                  style: AppTypography.caption.copyWith(
                    color:
                        (isDark ? colors.onBackground : colors.background)
                            .withValues(alpha: 0.7),
                    fontSize: 11,
                    height: 1.3,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Service Tile — matches screenshot: title + subtitle, no icon
// ---------------------------------------------------------------------------
class _ServiceTile extends StatefulWidget {
  const _ServiceTile({
    required this.title,
    required this.subtitle,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final String title;
  final String subtitle;
  final AppColorSet colors;
  final bool isDark;
  final VoidCallback? onTap;

  @override
  State<_ServiceTile> createState() => _ServiceTileState();
}

class _ServiceTileState extends State<_ServiceTile> {
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
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: ClipRRect(
          borderRadius: AppRadius.borderXl,
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: widget.colors.surface,
              borderRadius: AppRadius.borderXl,
              boxShadow: widget.isDark ? null : AppShadows.subtle,
              border: widget.isDark
                  ? Border.all(
                      color:
                          widget.colors.outline.withValues(alpha: 0.5),
                      width: 0.5)
                  : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  widget.title,
                  style: AppTypography.bodyBold.copyWith(
                    color: widget.colors.onBackground,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 2),
                Text(
                  widget.subtitle,
                  style: AppTypography.caption.copyWith(
                    color: widget.colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Count Tile — matches screenshot: large number + label
// ---------------------------------------------------------------------------
class _CountTile extends StatelessWidget {
  const _CountTile({
    required this.count,
    required this.label,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final String count;
  final String label;
  final AppColorSet colors;
  final bool isDark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: AppRadius.borderXl,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderXl,
            boxShadow: isDark ? null : AppShadows.subtle,
            border: isDark
                ? Border.all(
                    color: colors.outline.withValues(alpha: 0.5),
                    width: 0.5)
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Flexible(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Text(
                    count,
                    style: AppTypography.h1.copyWith(
                      color: colors.brand,
                    ),
                  ),
                ),
              ),
              Text(
                label,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Promo Tile — matches screenshot: icon + text + chevron, horizontal
// ---------------------------------------------------------------------------
class _PromoTile extends StatelessWidget {
  const _PromoTile({required this.colors, required this.isDark});
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderXl,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isDark
              ? colors.surfaceHigh
              : colors.accent.withValues(alpha: 0.06),
          borderRadius: AppRadius.borderXl,
        ),
        child: Row(
          children: [
            HugeIcon(
              icon: HugeIcons.strokeRoundedDiscount,
              size: 18,
              color: colors.brand,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    '20% off large format prints',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                      fontSize: 12,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  Text(
                    'Limited time offer',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
            HugeIcon(
              icon: HugeIcons.strokeRoundedArrowRight01,
              size: 14,
              color: colors.disabled,
            ),
          ],
        ),
      ),
    );
  }
}
