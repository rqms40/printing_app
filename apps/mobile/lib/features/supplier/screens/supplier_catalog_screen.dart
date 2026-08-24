import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/supplier/models/supplier_catalog.dart';
import 'package:printing_app/features/supplier/providers/supplier_catalog_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/utils/formatters.dart';

class SupplierCatalogScreen extends ConsumerStatefulWidget {
  const SupplierCatalogScreen({super.key});

  @override
  ConsumerState<SupplierCatalogScreen> createState() =>
      _SupplierCatalogScreenState();
}

class _SupplierCatalogScreenState extends ConsumerState<SupplierCatalogScreen> {
  final _titleController = TextEditingController();
  final Set<String> _selectedSlugs = {};

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  Future<void> _import() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['docx', 'pdf', 'xlsx', 'xls', 'csv'],
      withData: true,
    );
    if (result == null || result.files.isEmpty) return;
    final ok = await ref
        .read(supplierCatalogProvider.notifier)
        .importFile(result.files.first);
    if (!mounted) return;
    final state = ref.read(supplierCatalogProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok
              ? (state.lastWarnings.isEmpty
                    ? 'Catalog imported and applied to your products.'
                    : state.lastWarnings.join('\n'))
              : (state.errorMessage ?? 'Import failed'),
        ),
      ),
    );
  }

  Future<void> _saveManual() async {
    final title = _titleController.text.trim();
    if (title.isEmpty || _selectedSlugs.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Add a product title and at least one category.'),
        ),
      );
      return;
    }
    final ok = await ref.read(supplierCatalogProvider.notifier).upsert(
      title: title,
      categorySlugs: _selectedSlugs.toList(),
    );
    if (!mounted) return;
    if (ok) {
      _titleController.clear();
      setState(() => _selectedSlugs.clear());
    }
    final state = ref.read(supplierCatalogProvider);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          ok ? 'Product added to your catalog.' : (state.errorMessage ?? 'Save failed'),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final catalogState = ref.watch(supplierCatalogProvider);
    final products = ref.watch(productCatalogProvider).asData?.value;
    final orderable = products?.orderableCategories ?? const <ProductCategory>[];

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Shop catalog',
          style: AppTypography.h2.copyWith(color: colors.onBackground),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.read(supplierCatalogProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.xl,
            AppSpacing.md,
            AppSpacing.xl,
            AppSpacing.xxl,
          ),
          children: [
            Text(
              'Upload a price list (.docx, .pdf, or Excel) or add products by hand. Customers see a merged list of specs across shops in the same category. Ops assignment greys out shops that cannot fulfill the selected options.',
              style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            ),
            const SizedBox(height: AppSpacing.lg),
            AppButton(
              label: catalogState.isSaving
                  ? 'Importing…'
                  : 'Upload catalog file',
              icon: HugeIcons.strokeRoundedUpload03,
              isFullWidth: true,
              isDisabled: catalogState.isSaving,
              onTap: catalogState.isSaving ? null : _import,
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'ADD MANUALLY',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                letterSpacing: 1.4,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AppTextField(
              controller: _titleController,
              label: 'Product title',
              hintText: 'Tarpaulin & Signage Printing',
            ),
            const SizedBox(height: AppSpacing.md),
            if (orderable.isNotEmpty)
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  for (final category in orderable.take(24))
                    FilterChip(
                      label: Text(category.name),
                      selected: _selectedSlugs.contains(category.slug),
                      onSelected: (selected) {
                        setState(() {
                          if (selected) {
                            _selectedSlugs.add(category.slug);
                          } else {
                            _selectedSlugs.remove(category.slug);
                          }
                        });
                      },
                    ),
                ],
              ),
            const SizedBox(height: AppSpacing.md),
            AppButton(
              label: 'Save product',
              variant: AppButtonVariant.secondary,
              isFullWidth: true,
              isDisabled: catalogState.isSaving,
              onTap: catalogState.isSaving ? null : _saveManual,
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'YOUR PRODUCTS',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                letterSpacing: 1.4,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            if (catalogState.isLoading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (catalogState.offerings.isEmpty)
              Text(
                'No catalog items yet. Upload the shop price list to fill specs, sizes, and add-ons.',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              )
            else
              for (final offering in catalogState.offerings) ...[
                _OfferingCard(
                  offering: offering,
                  colors: colors,
                  onDelete: () async {
                    await ConfirmationDialog.show(
                      context,
                      title: 'Remove ${offering.title}?',
                      message:
                          'This only removes your shop offering. Shared catalog specs stay for other shops.',
                      confirmLabel: 'Remove',
                      onConfirm: () {
                        Navigator.of(context).pop();
                        ref
                            .read(supplierCatalogProvider.notifier)
                            .remove(offering.id);
                      },
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),
              ],
          ],
        ),
      ),
    );
  }
}

class _OfferingCard extends StatelessWidget {
  const _OfferingCard({
    required this.offering,
    required this.colors,
    required this.onDelete,
  });

  final SupplierCatalogOffering offering;
  final AppColorSet colors;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  offering.title,
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Remove',
                onPressed: onDelete,
                icon: HugeIcon(
                  icon: HugeIcons.strokeRoundedDelete02,
                  color: colors.error,
                  size: 18,
                ),
              ),
            ],
          ),
          if (offering.baseRatePesos != null) ...[
            Text(
              '${formatCurrency(offering.baseRatePesos!)}'
              '${offering.pricingUnit == null ? '' : ' / ${offering.pricingUnit}'}',
              style: AppTypography.caption.copyWith(color: colors.accent),
            ),
            const SizedBox(height: 6),
          ],
          Text(
            offering.categorySlugs.join(' · '),
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: 8),
          for (final spec in offering.specOptions.entries)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Text(
                '${spec.key.replaceAll('_', ' ')}: ${spec.value.join(', ')}',
                style: AppTypography.caption.copyWith(
                  color: colors.onBackground,
                ),
              ),
            ),
          if (offering.addons.isNotEmpty)
            Text(
              'Add-ons: ${offering.addons.map((a) => a.name).join(', ')}',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          if (offering.sourceFileName != null) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: colors.surfaceVariant,
                borderRadius: AppRadius.borderSm,
              ),
              child: Text(
                offering.sourceFileName!,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 10,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
