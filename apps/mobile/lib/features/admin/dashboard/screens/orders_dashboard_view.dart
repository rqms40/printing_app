import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/dashboard/providers/orders_analytics_provider.dart';
import 'package:printing_app/shared/models/order.dart';

class OrdersDashboardView extends ConsumerWidget {
  const OrdersDashboardView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark ? AppColors.dark : AppColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final period = ref.watch(ordersAnalyticsPeriodProvider);
    final analytics = ref.watch(ordersAnalyticsProvider);
    final recentOrders = ref.watch(recentOrdersProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Header & Toolbar
        Container(
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderLg,
            boxShadow: isDark ? null : AppShadows.subtle,
            border: isDark ? Border.all(color: colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Orders', style: AppTypography.h3.copyWith(color: colors.onBackground)),
              const SizedBox(height: 4),
              Text(
                'Volume, turnaround, and demand trends for the selected range',
                style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 13),
              ),
              const SizedBox(height: AppSpacing.lg),
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SegmentedButton<DashboardAnalyticsPeriod>(
                  segments: const [
                    ButtonSegment(value: DashboardAnalyticsPeriod.days7, label: Text('7 Days')),
                    ButtonSegment(value: DashboardAnalyticsPeriod.days30, label: Text('30 Days')),
                    ButtonSegment(value: DashboardAnalyticsPeriod.months6, label: Text('6 Months')),
                  ],
                  selected: {period},
                  onSelectionChanged: (set) {
                    if (set.isNotEmpty) {
                      ref.read(ordersAnalyticsPeriodProvider.notifier).state = set.first;
                    }
                  },
                  showSelectedIcon: false,
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.resolveWith<Color>((states) {
                      if (states.contains(WidgetState.selected)) {
                        return colors.onBackground.withValues(alpha: 0.1);
                      }
                      return Colors.transparent;
                    }),
                    foregroundColor: WidgetStateProperty.resolveWith<Color>((states) {
                      if (states.contains(WidgetState.selected)) {
                        return colors.onBackground;
                      }
                      return colors.onSurfaceDim;
                    }),
                    padding: WidgetStateProperty.all(const EdgeInsets.symmetric(horizontal: AppSpacing.md)),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),

        // TAT Trend Chart
        _TatTrendChartCard(data: analytics.tatTrend, colors: colors, isDark: isDark),
        const SizedBox(height: AppSpacing.lg),

        // Volume Chart
        _OrderVolumeChartCard(data: analytics.volume, colors: colors, isDark: isDark),
        const SizedBox(height: AppSpacing.lg),

        // Paper Size Demand
        _PaperSizeDemandChartCard(data: analytics.paperSizeDemand, colors: colors, isDark: isDark),
        const SizedBox(height: AppSpacing.lg),

        // Recent Orders List
        _RecentOrdersCard(orders: recentOrders, colors: colors, isDark: isDark),
      ],
    );
  }
}

// ---------------------------------------------------------------------------
// Tat Trend Chart
// ---------------------------------------------------------------------------
class _TatTrendChartCard extends StatelessWidget {
  const _TatTrendChartCard({
    required this.data,
    required this.colors,
    required this.isDark,
  });

  final List<DashboardAnalyticsPoint> data;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();
    
    final maxY = data.fold<double>(0, (prev, point) => point.value > prev ? point.value.toDouble() : prev);
    
    return Container(
      height: 320,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        boxShadow: isDark ? null : AppShadows.subtle,
        border: isDark ? Border.all(color: colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Turnaround Time (TAT) Trend', style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 13, fontWeight: FontWeight.normal)),
          Divider(color: colors.outline.withValues(alpha: 0.5), height: AppSpacing.xl),
          Expanded(
            child: LineChart(
              LineChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxY > 0 ? (maxY / 4) : 1,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: colors.outline.withValues(alpha: 0.3),
                    strokeWidth: 1,
                    dashArray: [3, 3],
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 40,
                      interval: maxY > 0 ? (maxY / 4) : 1,
                      getTitlesWidget: (value, meta) {
                        final hours = (value / 60).floor();
                        return Text('${hours}h', style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11));
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: (data.length / 5).ceil().toDouble(),
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= data.length) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: 8.0),
                          child: Text(data[idx].label, style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11)),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                minX: 0,
                maxX: (data.length - 1).toDouble(),
                minY: 0,
                maxY: maxY * 1.2,
                lineTouchData: LineTouchData(
                  touchTooltipData: LineTouchTooltipData(
                    getTooltipColor: (_) => isDark ? const Color(0xFF2E2E2E) : Colors.white,
                    getTooltipItems: (touchedSpots) {
                      return touchedSpots.map((spot) {
                        final mins = spot.y.toInt();
                        final hrs = mins ~/ 60;
                        final rem = mins % 60;
                        return LineTooltipItem(
                          '${hrs}h ${rem}m',
                          AppTypography.caption.copyWith(color: isDark ? const Color(0xFFF0F0F0) : colors.onBackground),
                        );
                      }).toList();
                    },
                  ),
                ),
                lineBarsData: [
                  LineChartBarData(
                    spots: data.asMap().entries.map((e) => FlSpot(e.key.toDouble(), e.value.value.toDouble())).toList(),
                    isCurved: true,
                    color: const Color(0xFF34d399),
                    barWidth: 2.5,
                    isStrokeCapRound: true,
                    dotData: const FlDotData(show: false),
                    belowBarData: BarAreaData(
                      show: true,
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF34d399).withValues(alpha: 0.35),
                          const Color(0xFF34d399).withValues(alpha: 0.0),
                        ],
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Order Volume Chart
// ---------------------------------------------------------------------------
class _OrderVolumeChartCard extends StatelessWidget {
  const _OrderVolumeChartCard({
    required this.data,
    required this.colors,
    required this.isDark,
  });

  final List<DashboardAnalyticsPoint> data;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();
    
    final maxY = data.fold<double>(0, (prev, point) => point.value > prev ? point.value.toDouble() : prev);
    
    return Container(
      height: 320,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        boxShadow: isDark ? null : AppShadows.subtle,
        border: isDark ? Border.all(color: colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Order Volume', style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 13, fontWeight: FontWeight.normal)),
          Divider(color: colors.outline.withValues(alpha: 0.5), height: AppSpacing.xl),
          Expanded(
            child: BarChart(
              BarChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxY > 0 ? (maxY / 4) : 1,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: colors.outline.withValues(alpha: 0.3),
                    strokeWidth: 1,
                    dashArray: [3, 3],
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: maxY > 0 ? (maxY / 4) : 1,
                      getTitlesWidget: (value, meta) {
                        if (value % 1 != 0) return const SizedBox.shrink();
                        return Text(value.toInt().toString(), style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11));
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= data.length) return const SizedBox.shrink();
                        // Sparse labels to avoid overlap
                        if (data.length > 10 && idx % ((data.length / 5).ceil()) != 0) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: 8.0),
                          child: Text(data[idx].label, style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11)),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                maxY: maxY * 1.2,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) => isDark ? const Color(0xFF2E2E2E) : Colors.white,
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      return BarTooltipItem(
                        rod.toY.toInt().toString(),
                        AppTypography.caption.copyWith(color: isDark ? const Color(0xFFF0F0F0) : colors.onBackground),
                      );
                    },
                  ),
                ),
                barGroups: data.asMap().entries.map((e) {
                  return BarChartGroupData(
                    x: e.key,
                    barRods: [
                      BarChartRodData(
                        toY: e.value.value.toDouble(),
                        color: const Color(0xFF42A5F5),
                        width: data.length > 20 ? 4 : 12,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Paper Size Demand Chart
// ---------------------------------------------------------------------------
class _PaperSizeDemandChartCard extends StatelessWidget {
  const _PaperSizeDemandChartCard({
    required this.data,
    required this.colors,
    required this.isDark,
  });

  final List<DashboardAnalyticsPoint> data;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    if (data.isEmpty) return const SizedBox.shrink();
    
    final maxY = data.fold<double>(0, (prev, point) => point.value > prev ? point.value.toDouble() : prev);
    
    return Container(
      height: 340,
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        boxShadow: isDark ? null : AppShadows.subtle,
        border: isDark ? Border.all(color: colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Paper Size Demand', style: AppTypography.h3.copyWith(color: colors.onBackground)),
          const SizedBox(height: 2),
          Text('Paper order counts by size for the selected period', style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11)),
          const SizedBox(height: AppSpacing.xl),
          Expanded(
            child: BarChart(
              BarChartData(
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  horizontalInterval: maxY > 0 ? (maxY / 4) : 1,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: colors.outline.withValues(alpha: 0.3),
                    strokeWidth: 1,
                    dashArray: [3, 3],
                  ),
                ),
                titlesData: FlTitlesData(
                  show: true,
                  topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      interval: maxY > 0 ? (maxY / 4) : 1,
                      getTitlesWidget: (value, meta) {
                        if (value % 1 != 0) return const SizedBox.shrink();
                        return Text(value.toInt().toString(), style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 11));
                      },
                    ),
                  ),
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 30,
                      getTitlesWidget: (value, meta) {
                        final idx = value.toInt();
                        if (idx < 0 || idx >= data.length) return const SizedBox.shrink();
                        return Padding(
                          padding: const EdgeInsets.only(top: 8.0),
                          child: Text(data[idx].label, style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 10)),
                        );
                      },
                    ),
                  ),
                ),
                borderData: FlBorderData(show: false),
                maxY: maxY * 1.2,
                barTouchData: BarTouchData(
                  touchTooltipData: BarTouchTooltipData(
                    getTooltipColor: (_) => isDark ? const Color(0xFF2E2E2E) : Colors.white,
                    getTooltipItem: (group, groupIndex, rod, rodIndex) {
                      return BarTooltipItem(
                        rod.toY.toInt().toString(),
                        AppTypography.caption.copyWith(color: isDark ? const Color(0xFFF0F0F0) : colors.onBackground),
                      );
                    },
                  ),
                ),
                barGroups: data.asMap().entries.map((e) {
                  return BarChartGroupData(
                    x: e.key,
                    barRods: [
                      BarChartRodData(
                        toY: e.value.value.toDouble(),
                        color: const Color(0xFFFFDE58),
                        width: 14,
                        borderRadius: const BorderRadius.vertical(top: Radius.circular(4)),
                      ),
                    ],
                  );
                }).toList(),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Recent Orders Table/List
// ---------------------------------------------------------------------------
class _RecentOrdersCard extends StatelessWidget {
  const _RecentOrdersCard({
    required this.orders,
    required this.colors,
    required this.isDark,
  });

  final List<Order> orders;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    if (orders.isEmpty) return const SizedBox.shrink();
    
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        boxShadow: isDark ? null : AppShadows.subtle,
        border: isDark ? Border.all(color: colors.outline.withValues(alpha: 0.5), width: 0.5) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Orders', style: AppTypography.h3.copyWith(color: colors.onBackground)),
          Divider(color: colors.outline.withValues(alpha: 0.5), height: AppSpacing.xl),
          ...orders.map((o) {
            final isPaper = o.category == 'paper';
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 8.0),
              child: Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(o.orderId.toUpperCase(), style: AppTypography.caption.copyWith(color: colors.onBackground, fontWeight: FontWeight.w600, fontFamily: 'monospace')),
                  ),
                  Expanded(
                    flex: 1,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: isPaper ? const Color(0xFF42A5F5).withValues(alpha: 0.2) : const Color(0xFFAB47BC).withValues(alpha: 0.2),
                        borderRadius: AppRadius.borderSm,
                      ),
                      child: Text(
                        isPaper ? 'Paper' : '3D',
                        style: AppTypography.caption.copyWith(color: isPaper ? const Color(0xFF42A5F5) : const Color(0xFFAB47BC), fontSize: 10, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    flex: 2,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: colors.surfaceVariant,
                        borderRadius: AppRadius.borderSm,
                      ),
                      child: Text(
                        o.orderStatus.name.replaceAll(RegExp(r'([A-Z])'), r' $1').trim(),
                        style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 10),
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
