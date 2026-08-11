import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/models/catalog_spec_mappers.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/customer/order/widgets/spec_selector.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';
import 'package:tutorial_coach_mark/tutorial_coach_mark.dart';

/// Step 2/6 -- Paper specification selection.
class PaperSpecsScreen extends ConsumerStatefulWidget {
  const PaperSpecsScreen({super.key});

  static const routeName = '/order/paper-specs';

  @override
  ConsumerState<PaperSpecsScreen> createState() => _PaperSpecsScreenState();
}

class _PaperSpecsScreenState extends ConsumerState<PaperSpecsScreen> {
  final _quantityController = TextEditingController(text: '1');
  final _specialInstructionsController = TextEditingController();
  final _textControllers = <String, TextEditingController>{};
  final _values = <String, dynamic>{};
  String? _initializedSlug;

  final _primarySpecKey = GlobalKey();
  final _specsContinueKey = GlobalKey();
  bool _advancedThisFrame = false;
  PipelineTutorialNotifier? _pipelineNotifier;
  PipelineState _pipelineState = const PipelineState();

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    _specialInstructionsController.text =
        ref.read(orderFlowProvider).specialInstructions ?? '';
    _pipelineNotifier = ref.read(pipelineTutorialProvider.notifier);
    ref.listenManual<PipelineState>(
      pipelineTutorialProvider,
      (_, next) => _pipelineState = next,
      fireImmediately: true,
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(
        const Duration(milliseconds: 500),
        () => _maybePipelineCoachMark(),
      );
    });
  }

  @override
  void dispose() {
    if (_pipelineState.active &&
        (_pipelineState.step == PipelineStep.paperSpecsForm ||
            _pipelineState.step == PipelineStep.paperSpecsContinue) &&
        !_advancedThisFrame) {
      // Providers must not be mutated while the tree is locked for
      // unmounting; defer past the current frame.
      final pipelineNotifier = _pipelineNotifier;
      Future.microtask(() => pipelineNotifier?.abandon());
    }
    _quantityController.dispose();
    _specialInstructionsController.dispose();
    for (final controller in _textControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _ensureVisible(GlobalKey key, {double alignment = 0.0}) async {
    final ctx = key.currentContext;
    if (ctx == null) return;
    await Scrollable.ensureVisible(
      ctx,
      duration: const Duration(milliseconds: 250),
      alignment: alignment,
    );
    await Future<void>.delayed(const Duration(milliseconds: 100));
  }

  Future<void> _maybePipelineCoachMark() async {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active) return;

    if (state.step == PipelineStep.paperSpecsForm) {
      await _ensureVisible(_primarySpecKey, alignment: 0.12);
      if (!mounted || _primarySpecKey.currentContext == null) return;
      showCoachMark(
        context,
        [
          TutorialStep(
            targetKey: _primarySpecKey,
            icon: HugeIcons.strokeRoundedSettings01,
            title: 'Set your specs',
            body:
                'Set your paper size, color mode, and copies. Defaults work for most prints.',
            shape: ShapeLightFocus.RRect,
            align: ContentAlign.bottom,
            advanceOnSpotlightTap: false,
          ),
        ],
        () {
          ref.read(pipelineTutorialProvider.notifier).advance();
          Future.delayed(const Duration(milliseconds: 300), () {
            if (mounted) _maybePipelineCoachMark();
          });
        },
        onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
      );
    } else if (state.step == PipelineStep.paperSpecsContinue) {
      await _ensureVisible(_specsContinueKey);
      if (!mounted) return;
      showCoachMark(
        context,
        [
          TutorialStep(
            targetKey: _specsContinueKey,
            icon: HugeIcons.strokeRoundedArrowRight01,
            title: 'Continue',
            body: 'Tap Continue when your specs look right.',
            align: ContentAlign.top,
            advanceOnSpotlightTap: true,
            onSpotlightTap: () {
              _advancedThisFrame = true;
              ref.read(pipelineTutorialProvider.notifier).advance();
              _onContinue();
            },
          ),
        ],
        () {},
        onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
      );
    }
  }

  ProductCategory _category() {
    final catalog = ref.read(productCatalogProvider).catalog;
    final slug = ref.read(orderFlowProvider).category ?? 'paper';
    return catalog.categoryBySlug(slug) ??
        ProductCatalog.legacyFallback().categoryBySlug('paper')!;
  }

  void _ensureDefaults(ProductCategory category) {
    if (_initializedSlug == category.slug) return;
    final flow = ref.read(orderFlowProvider);
    _values
      ..clear()
      ..addAll(
        category.defaultSpecValues(overrides: {...flow.specs, 'page_count': 1}),
      );
    _initializedSlug = category.slug;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final catalog = ref.watch(productCatalogProvider).catalog;
    final slug = ref.watch(orderFlowProvider).category ?? 'paper';
    final category =
        catalog.categoryBySlug(slug) ??
        ProductCatalog.legacyFallback().categoryBySlug('paper')!;
    _ensureDefaults(category);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'Paper Specs',
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
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: _specWidgets(category),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppTextField(
                        label: 'Quantity',
                        controller: _quantityController,
                        keyboardType: TextInputType.number,
                        hintText: 'Enter quantity',
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppTextField(
                        label: 'Special Instructions / Notes',
                        controller: _specialInstructionsController,
                        keyboardType: TextInputType.multiline,
                        textInputAction: TextInputAction.newline,
                        maxLines: 4,
                        hintText:
                            'Color, cutting, folding, binding, or handling notes',
                        onChanged: ref
                            .read(orderFlowProvider.notifier)
                            .setSpecialInstructions,
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
                  child: KeyedSubtree(
                    key: _specsContinueKey,
                    child: AppButton(
                      label: 'Continue',
                      isFullWidth: true,
                      onTap: () {
                        final pipeline = ref.read(pipelineTutorialProvider);
                        if (pipeline.active &&
                            pipeline.step == PipelineStep.paperSpecsContinue) {
                          _advancedThisFrame = true;
                          ref.read(pipelineTutorialProvider.notifier).advance();
                        }
                        _onContinue();
                      },
                    ),
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
    for (final entry in category.visibleSpecs.indexed) {
      final spec = entry.$2;
      final specWidget = _specWidget(spec);
      widgets.add(
        entry.$1 == 0
            ? KeyedSubtree(key: _primarySpecKey, child: specWidget)
            : specWidget,
      );
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
      hintText: spec.placeholder ?? spec.label,
      onChanged: (value) => _values[spec.key] = spec.valueType == 'number'
          ? (num.tryParse(value) ?? value)
          : value,
    );
  }

  void _onContinue() {
    final category = _category();
    final quantity = int.tryParse(_quantityController.text) ?? 1;
    const pageCount = 1;
    final selected = Map<String, dynamic>.from(_values)
      ..['page_count'] = pageCount;
    final printMode = selected['print_mode']?.toString() ?? 'fitToPage';

    final specs = paperSpecsFromCatalogValues(selected);
    final displayValues = category.displayValues(selected);
    final printSubtotal = category.estimatePrice(selected, quantity);

    final notifier = ref.read(orderFlowProvider.notifier);
    notifier.setPaperSpecs(specs);
    notifier.setQuantity(quantity);
    notifier.setPageCount(pageCount);
    notifier.setPrintMode(printMode);
    notifier.setSpecialInstructions(_specialInstructionsController.text);
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
