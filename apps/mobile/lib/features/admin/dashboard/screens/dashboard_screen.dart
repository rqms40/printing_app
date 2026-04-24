import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/admin/dashboard/providers/dashboard_provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';
import 'package:printing_app/features/admin/dashboard/screens/users_dashboard_view.dart';
import 'package:printing_app/features/admin/dashboard/screens/orders_dashboard_view.dart';

enum DashboardTab { operations, orders, users }

/// Admin dashboard — clean KPI layout + charts.
class DashboardScreen extends ConsumerStatefulWidget {
  const DashboardScreen({super.key});

  @override
  ConsumerState<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends ConsumerState<DashboardScreen> {
  bool _isLoading = true;
  DashboardTab _selectedTab = DashboardTab.operations;

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

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
              ).animate().fadeIn(duration: 350.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.lg),

              // Segmented Control
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: SegmentedButton<DashboardTab>(
                  segments: const [
                    ButtonSegment(
                      value: DashboardTab.operations,
                      label: Text('Operations'),
                      icon: HugeIcon(icon: HugeIcons.strokeRoundedActivity01, size: 18, color: Colors.transparent),
                    ),
                    ButtonSegment(
                      value: DashboardTab.orders,
                      label: Text('Orders'),
                      icon: HugeIcon(icon: HugeIcons.strokeRoundedPackage, size: 18, color: Colors.transparent),
                    ),
                    ButtonSegment(
                      value: DashboardTab.users,
                      label: Text('Users'),
                      icon: HugeIcon(icon: HugeIcons.strokeRoundedUserGroup, size: 18, color: Colors.transparent),
                    ),
                  ],
                  selected: {_selectedTab},
                  onSelectionChanged: (Set<DashboardTab> newSelection) {
                    setState(() {
                      _selectedTab = newSelection.first;
                    });
                  },
                  showSelectedIcon: false,
                  style: ButtonStyle(
                    backgroundColor: WidgetStateProperty.resolveWith<Color>(
                      (Set<WidgetState> states) {
                        if (states.contains(WidgetState.selected)) {
                          return colors.onBackground.withValues(alpha: 0.1);
                        }
                        return Colors.transparent;
                      },
                    ),
                    foregroundColor: WidgetStateProperty.resolveWith<Color>(
                      (Set<WidgetState> states) {
                        if (states.contains(WidgetState.selected)) {
                          return colors.onBackground;
                        }
                        return colors.onSurfaceDim;
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.lg),

              // Tab Content
              if (_selectedTab == DashboardTab.operations) ...[
                // TAT hero card — full width
                _TatCard(
                  value: '${kpis.avgTatMins} mins',
                  colors: colors,
                  isDark: isDark,
                ).animate().fadeIn(
                    duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
                const SizedBox(height: 10),

                // 4 KPI tiles in 2×2
                Row(
                  children: [
                    Expanded(
                      child: _KpiTile(
                        icon: HugeIcons.strokeRoundedFile02,
                        value: '${kpis.newOrdersCount}',
                        label: 'New Orders',
                        accentColor: colors.info,
                        colors: colors,
                        isDark: isDark,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _KpiTile(
                        icon: HugeIcons.strokeRoundedPrinter,
                        value: '${kpis.inProductionCount}',
                        label: 'In Production',
                        accentColor: colors.warning,
                        colors: colors,
                        isDark: isDark,
                      ),
                    ),
                  ],
                ).animate().fadeIn(
                    duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
                const SizedBox(height: 10),
                Row(
                  children: [
                    Expanded(
                      child: _KpiTile(
                        icon: HugeIcons.strokeRoundedPackageDelivered,
                        value: '${kpis.readyForPickupCount}',
                        label: 'Ready',
                        accentColor: colors.success,
                        colors: colors,
                        isDark: isDark,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: _KpiTile(
                        icon: HugeIcons.strokeRoundedCheckmarkCircle02,
                        value: '${kpis.deliveredCount}',
                        label: 'Delivered',
                        accentColor: colors.success,
                        colors: colors,
                        isDark: isDark,
                      ),
                    ),
                  ],
                ).animate().fadeIn(
                    duration: 400.ms, delay: 160.ms, curve: Curves.easeOut),
              ] else if (_selectedTab == DashboardTab.orders) ...[
                const OrdersDashboardView(),
              ] else ...[
                const UsersDashboardView(),
              ],
              const SizedBox(height: AppSpacing.lg),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Average Turnaround Time
// ---------------------------------------------------------------------------
class _TatCard extends StatelessWidget {
  const _TatCard({
    required this.value,
    required this.colors,
    required this.isDark,
  });

  final String value;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final textColor = isDark ? colors.onBackground : colors.accentOnColor;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: isDark ? colors.surfaceVariant : colors.accent,
        borderRadius: AppRadius.borderLg,
      ),
      child: Row(
        children: [
          // Icon
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: textColor.withValues(alpha: 0.15),
              borderRadius: AppRadius.borderMd,
            ),
            child: Center(
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedTime01,
                size: 22,
                color: textColor,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          // Value + label
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Average Turnaround Time',
                  style: AppTypography.caption.copyWith(
                    color: textColor.withValues(alpha: 0.7),
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: AppTypography.h1.copyWith(
                    color: textColor,
                  ),
                ),
              ],
            ),
          ),
          // Trend indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: textColor.withValues(alpha: 0.15),
              borderRadius: AppRadius.borderFull,
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedArrowDown01,
                  size: 14,
                  color: textColor,
                ),
                const SizedBox(width: 2),
                Text(
                  '5%',
                  style: AppTypography.caption.copyWith(
                    color: textColor,
                    fontWeight: FontWeight.w600,
                    fontSize: 12,
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
// KPI tile — compact metric card
// ---------------------------------------------------------------------------
class _KpiTile extends StatelessWidget {
  const _KpiTile({
    required this.icon,
    required this.value,
    required this.label,
    required this.accentColor,
    required this.colors,
    required this.isDark,
  });

  final dynamic icon;
  final String value;
  final String label;
  final Color accentColor;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        boxShadow: isDark ? null : AppShadows.subtle,
        border: isDark
            ? Border.all(
                color: colors.outline.withValues(alpha: 0.5), width: 0.5)
            : null,
      ),
      child: Row(
        children: [
          // Accent-tinted icon
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: accentColor.withValues(alpha: 0.1),
              borderRadius: AppRadius.borderSm,
            ),
            child: Center(
              child: HugeIcon(
                icon: icon,
                size: 18,
                color: accentColor,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          // Value + label
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value,
                  style: AppTypography.h3.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                Text(
                  label,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
