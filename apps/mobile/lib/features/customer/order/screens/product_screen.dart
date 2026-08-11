import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/widgets/catalog_product_card.dart';
import 'package:printing_app/features/customer/order/widgets/catalog_authority_banner.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';

class ProductScreen extends ConsumerWidget {
  const ProductScreen({super.key, required this.groupSlug});

  final String groupSlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final catalogState = ref.watch(productCatalogProvider);
    final group = catalogState.catalog.groupBySlug(groupSlug);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        title: Text(group?.name ?? 'Products'),
      ),
      body: SafeArea(
        child: group == null
            ? _MissingGroup(colors: colors)
            : ListView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.xxl,
                ),
                children: [
                  Text(
                    'Choose a product',
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    group.description,
                    style: AppTypography.bodyLarge.copyWith(
                      color: colors.onSurface,
                    ),
                  ),
                  if (catalogState.isLoading || catalogState.error != null) ...[
                    const SizedBox(height: AppSpacing.md),
                    CatalogAuthorityBanner(
                      state: catalogState,
                      onRetry: () =>
                          ref.read(productCatalogProvider.notifier).retry(),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.xl),
                  for (final product in group.products) ...[
                    CatalogProductCard(
                      key: ValueKey('catalog-product-${product.slug}'),
                      product: product,
                      onTap: () => _selectProduct(context, ref, product),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              ),
      ),
    );
  }

  void _selectProduct(
    BuildContext context,
    WidgetRef ref,
    ProductCategory product,
  ) {
    final tutorial = ref.read(pipelineTutorialProvider);
    if (tutorial.active && tutorial.step == PipelineStep.catalogProduct) {
      ref.read(pipelineTutorialProvider.notifier).advance();
    }
    context.push(
      '/customer/order/products/${Uri.encodeComponent(product.slug)}/requirements',
    );
  }
}

class _MissingGroup extends StatelessWidget {
  const _MissingGroup({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              'Product group unavailable',
              style: AppTypography.h2.copyWith(color: colors.onBackground),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'This group may have changed. Return to the catalog and choose another option.',
              style: AppTypography.body.copyWith(color: colors.onSurface),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: AppSpacing.lg),
            OutlinedButton(
              onPressed: () => context.go('/customer/order/new'),
              child: const Text('Back to catalog'),
            ),
          ],
        ),
      ),
    );
  }
}
