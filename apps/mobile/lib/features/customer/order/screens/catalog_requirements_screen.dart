import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/widgets/catalog_authority_banner.dart';
import 'package:printing_app/features/customer/order/widgets/dynamic_spec_field.dart';

DateTime? parseStrictRequiredDate(String raw) {
  final match = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$').firstMatch(raw.trim());
  if (match == null) return null;
  final year = int.parse(match.group(1)!);
  final month = int.parse(match.group(2)!);
  final day = int.parse(match.group(3)!);
  final parsed = DateTime(year, month, day);
  return parsed.year == year && parsed.month == month && parsed.day == day
      ? parsed
      : null;
}

class CatalogRequirementsScreen extends ConsumerStatefulWidget {
  const CatalogRequirementsScreen({super.key, required this.productSlug});
  final String productSlug;

  @override
  ConsumerState<CatalogRequirementsScreen> createState() =>
      _CatalogRequirementsScreenState();
}

class _CatalogRequirementsScreenState
    extends ConsumerState<CatalogRequirementsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _quantityController = TextEditingController(text: '1');
  final _dateController = TextEditingController();
  final _notesController = TextEditingController();
  final Map<String, dynamic> _values = {};
  String? _dateError;
  String? _initializedCatalogKey;

  @override
  void dispose() {
    _quantityController.dispose();
    _dateController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final catalogState = ref.watch(productCatalogProvider);
    final product = catalogState.catalog.productBySlug(widget.productSlug);
    final catalogKey = product == null
        ? null
        : '${product.slug}:${catalogState.isServerBacked}:${product.activeSpecs.map((spec) => spec.key).join(',')}';
    if (product != null && _initializedCatalogKey != catalogKey) {
      _initializedCatalogKey = catalogKey;
      _values
        ..clear()
        ..addAll(product.defaultSpecValues());
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(
          product == null
              ? 'Product requirements'
              : '${product.name} requirements',
        ),
      ),
      body: product == null
          ? const Center(child: Text('This product is no longer available.'))
          : Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (!catalogState.canSubmit) ...[
                    CatalogAuthorityBanner(
                      state: catalogState,
                      onRetry: () =>
                          ref.read(productCatalogProvider.notifier).retry(),
                    ),
                    const SizedBox(height: 16),
                  ],
                  for (final definition in product.visibleSpecs)
                    DynamicSpecField(
                      key: ValueKey('catalog-spec-${definition.key}'),
                      definition: definition,
                      value: _values[definition.key],
                      onChanged: (value) => _values[definition.key] = value,
                    ),
                  TextFormField(
                    key: const ValueKey('quantity-field'),
                    controller: _quantityController,
                    decoration: InputDecoration(
                      labelText: 'Quantity *',
                      suffixText: product.quantityUnit,
                    ),
                    keyboardType: TextInputType.number,
                    validator: (raw) {
                      final quantity = int.tryParse(raw ?? '');
                      return quantity == null || quantity < 1
                          ? 'Enter a positive quantity'
                          : null;
                    },
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    key: const ValueKey('required-date-field'),
                    controller: _dateController,
                    decoration: InputDecoration(
                      labelText: 'Required date *',
                      hintText: 'YYYY-MM-DD',
                      errorText: _dateError,
                    ),
                    keyboardType: TextInputType.datetime,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _notesController,
                    decoration: const InputDecoration(
                      labelText: 'Notes (optional)',
                    ),
                    maxLength: 1000,
                    maxLines: 3,
                  ),
                  const SizedBox(height: 20),
                  SizedBox(
                    height: 52,
                    child: FilledButton(
                      onPressed: catalogState.canSubmit
                          ? () => _continue(product, catalogState)
                          : null,
                      child: const Text('Continue to artwork'),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  void _continue(ProductCategory product, ProductCatalogState catalogState) {
    final date = parseStrictRequiredDate(_dateController.text);
    final today = DateTime.now();
    final startOfToday = DateTime(today.year, today.month, today.day);
    setState(() {
      _dateError = date == null || !date.isAfter(startOfToday)
          ? 'Required date must be in the future'
          : null;
    });
    if (!_formKey.currentState!.validate() || _dateError != null) return;
    ref
        .read(orderFlowProvider.notifier)
        .setCatalogProduct(
          groupSlug: product.groupSlug!,
          productSlug: product.slug,
          productName: product.name,
          requiredDate: date!,
          quoteRequired: product.pricingModel == 'quote_required',
          catalogServerBacked: catalogState.canSubmit,
          quantity: int.parse(_quantityController.text),
          specs: _values,
          displayValues: product.displayValues(_values),
          notes: _notesController.text,
        );
    context.go('/customer/order/upload');
  }
}
