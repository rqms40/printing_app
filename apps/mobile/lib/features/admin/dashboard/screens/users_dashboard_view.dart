import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/dashboard/providers/users_analytics_provider.dart';
import 'package:printing_app/shared/widgets/app_card.dart';

class UsersDashboardView extends ConsumerWidget {
  const UsersDashboardView({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(usersAnalyticsProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    if (state.isLoading && state.record == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: CircularProgressIndicator(color: colors.accent),
        ),
      );
    }

    if (state.error != null && state.record == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Text(
            'Error: ${state.error}',
            style: AppTypography.body.copyWith(color: colors.error),
          ),
        ),
      );
    }

    final record = state.record;
    if (record == null) return const SizedBox.shrink();

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.lg),
      physics: const NeverScrollableScrollPhysics(),
      shrinkWrap: true,
      children: [
        _buildRoleDistribution(record.summary.roleCounts, colors),
        const SizedBox(height: AppSpacing.lg),
        _buildActivitySplit(record.activitySplit, colors),
        const SizedBox(height: AppSpacing.lg),
        _buildMixChart(
          title: 'Profile Category Mix',
          data: record.profileCategoryMix,
          colors: colors,
          palette: const [
            Color(0xFF1E88E5),
            Color(0xFF2196F3),
            Color(0xFF42A5F5),
            Color(0xFF64B5F6),
            Color(0xFF90CAF9),
            Color(0xFFBBDEFB),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildMixChart(
          title: 'Profile Field Mix',
          data: record.profileFieldMix,
          colors: colors,
          palette: const [
            Color(0xFFFBC02D),
            Color(0xFFFDD835),
            Color(0xFFFFEB3B),
            Color(0xFFFFEE58),
            Color(0xFFFFF176),
            Color(0xFFFFF59D),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        _buildMixChart(
          title: 'Preference Mix',
          data: record.preferenceMix,
          colors: colors,
          palette: const [
            Color(0xFF388E3C),
            Color(0xFF43A047),
            Color(0xFF4CAF50),
            Color(0xFF66BB6A),
            Color(0xFF81C784),
            Color(0xFFA5D6A7),
          ],
        ),
      ],
    );
  }

  Widget _buildRoleDistribution(RoleCounts roles, AppColorSet colors) {
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Role Distribution',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: _buildStatBadge('Customers', '${roles.customers}', colors),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _buildStatBadge('Drivers', '${roles.drivers}', colors),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _buildStatBadge('Admins', '${roles.admins}', colors),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActivitySplit(List<AnalyticsPoint> split, AppColorSet colors) {
    if (split.isEmpty) return const SizedBox.shrink();
    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Activity Split',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.md),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: split.map((pt) {
                return Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.md),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.md, vertical: AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      borderRadius: AppRadius.borderMd,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${pt.value.toInt()}',
                          style: AppTypography.h3
                              .copyWith(color: colors.onBackground),
                        ),
                        Text(
                          pt.label,
                          style: AppTypography.caption
                              .copyWith(color: colors.onSurfaceDim),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMixChart({
    required String title,
    required List<AnalyticsPoint> data,
    required AppColorSet colors,
    required List<Color> palette,
  }) {
    if (data.isEmpty) return const SizedBox.shrink();
    
    final maxY = data
        .map((e) => e.value)
        .reduce((a, b) => a > b ? a : b);

    return AppCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          const SizedBox(height: AppSpacing.xl),
          SizedBox(
            height: 220,
            child: BarChart(
              BarChartData(
                alignment: BarChartAlignment.spaceAround,
                maxY: maxY * 1.2,
                barTouchData: BarTouchData(enabled: false),
                titlesData: FlTitlesData(
                  show: true,
                  bottomTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 40,
                      getTitlesWidget: (value, meta) {
                        final index = value.toInt();
                        if (index < 0 || index >= data.length) {
                          return const SizedBox.shrink();
                        }
                        return Padding(
                          padding: const EdgeInsets.only(top: 8.0),
                          child: Text(
                            data[index].label,
                            style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim, fontSize: 10),
                            maxLines: 2,
                            textAlign: TextAlign.center,
                          ),
                        );
                      },
                    ),
                  ),
                  leftTitles: AxisTitles(
                    sideTitles: SideTitles(
                      showTitles: true,
                      reservedSize: 24,
                      interval: maxY > 0 ? (maxY / 4).ceilToDouble() : 1,
                      getTitlesWidget: (value, meta) {
                        if (value % 1 != 0) return const SizedBox.shrink();
                        return Text(
                          value.toInt().toString(),
                          style: AppTypography.caption.copyWith(color: colors.onSurfaceDim, fontSize: 10),
                        );
                      },
                    ),
                  ),
                  topTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                  rightTitles: const AxisTitles(
                    sideTitles: SideTitles(showTitles: false),
                  ),
                ),
                gridData: FlGridData(
                  show: true,
                  drawVerticalLine: false,
                  getDrawingHorizontalLine: (value) => FlLine(
                    color: colors.surfaceDim.withValues(alpha: 0.2),
                    strokeWidth: 1,
                  ),
                ),
                borderData: FlBorderData(show: false),
                barGroups: data.asMap().entries.map((e) {
                  final color = palette[e.key % palette.length];
                  return BarChartGroupData(
                    x: e.key,
                    barRods: [
                      BarChartRodData(
                        toY: e.value.value,
                        color: color,
                        width: 22,
                        borderRadius: const BorderRadius.vertical(
                            top: Radius.circular(4)),
                      )
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

  Widget _buildStatBadge(String label, String value, AppColorSet colors) {
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderMd,
      ),
      child: Column(
        children: [
          Text(value, style: AppTypography.h3.copyWith(color: colors.onBackground)),
          Text(
            label,
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }
}
