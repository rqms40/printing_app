import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/dashboard/providers/dashboard_provider.dart';
import 'package:printing_app/features/admin/dashboard/widgets/kpi_card.dart';
import 'package:printing_app/features/admin/dashboard/widgets/sales_chart.dart';
import 'package:printing_app/features/admin/dashboard/widgets/volume_chart.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';
import 'package:printing_app/utils/formatters.dart';

/// Admin dashboard screen showing KPIs and charts.
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
      return Scaffold(
        backgroundColor: _colors(context).background,
        body: const DashboardSkeleton(),
      );
    }

    final colors = _colors(context);
    final kpis = ref.watch(dashboardKpisProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: RefreshIndicator(
        color: colors.accent,
        onRefresh: () async {
          // In production, invalidate providers to re-fetch data.
          await Future<void>.delayed(const Duration(milliseconds: 500));
        },
        child: ListView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.lg,
          ),
          children: [
            // Greeting
            Text(
              'Dashboard',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            )
                .animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.lg),

            // 2x2 KPI grid
            GridView.count(
              crossAxisCount: 2,
              crossAxisSpacing: AppSpacing.md,
              mainAxisSpacing: AppSpacing.md,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.3,
              children: [
                KpiCard(
                  icon: HugeIcons.strokeRoundedFile02,
                  value: kpis.newOrdersCount.toString(),
                  label: 'New Orders',
                ),
                KpiCard(
                  icon: HugeIcons.strokeRoundedPrinter,
                  value: kpis.inProductionCount.toString(),
                  label: 'In Production',
                ),
                KpiCard(
                  icon: HugeIcons.strokeRoundedPackageDelivered,
                  value: kpis.readyForPickupCount.toString(),
                  label: 'Ready for Pickup',
                ),
                KpiCard(
                  icon: HugeIcons.strokeRoundedMoneyReceive01,
                  value: formatCurrency(kpis.monthlyRevenue),
                  label: 'Revenue',
                ),
              ],
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 80.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, delay: 80.ms, curve: Curves.easeOut),
            const SizedBox(height: AppSpacing.lg),

            // Sales chart
            const SalesChart()
                .animate()
                .fadeIn(duration: 450.ms, delay: 240.ms, curve: Curves.easeOutCubic)
                .slideY(begin: 0.04, duration: 450.ms, delay: 240.ms, curve: Curves.easeOutCubic),
            const SizedBox(height: AppSpacing.lg),

            // Volume chart
            const VolumeChart()
                .animate()
                .fadeIn(duration: 450.ms, delay: 320.ms, curve: Curves.easeOutCubic)
                .slideY(begin: 0.04, duration: 450.ms, delay: 320.ms, curve: Curves.easeOutCubic),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }
}
