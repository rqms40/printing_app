import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';

/// Shared connection status for every grouped-catalog browsing surface.
class CatalogAuthorityBanner extends StatelessWidget {
  const CatalogAuthorityBanner({
    super.key,
    required this.state,
    required this.onRetry,
  });

  final ProductCatalogState state;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    if (!state.isLoading && state.error == null) {
      return const SizedBox.shrink();
    }

    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isFallback = state.error != null;
    final message = isFallback
        ? 'Using the saved catalog for browsing. Reconnect before submitting a request.'
        : 'Checking the latest catalog. You can browse while we connect.';

    return Semantics(
      liveRegion: true,
      label: isFallback
          ? 'Catalog connection warning'
          : 'Catalog connection in progress',
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          border: Border.all(
            color: isFallback ? colors.warning : colors.outline,
          ),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            HugeIcon(
              icon: isFallback
                  ? HugeIcons.strokeRoundedAlert02
                  : HugeIcons.strokeRoundedRefresh,
              size: 22,
              color: isFallback ? colors.warning : colors.onSurface,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message,
                    style: AppTypography.body.copyWith(color: colors.onSurface),
                  ),
                  if (isFallback && state.isLoading) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Retrying…',
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurface,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            if (state.isLoading)
              const SizedBox.square(
                dimension: 24,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              TextButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
