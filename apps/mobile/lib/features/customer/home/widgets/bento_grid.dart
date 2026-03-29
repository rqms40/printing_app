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
import 'package:printing_app/shared/widgets/icon_container.dart';

/// Bento grid — restored to original design with overflow protection.
///
/// Uses LayoutBuilder + StaggeredGrid.extent so cell sizes adapt to
/// screen width. All tiles wrapped in ClipRRect to prevent overflow.
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
        final cellSize = (constraints.maxWidth - 30) / 4;

        return StaggeredGrid.extent(
          maxCrossAxisExtent: cellSize,
          mainAxisSpacing: AppSpacing.md,
          crossAxisSpacing: AppSpacing.md,
          children: [
            // 1. Hero tile (2×2)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 2,
              child: _HeroTile(colors: colors, isDark: isDark)
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut),
            ),

            // 2. Paper Printing (2×1) — icon + title
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _ServiceTile(
                title: 'Paper\nPrinting',
                subtitle: 'Docs & posters',
                icon: HugeIcons.strokeRoundedFile02,
                colors: colors,
                isDark: isDark,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
            ),

            // 3. 3D Printing (2×1) — icon + title
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _ServiceTile(
                title: '3D\nPrinting',
                subtitle: 'Models & prototypes',
                icon: HugeIcons.strokeRoundedPackageDelivered,
                colors: colors,
                isDark: isDark,
                onTap: () => context.push('/customer/order/new'),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
            ),

            // 4. Stats tile (2×1) — icon + count + label
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
              mainAxisCellCount: 1,
              child: _StatsTile(
                activeOrderCount: activeOrderCount,
                colors: colors,
                isDark: isDark,
                onTap: () => context.go('/customer/orders'),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 180.ms, curve: Curves.easeOut),
            ),

            // 5. Promo tile (2×1)
            StaggeredGridTile.count(
              crossAxisCellCount: 2,
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
// Hero Tile — brand text + GridLogo watermark
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
              right: -AppSpacing.sm,
              bottom: -AppSpacing.sm,
              child: Opacity(
                opacity: 0.07,
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
                Flexible(
                  child: Text(
                    'Professional\nprinting,\ndelivered.',
                    style: AppTypography.h2.copyWith(
                      color: isDark ? colors.onBackground : colors.background,
                      height: 1.1,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 3,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Paper & 3D printing\nservices',
                  style: AppTypography.caption.copyWith(
                    color: (isDark ? colors.onBackground : colors.background)
                        .withValues(alpha: 0.7),
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
// Service Tile — IconContainer top + title bottom (original design)
// ---------------------------------------------------------------------------
class _ServiceTile extends StatefulWidget {
  const _ServiceTile({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final String title;
  final String subtitle;
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
                  ? Border.all(color: widget.colors.outline, width: 0.5)
                  : null,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                IconContainer(
                  icon: widget.icon,
                  size: IconContainerSize.md,
                  shape: IconContainerShape.rounded,
                  iconColor: widget.colors.onBackground,
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.title,
                      style: AppTypography.bodyBold.copyWith(
                        color: widget.colors.onBackground,
                        height: 1.2,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    Text(
                      widget.subtitle,
                      style: AppTypography.caption.copyWith(
                        color: widget.colors.onSurfaceDim,
                        fontSize: 10,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
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
// Stats Tile — IconContainer top + count + label bottom
// ---------------------------------------------------------------------------
class _StatsTile extends StatelessWidget {
  const _StatsTile({
    required this.activeOrderCount,
    required this.colors,
    required this.isDark,
    this.onTap,
  });

  final int activeOrderCount;
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
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderXl,
            boxShadow: isDark ? null : AppShadows.subtle,
            border: isDark
                ? Border.all(color: colors.outline, width: 0.5)
                : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconContainer(
                icon: HugeIcons.strokeRoundedPackage,
                size: IconContainerSize.md,
                shape: IconContainerShape.rounded,
                iconColor: colors.onBackground,
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '$activeOrderCount',
                    style: AppTypography.h2.copyWith(
                      color: colors.brand,
                    ),
                  ),
                  Text(
                    'Active orders',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 10,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Promo Tile — "FEATURED" overline + offer text
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
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
