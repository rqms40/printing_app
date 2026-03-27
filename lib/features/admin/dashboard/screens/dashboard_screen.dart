import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/dashboard/providers/dashboard_provider.dart';
import 'package:printing_app/features/admin/dashboard/widgets/sales_chart.dart';
import 'package:printing_app/features/admin/dashboard/widgets/volume_chart.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';
import 'package:printing_app/utils/formatters.dart';

/// Admin dashboard with bento-style KPI grid and charts.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _isLoading = true;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 500), () {
      if (mounted) setState(() => _isLoading = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return ColoredBox(
        color: _colors(context).background,
        child: const SafeArea(child: DashboardSkeleton()),
      );
    }

    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final kpis = ref.watch(dashboardKpisProvider);

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: RefreshIndicator(
          color: colors.accent,
          onRefresh: () async {
            await Future<void>.delayed(const Duration(milliseconds: 500));
          },
          child: ListView(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.xl,
              vertical: AppSpacing.lg,
            ),
            children: [
              // Title
              Text(
                'Dashboard',
                style: AppTypography.h1.copyWith(color: colors.onBackground),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.lg),

              // Bento KPI Grid
              /// ```
              /// ┌──────────┬──────────┐
              /// │ Revenue  │  New     │
              /// │  2×1     │ Orders   │
              /// │ (large)  │  1×1     │
              /// │          ├──────────┤
              /// │          │ In Prod  │
              /// │          │  1×1     │
              /// ├──────────┼──────────┤
              /// │  Ready   │Delivered │
              /// │   1×1    │  1×1     │
              /// └──────────┴──────────┘
              /// ```
              StaggeredGrid.count(
                crossAxisCount: 2,
                mainAxisSpacing: 10,
                crossAxisSpacing: 10,
                children: [
                  // Revenue — hero KPI (1×2 tall)
                  StaggeredGridTile.count(
                    crossAxisCellCount: 1,
                    mainAxisCellCount: 2,
                    child: _KpiBentoTile(
                      icon: HugeIcons.strokeRoundedMoneyReceive01,
                      value: formatCurrency(kpis.monthlyRevenue),
                      label: 'Monthly Revenue',
                      isHero: true,
                      accentColor: colors.success,
                      colors: colors,
                      isDark: isDark,
                    ),
                  ),
                  // New Orders (1×1)
                  StaggeredGridTile.count(
                    crossAxisCellCount: 1,
                    mainAxisCellCount: 1,
                    child: _KpiBentoTile(
                      icon: HugeIcons.strokeRoundedFile02,
                      value: kpis.newOrdersCount.toString(),
                      label: 'New Orders',
                      accentColor: colors.info,
                      colors: colors,
                      isDark: isDark,
                    ),
                  ),
                  // In Production (1×1)
                  StaggeredGridTile.count(
                    crossAxisCellCount: 1,
                    mainAxisCellCount: 1,
                    child: _KpiBentoTile(
                      icon: HugeIcons.strokeRoundedPrinter,
                      value: kpis.inProductionCount.toString(),
                      label: 'In Production',
                      accentColor: colors.warning,
                      colors: colors,
                      isDark: isDark,
                    ),
                  ),
                  // Ready for Pickup (1×1)
                  StaggeredGridTile.count(
                    crossAxisCellCount: 1,
                    mainAxisCellCount: 1,
                    child: _KpiBentoTile(
                      icon: HugeIcons.strokeRoundedPackageDelivered,
                      value: kpis.readyForPickupCount.toString(),
                      label: 'Ready',
                      accentColor: colors.success,
                      colors: colors,
                      isDark: isDark,
                    ),
                  ),
                  // Delivered This Month (1×1)
                  StaggeredGridTile.count(
                    crossAxisCellCount: 1,
                    mainAxisCellCount: 1,
                    child: _KpiBentoTile(
                      icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                      value: '${kpis.deliveredCount}',
                      label: 'Delivered',
                      accentColor: colors.info,
                      colors: colors,
                      isDark: isDark,
                    ),
                  ),
                ],
              )
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 80.ms,
                      curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.lg),

              // Sales chart
              const SalesChart()
                  .animate()
                  .fadeIn(
                      duration: 450.ms,
                      delay: 200.ms,
                      curve: Curves.easeOutCubic),
              const SizedBox(height: AppSpacing.lg),

              // Volume chart
              const VolumeChart()
                  .animate()
                  .fadeIn(
                      duration: 450.ms,
                      delay: 280.ms,
                      curve: Curves.easeOutCubic),
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Bento-style KPI tile
// ---------------------------------------------------------------------------
class _KpiBentoTile extends StatelessWidget {
  const _KpiBentoTile({
    required this.icon,
    required this.value,
    required this.label,
    required this.accentColor,
    required this.colors,
    required this.isDark,
    this.isHero = false,
  });

  final dynamic icon;
  final String value;
  final String label;
  final Color accentColor;
  final AppColorSet colors;
  final bool isDark;
  final bool isHero;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: isHero
            ? (isDark ? colors.surfaceVariant : colors.accent)
            : colors.surface,
        borderRadius: AppRadius.borderLg,
        boxShadow: isDark ? null : AppShadows.subtle,
        border: (!isHero && isDark)
            ? Border.all(
                color: colors.outline.withValues(alpha: 0.5), width: 0.5)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:
            isHero ? MainAxisAlignment.spaceBetween : MainAxisAlignment.center,
        children: [
          // Icon with accent tint
          Container(
            width: isHero ? 40 : 34,
            height: isHero ? 40 : 34,
            decoration: BoxDecoration(
              color: isHero
                  ? (isDark ? colors.onBackground : colors.background)
                      .withValues(alpha: 0.15)
                  : accentColor.withValues(alpha: 0.1),
              borderRadius: AppRadius.borderMd,
            ),
            child: Center(
              child: HugeIcon(
                icon: icon,
                size: isHero ? 20 : 16,
                color: isHero
                    ? (isDark ? colors.onBackground : colors.background)
                    : accentColor,
              ),
            ),
          ),
          if (isHero) const Spacer(),
          if (!isHero) const SizedBox(height: AppSpacing.sm),
          // Value
          Text(
            value,
            style: (isHero ? AppTypography.h1 : AppTypography.h2).copyWith(
              color: isHero
                  ? (isDark ? colors.onBackground : colors.background)
                  : colors.onBackground,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 2),
          // Label
          Text(
            label,
            style: AppTypography.caption.copyWith(
              color: (isHero
                      ? (isDark ? colors.onBackground : colors.background)
                      : colors.onSurfaceDim)
                  .withValues(alpha: 0.7),
              fontSize: 11,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
