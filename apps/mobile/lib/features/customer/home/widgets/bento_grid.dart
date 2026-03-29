import 'package:flutter/material.dart';
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
/// Layout (4-column quilted grid):
/// ```
/// ┌────────────────┬─────────┐
/// │                │  Paper  │
/// │   Hero/Brand   │   2×1   │
/// │     2×2        ├─────────┤
/// │                │   3D    │
/// │                │   2×1   │
/// ├────────┬───────┴─────────┤
/// │ Active │     Featured    │
/// │ Orders │     Promo       │
/// │  1×1   │      3×1        │
/// └────────┴─────────────────┘
/// ```
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

    return Column(
      children: [
        // Row 1: Hero + Service tiles
        SizedBox(
          height: 190,
          child: Row(
            children: [
              // Hero tile
              Expanded(
                child: _HeroTile(colors: colors, isDark: isDark)
                    .animate()
                    .fadeIn(duration: 400.ms, curve: Curves.easeOut),
              ),
              const SizedBox(width: 10),
              // Service tiles stacked
              SizedBox(
                width: 140,
                child: Column(
                  children: [
                    Expanded(
                      child: _ServiceTile(
                        title: 'Paper Printing',
                        subtitle: 'Docs & posters',
                        icon: HugeIcons.strokeRoundedFile02,
                        colors: colors,
                        isDark: isDark,
                        onTap: () => context.push('/customer/order/new'),
                      )
                          .animate()
                          .fadeIn(duration: 400.ms, delay: 80.ms, curve: Curves.easeOut),
                    ),
                    const SizedBox(height: 10),
                    Expanded(
                      child: _ServiceTile(
                        title: '3D Printing',
                        subtitle: 'Models & prototypes',
                        icon: HugeIcons.strokeRoundedPackageDelivered,
                        colors: colors,
                        isDark: isDark,
                        onTap: () => context.push('/customer/order/new'),
                      )
                          .animate()
                          .fadeIn(duration: 400.ms, delay: 140.ms, curve: Curves.easeOut),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 10),
        // Row 2: Count + Promo
        SizedBox(
          height: 60,
          child: Row(
            children: [
              SizedBox(
                width: 80,
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
              const SizedBox(width: 10),
              Expanded(
                child: _PromoTile(colors: colors, isDark: isDark)
                    .animate()
                    .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Hero Tile — brand statement with illustration
// ---------------------------------------------------------------------------
class _HeroTile extends StatelessWidget {
  const _HeroTile({required this.colors, required this.isDark});
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? colors.surfaceVariant : colors.accent,
        borderRadius: AppRadius.borderLg,
      ),
      child: Stack(
        children: [
          // Background logo
          Positioned(
            right: -8,
            bottom: -8,
            child: Opacity(
              opacity: isDark ? 0.08 : 0.12,
              child: GridLogo(
                size: 120,
                foregroundColor: isDark ? colors.onBackground : colors.background,
              ),
            ),
          ),
          // Content
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.end,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Professional\nprinting,\ndelivered.',
                  style: AppTypography.display.copyWith(
                    color: isDark ? colors.onBackground : colors.background,
                    height: 1.0,
                    fontSize: 24,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Paper & 3D printing services',
                  style: AppTypography.caption.copyWith(
                    color: (isDark ? colors.onBackground : colors.background)
                        .withValues(alpha: 0.7),
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

// ---------------------------------------------------------------------------
// Service Tile — compact service card
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
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: widget.colors.surface,
            borderRadius: AppRadius.borderLg,
            boxShadow: widget.isDark ? null : AppShadows.subtle,
            border: widget.isDark
                ? Border.all(
                    color: widget.colors.outline.withValues(alpha: 0.5),
                    width: 0.5)
                : null,
          ),
          child: Center(
            child: Text(
              widget.title,
              style: AppTypography.bodyBold.copyWith(
                color: widget.colors.onBackground,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Count Tile — single metric
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
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderLg,
          boxShadow: isDark ? null : AppShadows.subtle,
          border: isDark
              ? Border.all(
                  color: colors.outline.withValues(alpha: 0.5), width: 0.5)
              : null,
        ),
        child: FittedBox(
          fit: BoxFit.scaleDown,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            mainAxisSize: MainAxisSize.min,
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
// Promo Tile — featured promotion
// ---------------------------------------------------------------------------
class _PromoTile extends StatelessWidget {
  const _PromoTile({required this.colors, required this.isDark});
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: isDark
            ? colors.surfaceVariant
            : colors.accent.withValues(alpha: 0.05),
        borderRadius: AppRadius.borderLg,
        border: Border.all(
          color: colors.outline.withValues(alpha: 0.3),
          width: 0.5,
        ),
      ),
      child: Row(
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedDiscount,
            size: 20,
            color: colors.brand,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '20% off large format prints',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 13,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                Text(
                  'Limited time offer',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          HugeIcon(
            icon: HugeIcons.strokeRoundedArrowRight01,
            size: 16,
            color: colors.disabled,
          ),
        ],
      ),
    );
  }
}
