import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/dashboard/providers/dashboard_provider.dart';
import 'package:printing_app/features/admin/dashboard/widgets/kpi_card.dart';
import 'package:printing_app/features/admin/dashboard/widgets/sales_chart.dart';
import 'package:printing_app/features/admin/dashboard/widgets/volume_chart.dart';
import 'package:printing_app/utils/formatters.dart';

/// Admin dashboard screen showing KPIs and charts.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
            ),
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
                  icon: Iconsax.document_text,
                  value: kpis.newOrdersCount.toString(),
                  label: 'New Orders',
                ),
                KpiCard(
                  icon: Iconsax.printer,
                  value: kpis.inProductionCount.toString(),
                  label: 'In Production',
                ),
                KpiCard(
                  icon: Iconsax.box_1,
                  value: kpis.readyForPickupCount.toString(),
                  label: 'Ready for Pickup',
                ),
                KpiCard(
                  icon: Iconsax.money_recive,
                  value: formatCurrency(kpis.monthlyRevenue),
                  label: 'Revenue',
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),

            // Sales chart
            const SalesChart(),
            const SizedBox(height: AppSpacing.lg),

            // Volume chart
            const VolumeChart(),
            const SizedBox(height: AppSpacing.lg),
          ],
        ),
      ),
    );
  }
}
