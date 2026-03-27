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
import 'package:printing_app/shared/widgets/app_illustrations.dart';
import 'package:printing_app/shared/widgets/icon_container.dart';

/// Mobile bento grid replacing the hero banner and service cards.
///
/// 4-column quilted grid with 5 tiles:
/// ```
/// ┌──────────────┬───────┐
/// │              │ Paper │
/// │  Hero/Promo  │  2x1  │
/// │    2x2       ├───────┤
/// │              │  3D   │
/// │              │  2x1  │
/// ├──────────────┼───────┤
/// │  Quick Stats │ Promo │
/// │    2x1       │  2x1  │
/// └──────────────┴───────┘
/// ```
class BentoGrid extends StatelessWidget {
  const BentoGrid({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final activeOrderCount = MockData.orders
        .where((o) =>
            o.orderStatus != OrderStatus.delivered &&
            o.orderStatus != OrderStatus.completedPickup &&
            o.orderStatus != OrderStatus.cancelled)
        .length;

    return StaggeredGrid.count(
      crossAxisCount: 4,
      mainAxisSpacing: AppSpacing.md,
      crossAxisSpacing: AppSpacing.md,
      children: [
        // 1. Hero tile (2x2)
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 2,
          child: _HeroTile(colors: colors, isDark: isDark)
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
        ),

        // 2. Paper Printing tile (2x fit)
        StaggeredGridTile.fit(
          crossAxisCellCount: 2,
          child: _ServiceTile(
            title: 'Paper\nPrinting',
            icon: HugeIcons.strokeRoundedFile02,
            colors: colors,
            isDark: isDark,
            onTap: () => context.push('/customer/order/new'),
          )
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 60.ms,
                  curve: Curves.easeOut),
        ),

        // 3. 3D Printing tile (2x fit)
        StaggeredGridTile.fit(
          crossAxisCellCount: 2,
          child: _ServiceTile(
            title: '3D\nPrinting',
            icon: HugeIcons.strokeRoundedPackageDelivered,
            colors: colors,
            isDark: isDark,
            onTap: () => context.push('/customer/order/new'),
          )
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 120.ms,
                  curve: Curves.easeOut),
        ),

        // 4. Quick Stats tile (2x fit)
        StaggeredGridTile.fit(
          crossAxisCellCount: 2,
          child: _StatsTile(
            activeOrderCount: activeOrderCount,
            colors: colors,
            isDark: isDark,
            onTap: () => context.go('/customer/orders'),
          )
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 180.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 180.ms,
                  curve: Curves.easeOut),
        ),

        // 5. Promo tile (2x fit)
        StaggeredGridTile.fit(
          crossAxisCellCount: 2,
          child: _PromoTile(colors: colors, isDark: isDark)
              .animate()
              .fadeIn(
                  duration: 400.ms, delay: 240.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 240.ms,
                  curve: Curves.easeOut),
        ),
      ],
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
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderXl,
        boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
      ),
      child: Stack(
        children: [
          Positioned(
            right: -AppSpacing.sm,
            bottom: -AppSpacing.sm,
            child: Opacity(
              opacity: 0.07,
              child: PrinterIllustration(
                size: 110,
                color: colors.onBackground,
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
                  color: colors.onBackground,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Paper & 3D services\nat your fingertips',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Service Tile
// ---------------------------------------------------------------------------

class _ServiceTile extends StatelessWidget {
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
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderXl,
          boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
          border: isDark
              ? Border.all(color: colors.outline, width: 0.5)
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            IconContainer(
              icon: icon,
              size: IconContainerSize.md,
              shape: IconContainerShape.rounded,
              iconColor: colors.onBackground,
            ),
            Text(
              title,
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

// ---------------------------------------------------------------------------
// Stats Tile
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
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderXl,
          boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
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
              children: [
                Text(
                  '$activeOrderCount',
                  style: AppTypography.h2.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                Text(
                  'Active orders',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
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
// Promo Tile
// ---------------------------------------------------------------------------

class _PromoTile extends StatelessWidget {
  const _PromoTile({required this.colors, required this.isDark});

  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isDark
            ? colors.surfaceHigh
            : colors.accent.withValues(alpha: 0.06),
        borderRadius: AppRadius.borderXl,
        boxShadow: isDark ? AppShadows.none : AppShadows.subtle,
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
    );
  }
}
