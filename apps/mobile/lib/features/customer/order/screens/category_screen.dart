import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/models/product_catalog.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/providers/product_catalog_provider.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/app_illustrations.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 1/6 -- Category selection (Paper Printing or 3D Printing).
class CategoryScreen extends ConsumerStatefulWidget {
  const CategoryScreen({super.key, this.addMode = false});

  final bool addMode;

  static const routeName = '/order/category';

  @override
  ConsumerState<CategoryScreen> createState() => _CategoryScreenState();
}

class _CategoryScreenState extends ConsumerState<CategoryScreen> {
  final _paperCategoryKey = GlobalKey();
  bool _advancedThisFrame = false;
  bool _categoryCoachScheduled = false;
  bool _categoryCoachVisible = false;
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
    _pipelineNotifier = ref.read(pipelineTutorialProvider.notifier);
    ref.listenManual<PipelineState>(pipelineTutorialProvider, (_, next) {
      _pipelineState = next;
      if (next.active && next.step == PipelineStep.paperCategoryCard) {
        _schedulePipelineCoachMark();
      }
    }, fireImmediately: true);
    ref.listenManual<AsyncValue<ProductCatalog>>(productCatalogProvider, (
      _,
      next,
    ) {
      if (!next.isLoading && next.hasValue) {
        _schedulePipelineCoachMark();
      }
    });
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _schedulePipelineCoachMark(),
    );
  }

  @override
  void dispose() {
    if (_pipelineState.active &&
        _pipelineState.step == PipelineStep.paperCategoryCard &&
        !_advancedThisFrame) {
      _pipelineNotifier?.abandon();
    }
    super.dispose();
  }

  ProductCategory? _activePaperCategory(ProductCatalog catalog) {
    for (final category in catalog.activeCategories) {
      if (category.slug == 'paper') return category;
    }
    return null;
  }

  int _activePaperCategoryIndex(ProductCatalog catalog) {
    final categories = catalog.activeCategories;
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].slug == 'paper') return i;
    }
    return -1;
  }

  void _schedulePipelineCoachMark() {
    if (!mounted || _categoryCoachScheduled || _categoryCoachVisible) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.paperCategoryCard) return;

    final catalogAsync = ref.read(productCatalogProvider);
    if (catalogAsync.isLoading || !catalogAsync.hasValue) return;

    final catalog = catalogAsync.requireValue;
    final paperIndex = _activePaperCategoryIndex(catalog);
    if (paperIndex == -1) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      return;
    }

    _categoryCoachScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      // The cards animate in with a 400ms duration and 60ms stagger. Waiting
      // from the catalog-backed render keeps the spotlight bounds accurate.
      await Future<void>.delayed(
        Duration(milliseconds: 460 + (paperIndex + 1) * 60),
      );
      if (!mounted) return;
      _categoryCoachScheduled = false;
      _maybePipelineCoachMark();
    });
  }

  void _maybePipelineCoachMark() {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.paperCategoryCard) return;
    if (_categoryCoachVisible) return;

    final catalogAsync = ref.read(productCatalogProvider);
    if (catalogAsync.isLoading || !catalogAsync.hasValue) {
      _schedulePipelineCoachMark();
      return;
    }

    final paperCategory = _activePaperCategory(catalogAsync.requireValue);
    if (paperCategory == null) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      return;
    }
    if (_paperCategoryKey.currentContext == null) {
      _schedulePipelineCoachMark();
      return;
    }

    _categoryCoachVisible = true;
    showCoachMark(
      context,
      [
        TutorialStep(
          targetKey: _paperCategoryKey,
          icon: HugeIcons.strokeRoundedFile02,
          title: 'Paper Printing',
          body: 'Pick Paper Printing for documents, photos, and posters.',
          advanceOnSpotlightTap: true,
          onSpotlightTap: () {
            _advancedThisFrame = true;
            _categoryCoachVisible = false;
            ref.read(pipelineTutorialProvider.notifier).advance();
            _selectCategory(paperCategory);
          },
        ),
      ],
      () => _categoryCoachVisible = false,
      onSkip: () {
        _categoryCoachVisible = false;
        ref.read(pipelineTutorialProvider.notifier).abandon();
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final catalogAsync = ref.watch(productCatalogProvider);
    final categories =
        catalogAsync.valueOrNull?.activeCategories ??
        ProductCatalog.fallback().activeCategories;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          widget.addMode ? 'Add to your order' : 'New Order',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.md),
              const StepIndicator(totalSteps: 6, currentStep: 0),
              if (widget.addMode) ...[
                const SizedBox(height: AppSpacing.sm),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => context.go('/customer/order/checkout'),
                    child: Text(
                      'Skip — review checkout',
                      style: AppTypography.body.copyWith(color: colors.accent),
                    ),
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.xl),
              Text(
                    'What would you\nlike to print?',
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                    ),
                  )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.xl),
              Expanded(
                child: ListView(
                  children: [
                    if (catalogAsync.isLoading &&
                        catalogAsync.valueOrNull == null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: LinearProgressIndicator(
                          minHeight: 2,
                          color: colors.accent,
                          backgroundColor: colors.surfaceVariant,
                        ),
                      ),
                    ...categories.indexed.map((entry) {
                      final index = entry.$1;
                      final category = entry.$2;
                      return Padding(
                        padding: EdgeInsets.only(
                          bottom: index == categories.length - 1
                              ? 0
                              : AppSpacing.md,
                        ),
                        child:
                            _CategoryCard(
                                  tutorialKey: category.slug == 'paper'
                                      ? _paperCategoryKey
                                      : null,
                                  illustration: _categoryIllustration(
                                    category,
                                    colors,
                                  ),
                                  title: category.name,
                                  description:
                                      category.mobileDescription ??
                                      category.description ??
                                      'Configure specs and upload your file',
                                  onTap: () => _selectCategory(category),
                                )
                                .animate()
                                .fadeIn(
                                  duration: 400.ms,
                                  delay: Duration(
                                    milliseconds: 60 * (index + 1),
                                  ),
                                  curve: Curves.easeOut,
                                )
                                .slideY(
                                  begin: 0.03,
                                  duration: 400.ms,
                                  delay: Duration(
                                    milliseconds: 60 * (index + 1),
                                  ),
                                  curve: Curves.easeOut,
                                ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _categoryIllustration(ProductCategory category, AppColorSet colors) {
    if (category.fileProcessingType == 'model_3d' || category.slug == '3d') {
      return ThreeDCubeIllustration(size: 60, color: colors.accent);
    }
    return PrinterIllustration(size: 60, color: colors.accent);
  }

  Future<void> _selectCategory(ProductCategory category) async {
    ref
        .read(orderFlowProvider.notifier)
        .setCategory(category.slug, categoryName: category.name);
    ref.read(orderFlowProvider.notifier).goToStep(1);
    await context.push(
      category.fileProcessingType == 'document' || category.slug == 'paper'
          ? '/customer/order/paper-specs'
          : '/customer/order/3d-specs',
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.illustration,
    required this.title,
    required this.description,
    required this.onTap,
    this.tutorialKey,
  });

  final Widget illustration;
  final String title;
  final String description;
  final VoidCallback onTap;
  final GlobalKey? tutorialKey;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return KeyedSubtree(
      key: tutorialKey,
      child: AppCard(
        onTap: onTap,
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Row(
          children: [
            illustration,
            const SizedBox(width: AppSpacing.xl),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    title,
                    style: AppTypography.h3.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description,
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: colors.onSurfaceDim),
          ],
        ),
      ),
    );
  }
}
