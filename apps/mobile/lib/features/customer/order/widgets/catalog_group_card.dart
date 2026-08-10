import 'package:flutter/material.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';

class CatalogGroupCard extends StatelessWidget {
  const CatalogGroupCard({
    super.key,
    required this.group,
    required this.icon,
    required this.onTap,
  });

  final ProductGroup group;
  final dynamic icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final countLabel =
        '${group.products.length} ${group.products.length == 1 ? 'product' : 'products'}';

    return Semantics(
      button: true,
      label: '${group.name}, $countLabel',
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 44, minWidth: 44),
        child: Material(
          color: colors.surface,
          shape: RoundedRectangleBorder(
            borderRadius: AppRadius.borderLg,
            side: BorderSide(color: colors.outline),
          ),
          clipBehavior: Clip.antiAlias,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: AppColors.actionYellow,
                      borderRadius: AppRadius.borderMd,
                    ),
                    child: HugeIcon(icon: icon, size: 24, color: Colors.black),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          group.name,
                          style: AppTypography.h3.copyWith(
                            color: colors.onBackground,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          group.description,
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          countLabel,
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.brand,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  HugeIcon(
                    icon: HugeIcons.strokeRoundedArrowRight01,
                    size: 20,
                    color: colors.onSurfaceDim,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
