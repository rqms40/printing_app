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

/// Premium bento grid for the customer home screen.
///
/// Uses LayoutBuilder to get available width and computes cell sizes
/// so the StaggeredGrid tiles never overflow.
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
        // Compute cell height based on available width so tiles are proportional
        final totalWidth = constraints.maxWidth;
        final cellWidth = (totalWidth - 30) / 4; // 4 columns, 3 gaps of 10px
        final cellHeight = cellWidth; // square cells

        return StaggeredGrid.extent(
          maxCrossAxisExtent: cellHeight,
          mainAxisSpacing: 10,
          crossAxisSpacing: 10,
          children: [
            // 1. Hero tile (2×2)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 2,
              child: _HeroTile(colors: colors, isDark: isDark)
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut),
            ),

            // 2. Paper Printing tile (2×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _ServiceTile(
                title: 'Paper\nPrinting',
                icon: HugeIcons.strokeRoundedFile02,
                colors: colors,
                isDark: isDark,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(
                      duration: 400.ms, delay: 80.ms, curve: Curves.easeOut),
            ),

            // 3. 3D Printing tile (2×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _ServiceTile(
                title: '3D\nPrinting',
                icon: HugeIcons.strokeRoundedPackageDelivered,
                colors: colors,
                isDark: isDark,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(
                      duration: 400.ms, delay: 140.ms, curve: Curves.easeOut),
            ),

            // 4. Active Orders (1×1)
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
                  .fadeIn(
                      duration: 400.ms, delay: 200.ms, curve: Curves.easeOut),
            ),

            // 5. Promo tile (3×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 3,
              mainAxisCellCount: 1,
              child: _PromoTile(colors: colors, isDark: isDark)
                  .animate()
                  .fadeIn(
                      duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),
            ),
          ],
        );
      },
    );
  }
}

// ---------------------------------------------------------------------------
// Hero Tile
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
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: isDark ? colors.surfaceVariant : colors.accent,
          borderRadius: AppRadius.borderXl,
        ),
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
          Positioned(
            right: -8,
            bottom: -8,
            child: Opacity(
              opacity: isDark ? 0.08 : 0.12,
              child: GridLogo(
                size: 110,
                foregroundColor: isDark ? colors.onBackground : colors.background,
              ),
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              Text(
                'Professional\nprinting,\ndelivered.',
                style: AppTypography.display.copyWith(
                  color: isDark ? colors.onBackground : colors.background,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Paper & 3D services\nat your fingertips',
                style: AppTypography.caption.copyWith(
                  color: (isDark ? colors.onBackground : colors.background)
                      .withValues(alpha: 0.7),
                ),
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
// Service Tile
// ---------------------------------------------------------------------------
class _ServiceTile extends StatefulWidget {
  const _ServiceTile({
    required this.title,
    required this.icon,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final String title;
  final dynamic icon;
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
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderXl,
            boxShadow: widget.isDark ? null : AppShadows.subtle,
            border: widget.isDark
                ? Border.all(
                    color: widget.colors.outline.withValues(alpha: 0.5),
                    width: 0.5)
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: widget.colors.surfaceVariant,
                  borderRadius: AppRadius.borderMd,
                ),
                child: Center(
                  child: HugeIcon(
                    icon: widget.icon,
                    size: 18,
                    color: widget.colors.onBackground,
                  ),
                ),
              ),
              Text(
                widget.title,
                style: AppTypography.bodyBold.copyWith(
                  color: widget.colors.onBackground,
                  height: 1.2,
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

// ---------------------------------------------------------------------------
// Count Tile
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
                  color: colors.outline.withValues(alpha: 0.5), width: 0.5)
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              count,
              style: AppTypography.h2.copyWith(
                color: colors.brand,
              ),
            ),
            Text(
              label,
              style: AppTypography.caption.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 11,
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
// Promo Tile
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
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark
            ? colors.surfaceHigh
            : colors.accent.withValues(alpha: 0.06),
        borderRadius: AppRadius.borderXl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'FEATURED',
            style: AppTypography.overline.copyWith(
              color: colors.onSurfaceDim,
            ),
          ),
          Text(
            '20% off\nlarge format',
            style: AppTypography.bodyBold.copyWith(
              color: colors.onBackground,
              height: 1.2,
            ),
          ),
        ],
      ),
      ),
    );
  }
}
