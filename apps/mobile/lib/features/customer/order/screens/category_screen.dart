import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/widgets/catalog_group_card.dart';

/// Customer entry point for the grouped v1.10 product catalog.
class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({super.key, this.addMode = false});

  final bool addMode;

  static const routeName = '/order/category';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final catalogState = ref.watch(productCatalogProvider);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        title: Text(addMode ? 'Add to your order' : 'New Order'),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.lg,
            AppSpacing.md,
            AppSpacing.lg,
            AppSpacing.xxl,
          ),
          children: [
            if (addMode)
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.go('/customer/order/checkout'),
                  child: const Text('Skip — review checkout'),
                ),
              ),
            Text(
              'Browse by product group',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Choose the kind of product you need. We’ll confirm availability, price, and turnaround after review.',
              style: AppTypography.bodyLarge.copyWith(color: colors.onSurface),
            ),
            if (catalogState.error != null) ...[
              const SizedBox(height: AppSpacing.md),
              _CatalogWarning(
                onRetry: () =>
                    ref.read(productCatalogProvider.notifier).retry(),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            for (final group in catalogState.catalog.activeGroups) ...[
              CatalogGroupCard(
                key: ValueKey('catalog-group-${group.slug}'),
                group: group,
                icon: _groupIcon(group),
                onTap: () => context.push(
                  '/customer/order/groups/${Uri.encodeComponent(group.slug)}',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
            ],
          ],
        ),
      ),
    );
  }

  dynamic _groupIcon(ProductGroup group) => switch (group.slug) {
    'marketing-promo' => HugeIcons.strokeRoundedFile02,
    'corporate-merch' => HugeIcons.strokeRoundedPackage,
    'awards-signages' => HugeIcons.strokeRoundedCheckmarkBadge01,
    'specialized-prototyping' => HugeIcons.strokeRoundedCube,
    _ => HugeIcons.strokeRoundedPrinter,
  };
}

class _CatalogWarning extends StatelessWidget {
  const _CatalogWarning({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Semantics(
      liveRegion: true,
      label: 'Catalog connection warning',
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          border: Border.all(color: colors.warning),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            HugeIcon(
              icon: HugeIcons.strokeRoundedAlert02,
              size: 22,
              color: colors.warning,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Text(
                'Using the saved catalog for browsing. Reconnect before submitting a request.',
                style: AppTypography.body.copyWith(color: colors.onSurface),
              ),
            ),
            TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
