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
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 1/6 -- Category selection with Category → Subgroup → Variant browse.
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

  /// Drill-down stack of parent node ids (empty = roots).
  final List<int> _browseStack = [];

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
    final categories = _visibleCategories(catalog);
    for (var i = 0; i < categories.length; i++) {
      if (categories[i].slug == 'paper') return i;
    }
    return -1;
  }

  List<ProductCategory> _visibleCategories(ProductCatalog catalog) {
    if (_browseStack.isEmpty) return catalog.rootCategories;
    return catalog.childrenOf(_browseStack.last);
  }

  ProductCategory? _currentParent(ProductCatalog catalog) {
    if (_browseStack.isEmpty) return null;
    return catalog.categoryById(_browseStack.last);
  }

  void _schedulePipelineCoachMark() {
    if (!mounted || _categoryCoachScheduled || _categoryCoachVisible) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.paperCategoryCard) return;

    final catalogAsync = ref.read(productCatalogProvider);
    if (catalogAsync.isLoading || !catalogAsync.hasValue) return;

    // Tutorial expects paper at root level.
    if (_browseStack.isNotEmpty) {
      setState(() => _browseStack.clear());
    }

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
    final catalog = catalogAsync.valueOrNull ?? ProductCatalog.fallback();
    final categories = _visibleCategories(catalog);
    final parent = _currentParent(catalog);

    final heading = parent == null
        ? 'What would you\nlike to print?'
        : parent.name;
    final subheading = parent == null
        ? null
        : (parent.audienceLabel ??
            parent.mobileDescription ??
            parent.description);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          widget.addMode ? 'Add to your order' : 'New Order',
          style: AppTypography.h3.copyWith(
            color: colors.onBackground,
            fontSize: 18,
          ),
        ),
        iconTheme: IconThemeData(color: colors.onBackground),
        leading: _browseStack.isNotEmpty
            ? IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () {
                  setState(() {
                    _browseStack.removeLast();
                  });
                },
              )
            : null,
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
              if (_browseStack.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                _Breadcrumb(
                  catalog: catalog,
                  stack: _browseStack,
                  onTapLevel: (index) {
                    setState(() {
                      if (index < 0) {
                        _browseStack.clear();
                      } else {
                        _browseStack.removeRange(
                          index + 1,
                          _browseStack.length,
                        );
                      }
                    });
                  },
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
              Text(
                    heading,
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                      fontSize: parent == null ? 26 : 22,
                      height: 1.2,
                    ),
                  )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
              if (subheading != null && subheading.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  subheading,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    height: 1.35,
                    fontSize: 12.5,
                  ),
                ),
              ],
              const SizedBox(height: AppSpacing.lg),
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
                    if (categories.isEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: AppSpacing.xl),
                        child: Text(
                          'No products in this group yet.',
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                      ),
                    ...categories.indexed.map((entry) {
                      final index = entry.$1;
                      final category = entry.$2;
                      final children = catalog.childrenOf(category.id);
                      final canDrill =
                          category.isBrowseGroup || children.isNotEmpty;
                      return Padding(
                        padding: EdgeInsets.only(
                          bottom: index == categories.length - 1
                              ? 0
                              : AppSpacing.sm,
                        ),
                        child:
                            _CategoryCard(
                                  tutorialKey: category.slug == 'paper'
                                      ? _paperCategoryKey
                                      : null,
                                  icon: categoryIconFor(category),
                                  title: category.name,
                                  description:
                                      category.mobileDescription ??
                                      category.audienceLabel ??
                                      category.description ??
                                      (canDrill
                                          ? 'Browse products in this group'
                                          : 'Configure specs and upload your file'),
                                  badge: _levelBadge(category),
                                  onTap: () {
                                    if (canDrill && !category.isOrderable) {
                                      setState(() {
                                        _browseStack.add(category.id);
                                      });
                                      return;
                                    }
                                    _selectCategory(category);
                                  },
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
                    const SizedBox(height: AppSpacing.lg),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _levelBadge(ProductCategory category) {
    if (category.isOrderable && category.catalogLevel >= 3) return 'Product';
    if (category.catalogLevel == 2) return 'Group';
    if (category.isBrowseGroup && category.catalogLevel == 1) return 'Category';
    if (category.isOrderable && category.parentId == null) return 'Product';
    return null;
  }

  Future<void> _selectCategory(ProductCategory category) async {
    ref
        .read(orderFlowProvider.notifier)
        .setCategory(category.slug, categoryName: category.name);
    ref.read(orderFlowProvider.notifier).goToStep(1);
    final is3d =
        category.fileProcessingType == 'model_3d' || category.slug == '3d';
    await context.push(
      is3d ? '/customer/order/3d-specs' : '/customer/order/paper-specs',
    );
  }
}

/// Distinct HugeIcons per catalog node (slug-first, then prefix fallbacks).
List<List<dynamic>> categoryIconFor(ProductCategory category) {
  final slug = category.slug.toLowerCase();

  // Exact slug map (roots + subgroups + common leaves).
  const exact = <String, List<List<dynamic>>>{
    // Legacy roots
    'paper': HugeIcons.strokeRoundedPrinter,
    '3d': HugeIcons.strokeRounded3dPrinter,

    // L1 categories
    'marketing-promo': HugeIcons.strokeRoundedMegaphone01,
    'corporate-merchandise': HugeIcons.strokeRoundedGift,
    'recognition-awards': HugeIcons.strokeRoundedAward01,
    'specialized-prototyping': HugeIcons.strokeRoundedCube,

    // Marketing subgroups
    'flyers': HugeIcons.strokeRoundedNews01,
    'brochures': HugeIcons.strokeRoundedBookOpen01,
    'posters-standees': HugeIcons.strokeRoundedImage01,
    'business-cards': HugeIcons.strokeRoundedCreditCard,
    'stickers-labels': HugeIcons.strokeRoundedLabel,
    'tarpaulins-banners': HugeIcons.strokeRoundedFlag01,

    // Corporate subgroups
    'lanyards-id': HugeIcons.strokeRoundedIdentityCard,
    'custom-apparel': HugeIcons.strokeRoundedTShirt,
    'drinkware': HugeIcons.strokeRoundedCoffee01,
    'corporate-giveaways': HugeIcons.strokeRoundedShoppingBag01,

    // Recognition subgroups
    'certificates-diplomas': HugeIcons.strokeRoundedCertificate01,
    'plaques-trophies': HugeIcons.strokeRoundedAward02,
    'medals-ribbons': HugeIcons.strokeRoundedMedal01,
    'business-store-signages': HugeIcons.strokeRoundedStore01,

    // Specialized subgroups
    '3d-scale-models': HugeIcons.strokeRounded3dPrinter,
    'blueprint-cad': HugeIcons.strokeRoundedRuler,
    'packaging-boxes': HugeIcons.strokeRoundedPackage01,
  };

  final hit = exact[slug];
  if (hit != null) return hit;

  // Variant / partial slug heuristics (most specific first).
  if (slug.startsWith('flyers-')) return HugeIcons.strokeRoundedNews01;
  if (slug.startsWith('brochures-')) return HugeIcons.strokeRoundedBookOpen01;
  if (slug.startsWith('posters-pull')) return HugeIcons.strokeRoundedFlag02;
  if (slug.startsWith('posters-x')) return HugeIcons.strokeRoundedLayers01;
  if (slug.startsWith('posters-')) return HugeIcons.strokeRoundedImage02;
  if (slug.startsWith('business-cards-qr')) return HugeIcons.strokeRoundedQrCode;
  if (slug.startsWith('business-cards-')) {
    return HugeIcons.strokeRoundedCreditCard;
  }
  if (slug.startsWith('stickers-')) return HugeIcons.strokeRoundedLabel;
  if (slug.startsWith('tarpaulins-')) return HugeIcons.strokeRoundedFlag01;
  if (slug.startsWith('lanyards-badge')) {
    return HugeIcons.strokeRoundedIdentityCard;
  }
  if (slug.startsWith('lanyards-')) return HugeIcons.strokeRoundedId;
  if (slug.startsWith('apparel-hoodie')) return HugeIcons.strokeRoundedHoodie;
  if (slug.startsWith('apparel-polo')) return HugeIcons.strokeRoundedShirt01;
  if (slug.startsWith('apparel-tote')) {
    return HugeIcons.strokeRoundedShoppingBag02;
  }
  if (slug.startsWith('apparel-')) return HugeIcons.strokeRoundedTShirt;
  if (slug.startsWith('drinkware-mug') || slug.contains('mug')) {
    return HugeIcons.strokeRoundedCoffee02;
  }
  if (slug.startsWith('drinkware-') || slug.contains('bottle')) {
    return HugeIcons.strokeRoundedDrink;
  }
  if (slug.startsWith('giveaways-eco')) return HugeIcons.strokeRoundedLeaf01;
  if (slug.startsWith('giveaways-umbrella')) {
    return HugeIcons.strokeRoundedUmbrella;
  }
  if (slug.startsWith('giveaways-pen')) return HugeIcons.strokeRoundedPen01;
  if (slug.startsWith('giveaways-key')) return HugeIcons.strokeRoundedKey01;
  if (slug.startsWith('giveaways-note')) {
    return HugeIcons.strokeRoundedNotebook01;
  }
  if (slug.startsWith('giveaways-')) return HugeIcons.strokeRoundedGift;
  if (slug.startsWith('certificates-')) {
    return HugeIcons.strokeRoundedCertificate02;
  }
  if (slug.startsWith('plaques-3d') || slug.contains('3d-printed')) {
    return HugeIcons.strokeRoundedCube;
  }
  if (slug.startsWith('plaques-wood')) return HugeIcons.strokeRoundedAward03;
  if (slug.startsWith('plaques-')) return HugeIcons.strokeRoundedAward02;
  if (slug.startsWith('medals-')) return HugeIcons.strokeRoundedMedal02;
  if (slug.startsWith('signage-')) return HugeIcons.strokeRoundedStore02;
  if (slug.startsWith('3d-rapid') || slug.startsWith('3d-custom')) {
    return HugeIcons.strokeRounded3dPrinter;
  }
  if (slug.startsWith('3d-architectural') || slug.startsWith('3d-')) {
    return HugeIcons.strokeRoundedBuilding01;
  }
  if (slug.startsWith('blueprint-')) return HugeIcons.strokeRoundedRuler;
  if (slug.startsWith('packaging-')) return HugeIcons.strokeRoundedPackage02;

  // Level / processing fallbacks.
  if (category.fileProcessingType == 'model_3d') {
    return HugeIcons.strokeRounded3dPrinter;
  }
  if (category.catalogLevel == 1) return HugeIcons.strokeRoundedFolder01;
  if (category.catalogLevel == 2) return HugeIcons.strokeRoundedLayers01;
  return HugeIcons.strokeRoundedFile02;
}

class _Breadcrumb extends StatelessWidget {
  const _Breadcrumb({
    required this.catalog,
    required this.stack,
    required this.onTapLevel,
  });

  final ProductCatalog catalog;
  final List<int> stack;
  final void Function(int index) onTapLevel;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final chips = <Widget>[
      GestureDetector(
        onTap: () => onTapLevel(-1),
        child: Text(
          'All',
          style: AppTypography.caption.copyWith(color: colors.accent),
        ),
      ),
    ];

    for (var i = 0; i < stack.length; i++) {
      final node = catalog.categoryById(stack[i]);
      if (node == null) continue;
      chips.add(
        Text(
          ' / ',
          style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
        ),
      );
      final isLast = i == stack.length - 1;
      chips.add(
        GestureDetector(
          onTap: isLast ? null : () => onTapLevel(i),
          child: Text(
            node.name,
            style: AppTypography.caption.copyWith(
              color: isLast ? colors.onBackground : colors.accent,
              fontWeight: isLast ? FontWeight.w600 : FontWeight.w400,
            ),
          ),
        ),
      );
    }

    return Wrap(crossAxisAlignment: WrapCrossAlignment.center, children: chips);
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
    this.tutorialKey,
    this.badge,
  });

  final List<List<dynamic>> icon;
  final String title;
  final String description;
  final VoidCallback onTap;
  final GlobalKey? tutorialKey;
  final String? badge;

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
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Icon column with level badge under the icon.
            SizedBox(
              width: 64,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant.withValues(alpha: 0.65),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: colors.outline.withValues(alpha: 0.35),
                      ),
                    ),
                    alignment: Alignment.center,
                    child: HugeIcon(
                      icon: icon,
                      size: 24,
                      color: colors.accent,
                    ),
                  ),
                  if (badge != null) ...[
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 6,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: colors.surfaceVariant,
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: colors.outline.withValues(alpha: 0.4),
                        ),
                      ),
                      child: Text(
                        badge!,
                        textAlign: TextAlign.center,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.2,
                          height: 1.1,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    title,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                      fontSize: 15,
                      height: 1.25,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Icon(
              Icons.chevron_right,
              size: 20,
              color: colors.onSurfaceDim,
            ),
          ],
        ),
      ),
    );
  }
}
