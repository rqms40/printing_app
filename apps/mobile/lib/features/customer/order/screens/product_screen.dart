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
                      onTap: () => _selectProduct(context, product),
                    ),
                    const SizedBox(height: AppSpacing.md),
                  ],
                ],
              ),
      ),
    );
  }

  void _selectProduct(BuildContext context, ProductCategory product) {
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

/// Route boundary for the generic requirements flow implemented in Task 11.
///
/// Keeping the boundary catalog-aware prevents new RFQ leaves from ever
/// falling through to the historical Paper/3D draft screens.
class CatalogRequirementsRouteBoundary extends ConsumerWidget {
  const CatalogRequirementsRouteBoundary({
    super.key,
    required this.productSlug,
  });

  final String productSlug;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final product = ref
        .watch(productCatalogProvider)
        .catalog
        .productBySlug(productSlug);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: Text(product?.name ?? 'Product requirements')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Text(
            product == null
                ? 'This product is no longer available.'
                : 'Product requirements',
            style: AppTypography.h2.copyWith(color: colors.onBackground),
            textAlign: TextAlign.center,
          ),
        ),
      ),
    );
  }
}
