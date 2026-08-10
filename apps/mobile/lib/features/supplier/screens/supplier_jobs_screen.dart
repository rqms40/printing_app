import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/supplier/models/supplier_job.dart';
import 'package:printing_app/features/supplier/providers/supplier_jobs_provider.dart';
import 'package:printing_app/features/supplier/widgets/supplier_job_card.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';
import 'package:printing_app/shared/widgets/skeleton_screens.dart';

/// Supplier jobs inbox — filter chips + pull-to-refresh list.
class SupplierJobsScreen extends ConsumerWidget {
  const SupplierJobsScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final state = ref.watch(supplierJobsProvider);
    final notifier = ref.read(supplierJobsProvider.notifier);

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.xl,
                AppSpacing.lg,
                AppSpacing.xl,
                AppSpacing.md,
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: AppColors.brandLogo,
                                borderRadius: AppRadius.borderFull,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Flexible(
                              child: Text(
                                'Jobs',
                                style: AppTypography.h1.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Assigned print jobs and production queue',
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'Refresh jobs',
                    onPressed: state.isRefreshing
                        ? null
                        : () => notifier.refresh(silent: true),
                    icon: state.isRefreshing
                        ? SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: colors.accent,
                            ),
                          )
                        : ExcludeSemantics(
                            child: HugeIcon(
                              icon: HugeIcons.strokeRoundedRefresh,
                              color: colors.onBackground,
                              size: 22,
                            ),
                          ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 350.ms)
                .slideY(begin: 0.02, duration: 350.ms),

            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: SizedBox(
                height: 40,
                child: ListView.separated(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl,
                  ),
                  itemCount: SupplierJobListFilter.values.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: AppSpacing.sm),
                  itemBuilder: (context, index) {
                    final filter = SupplierJobListFilter.values[index];
                    final active = state.filter == filter;
                    return GestureDetector(
                      onTap: () => notifier.setFilter(filter),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 180),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          color: active
                              ? colors.accent
                              : colors.surfaceVariant,
                          borderRadius: AppRadius.borderFull,
                          border: Border.all(
                            color: active ? colors.accent : colors.outline,
                          ),
                        ),
                        child: Text(
                          filter.label,
                          style: AppTypography.caption.copyWith(
                            color: active
                                ? colors.accentOnColor
                                : colors.onSurface,
                            fontWeight:
                                active ? FontWeight.w700 : FontWeight.w500,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
            ).animate().fadeIn(duration: 350.ms, delay: 40.ms),

            if (state.errorMessage != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  0,
                  AppSpacing.xl,
                  AppSpacing.sm,
                ),
                child: Text(
                  state.errorMessage!,
                  style: AppTypography.caption.copyWith(color: colors.warning),
                ),
              ),

            Expanded(
              child: state.isLoading
                  ? const OrderListSkeleton()
                  : RefreshIndicator(
                      color: colors.accent,
                      onRefresh: () => notifier.refresh(silent: true),
                      child: state.jobs.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: [
                                EmptyState(
                                  heading: switch (state.filter) {
                                    SupplierJobListFilter.assigned =>
                                      'No assigned jobs',
                                    SupplierJobListFilter.accepted =>
                                      'No accepted jobs',
                                    SupplierJobListFilter.inProduction =>
                                      'Nothing in production',
                                    SupplierJobListFilter.all =>
                                      'No jobs yet',
                                  },
                                  body: switch (state.filter) {
                                    SupplierJobListFilter.assigned =>
                                      'New QA-approved assignments will appear here.',
                                    SupplierJobListFilter.accepted =>
                                      'Accepted jobs waiting on payment show up here.',
                                    SupplierJobListFilter.inProduction =>
                                      'Jobs in production or self-QC appear here.',
                                    SupplierJobListFilter.all =>
                                      'When ops assigns a job to you, it lands in this inbox.',
                                  },
                                  icon: HugeIcons.strokeRoundedPackage,
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.fromLTRB(
                                AppSpacing.xl,
                                AppSpacing.sm,
                                AppSpacing.xl,
                                AppSpacing.xxl,
                              ),
                              itemCount: state.jobs.length,
                              separatorBuilder: (_, _) =>
                                  const SizedBox(height: AppSpacing.md),
                              itemBuilder: (context, index) {
                                final job = state.jobs[index];
                                return SupplierJobCard(
                                  job: job,
                                  onTap: () => context.push(
                                    '/supplier/jobs/${job.id}',
                                  ),
                                );
                              },
                            ),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
