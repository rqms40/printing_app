import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/models/catalog_spec_mappers.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/widgets/spec_selector.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 2/6 -- 3D print specification selection.
class ThreeDSpecsScreen extends ConsumerStatefulWidget {
  const ThreeDSpecsScreen({super.key});

  static const routeName = '/order/3d-specs';

  @override
  ConsumerState<ThreeDSpecsScreen> createState() => _ThreeDSpecsScreenState();
}

class _ThreeDSpecsScreenState extends ConsumerState<ThreeDSpecsScreen> {
  final _quantityController = TextEditingController(text: '1');
  final _textControllers = <String, TextEditingController>{};
  final _values = <String, dynamic>{};
  String? _initializedSlug;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _quantityController.dispose();
    for (final controller in _textControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  ProductCategory _category() {
    final catalog =
        ref.read(productCatalogProvider).valueOrNull ??
        ProductCatalog.fallback();
    final slug = ref.read(orderFlowProvider).category ?? '3d';
    return catalog.categoryBySlug(slug) ??
        ProductCatalog.fallback().categoryBySlug('3d')!;
  }

  void _ensureDefaults(ProductCategory category) {
    if (_initializedSlug == category.slug) return;
    final flow = ref.read(orderFlowProvider);
    _values
      ..clear()
      ..addAll(category.defaultSpecValues(overrides: flow.specs));
    _initializedSlug = category.slug;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final catalog =
        ref.watch(productCatalogProvider).valueOrNull ??
        ProductCatalog.fallback();
    final slug = ref.watch(orderFlowProvider).category ?? '3d';
    final category =
        catalog.categoryBySlug(slug) ??
        ProductCatalog.fallback().categoryBySlug('3d')!;
    _ensureDefaults(category);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          '3D Specs',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.md),
                  const StepIndicator(totalSteps: 6, currentStep: 1),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                        category.name,
                        style: AppTypography.h1.copyWith(
                          color: colors.onBackground,
                        ),
                      )
                      .animate()
                      .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.03,
                        duration: 400.ms,
                        curve: Curves.easeOut,
                      ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Expanded(
                  child: ListView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.lg,
                    ),
                    children: [
                      const SizedBox(height: AppSpacing.sm),
                      ..._specWidgets(category),
                      const SizedBox(height: AppSpacing.lg),
                      AppTextField(
                        label: 'Quantity',
                        controller: _quantityController,
                        keyboardType: TextInputType.number,
                        hintText: 'Enter quantity',
                      ),
                      const SizedBox(height: AppSpacing.xxl),
                    ],
                  ),
                )
                .animate()
                .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.02,
                  duration: 400.ms,
                  delay: 60.ms,
                  curve: Curves.easeOut,
                ),
            Container(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    border: Border(
                      top: BorderSide(color: colors.outline, width: 0.5),
                    ),
                  ),
                  child: AppButton(
                    label: 'Continue',
                    isFullWidth: true,
                    onTap: _onContinue,
                  ),
                )
                .animate()
                .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.03,
                  duration: 400.ms,
                  delay: 120.ms,
                  curve: Curves.easeOut,
                ),
          ],
        ),
      ),
    );
  }

  List<Widget> _specWidgets(ProductCategory category) {
    final widgets = <Widget>[];
    for (final spec in category.visibleSpecs) {
      widgets.add(_specWidget(spec));
      widgets.add(const SizedBox(height: AppSpacing.lg));
    }
    if (widgets.isNotEmpty) widgets.removeLast();
    return widgets;
  }

  Widget _specWidget(ProductSpecDefinition spec) {
    if (spec.inputType == 'select') {
      return SpecSelector<String>(
        label: spec.label.toUpperCase(),
        options: spec.options.map((option) => option.value).toList(),
        selected:
            _values[spec.key]?.toString() ?? spec.defaultSelection.toString(),
        onChanged: (value) => setState(() => _values[spec.key] = value),
        displayName: (value) => spec.optionForValue(value)?.label ?? value,
      );
    }

    if (spec.valueType == 'boolean') {
      final selected = _readBool(_values[spec.key], false);
      return SpecSelector<bool>(
        label: spec.label.toUpperCase(),
        options: const [true, false],
        selected: selected,
        onChanged: (value) => setState(() => _values[spec.key] = value),
        displayName: (value) => value ? 'Yes' : 'No',
      );
    }

    final controller = _textControllers.putIfAbsent(
      spec.key,
      () => TextEditingController(text: _values[spec.key]?.toString() ?? ''),
    );
    return AppTextField(
      label: spec.label,
      controller: controller,
      keyboardType: spec.valueType == 'number'
          ? TextInputType.number
          : TextInputType.text,
      maxLines: spec.inputType == 'text' ? 3 : 1,
      hintText: spec.placeholder ?? spec.label,
      onChanged: (value) => _values[spec.key] = spec.valueType == 'number'
          ? (num.tryParse(value) ?? value)
          : value,
    );
  }

  void _onContinue() {
    final category = _category();
    final quantity = int.tryParse(_quantityController.text) ?? 1;
    final selected = Map<String, dynamic>.from(_values);
    for (final entry in _textControllers.entries) {
      selected[entry.key] = entry.value.text.trim();
    }

    final specs = threeDSpecsFromCatalogValues(selected);
    final displayValues = category.displayValues(selected);
    final printSubtotal = category.estimatePrice(selected, quantity);

    final notifier = ref.read(orderFlowProvider.notifier);
    notifier.setThreeDSpecs(specs);
    notifier.setQuantity(quantity);
    notifier.setCatalogSpecs(
      specs: selected,
      displayValues: displayValues,
      totalPrice: printSubtotal,
    );
    notifier.nextStep();

    context.push('/customer/order/upload');
  }
}

bool _readBool(dynamic value, bool fallback) {
  if (value is bool) return value;
  if (value is String) return value.toLowerCase() == 'true';
  return fallback;
}
