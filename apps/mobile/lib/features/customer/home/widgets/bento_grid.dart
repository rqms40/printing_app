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


/// Bento grid — exact design from commit a4c58c8 with ClipRRect overflow protection.
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

    return StaggeredGrid.count(
      crossAxisCount: 4,
      mainAxisSpacing: 10,
      crossAxisSpacing: 10,
      children: [
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 2,
          child: _HeroTile(colors: colors, isDark: isDark)
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut),
        ),
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 1,
          child: _ServiceTile(
            title: 'Paper Printing',
            subtitle: 'Docs & posters',
            icon: HugeIcons.strokeRoundedFile02,
            colors: colors,
            isDark: isDark,
            onTap: () => context.push('/customer/order/new'),
          ).animate().fadeIn(duration: 400.ms, delay: 80.ms, curve: Curves.easeOut),
        ),
        StaggeredGridTile.count(
          crossAxisCellCount: 2,
          mainAxisCellCount: 1,
          child: _ServiceTile(
            title: '3D Printing',
            subtitle: 'Models & prototypes',
            icon: HugeIcons.strokeRoundedPackageDelivered,
            colors: colors,
            isDark: isDark,
            onTap: () => context.push('/customer/order/new'),
          ).animate().fadeIn(duration: 400.ms, delay: 140.ms, curve: Curves.easeOut),
        ),
        StaggeredGridTile.count(
          crossAxisCellCount: 1,
          mainAxisCellCount: 1,
          child: _CountTile(
            count: '$activeOrderCount',
            label: 'Active',
            colors: colors,
            isDark: isDark,
            onTap: () => context.go('/customer/orders'),
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms, curve: Curves.easeOut),
        ),
        StaggeredGridTile.count(
          crossAxisCellCount: 3,
          mainAxisCellCount: 1,
          child: _PromoTile(colors: colors, isDark: isDark)
              .animate()
              .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),
        ),
      ],
    );
  }
}

class _HeroTile extends StatelessWidget {
  const _HeroTile({required this.colors, required this.isDark});
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? colors.surfaceVariant : colors.accent,
          borderRadius: AppRadius.borderLg,
        ),
        child: Stack(
          fit: StackFit.expand,
          clipBehavior: Clip.hardEdge,
          children: [
            // GIF Background at reduced opacity
            Opacity(
              opacity: 0.45,
              child: Image.asset(
                'assets/animations/bentobox.gif',
                fit: BoxFit.cover,
              ),
            ),

            // Dark scrim gradient so text remains readable
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.1),
                    Colors.black.withValues(alpha: 0.55),
                  ],
                ),
              ),
            ),

            // Content
            Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  Flexible(
                    child: Text(
                      'GRID',
                      style: AppTypography.display.copyWith(
                        color: Colors.white,
                        height: 1.0,
                        fontSize: 48,
                      ),
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    'Paper, 3D, Delivered',
                    style: AppTypography.caption.copyWith(
                      color: Colors.white.withValues(alpha: 0.75),
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceTile extends StatefulWidget {
  const _ServiceTile({required this.title, required this.subtitle, required this.icon, required this.colors, required this.isDark, this.onTap});
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
      onTapUp: (_) { setState(() => _pressed = false); widget.onTap?.call(); },
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale: _pressed ? 0.97 : 1.0,
        duration: const Duration(milliseconds: 100),
        curve: Curves.easeOut,
        child: ClipRRect(
          borderRadius: AppRadius.borderLg,
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: widget.colors.surface,
              borderRadius: AppRadius.borderLg,
              boxShadow: widget.isDark ? null : AppShadows.subtle,
              border: widget.isDark ? Border.all(color: widget.colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(widget.title, style: AppTypography.bodyBold.copyWith(color: widget.colors.onBackground, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 2),
                      Text(widget.subtitle, style: AppTypography.caption.copyWith(color: widget.colors.onSurfaceDim, fontSize: 11), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                HugeIcon(icon: widget.icon, size: 22, color: widget.colors.onSurfaceDim),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _CountTile extends StatelessWidget {
  const _CountTile({required this.count, required this.label, required this.colors, required this.isDark, this.onTap});
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
        borderRadius: AppRadius.borderLg,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderLg,
            boxShadow: isDark ? null : AppShadows.subtle,
            border: isDark ? Border.all(color: colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
          ),
          child: FittedBox(
            fit: BoxFit.scaleDown,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(count, style: AppTypography.h1.copyWith(color: colors.brand)),
                Text(label, style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PromoTile extends StatelessWidget {
  const _PromoTile({required this.colors, required this.isDark});
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: AppRadius.borderLg,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        decoration: BoxDecoration(
          color: isDark ? colors.surfaceVariant : colors.accent.withValues(alpha: 0.05),
          borderRadius: AppRadius.borderLg,
          border: Border.all(color: colors.outline.withValues(alpha: 0.3), width: 0.5),
        ),
        child: Row(
          children: [
            HugeIcon(icon: HugeIcons.strokeRoundedDiscount, size: 20, color: colors.brand),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('20% off large format prints', style: AppTypography.bodyBold.copyWith(color: colors.onBackground, fontSize: 13), maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text('Limited time offer', style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11)),
                ],
              ),
            ),
            HugeIcon(icon: HugeIcons.strokeRoundedArrowRight01, size: 16, color: colors.disabled),
          ],
        ),
      ),
    );
  }
}
