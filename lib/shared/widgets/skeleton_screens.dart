import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/shared/widgets/skeleton_loader.dart';

/// Skeleton for order list screens (orders, queue, deliveries, history).
class OrderListSkeleton extends StatelessWidget {
  const OrderListSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        children: List.generate(
          4,
          (i) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonLoader.circle(size: 44),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLoader.text(width: 140 + (i * 20).toDouble()),
                      const SizedBox(height: AppSpacing.sm),
                      const SkeletonLoader.text(width: 200),
                      const SizedBox(height: AppSpacing.sm),
                      const SkeletonLoader.text(width: 80),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Skeleton for dashboard KPI cards + charts.
class DashboardSkeleton extends StatelessWidget {
  const DashboardSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xl,
        vertical: AppSpacing.lg,
      ),
      children: [
        // Title skeleton
        const SkeletonLoader.text(width: 160, height: 24),
        const SizedBox(height: AppSpacing.lg),

        // 2x2 KPI grid
        GridView.count(
          crossAxisCount: 2,
          crossAxisSpacing: AppSpacing.md,
          mainAxisSpacing: AppSpacing.md,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          childAspectRatio: 1.3,
          children: List.generate(4, (_) => const SkeletonLoader.card()),
        ),
        const SizedBox(height: AppSpacing.lg),

        // Chart skeleton 1
        const SkeletonLoader.card(height: 200),
        const SizedBox(height: AppSpacing.lg),

        // Chart skeleton 2
        const SkeletonLoader.card(height: 200),
      ],
    );
  }
}

/// Skeleton for notification list (circle avatar + text lines).
class NotificationListSkeleton extends StatelessWidget {
  const NotificationListSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        children: List.generate(
          5,
          (i) => Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.md,
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const SkeletonLoader.circle(size: 40),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SkeletonLoader.text(width: 120 + (i * 16).toDouble()),
                      const SizedBox(height: AppSpacing.sm),
                      const SkeletonLoader.text(width: 220),
                      const SizedBox(height: AppSpacing.sm),
                      const SkeletonLoader.text(width: 60),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
