import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/tutorial/providers/pipeline_tutorial_provider.dart';
import 'package:printing_app/features/tutorial/widgets/coach_mark_sequence.dart';
import 'package:printing_app/shared/services/api_client.dart';
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

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void initState() {
    super.initState();
    _loadDefaultPrintMode();
    // Delay long enough for the card's entry animation (400ms + 60ms delay) to
    // settle so the coach-mark spotlight captures the final card position.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Future.delayed(const Duration(milliseconds: 500), _maybePipelineCoachMark);
    });
  }

  @override
  void dispose() {
    final state = ref.read(pipelineTutorialProvider);
    if (state.active &&
        state.step == PipelineStep.paperCategoryCard &&
        !_advancedThisFrame) {
      ref.read(pipelineTutorialProvider.notifier).abandon();
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        const SnackBar(
          content: Text('Tutorial dismissed — replay anytime in Profile → Reset Tutorials.'),
        ),
      );
    }
    super.dispose();
  }

  void _maybePipelineCoachMark() {
    if (!mounted) return;
    final state = ref.read(pipelineTutorialProvider);
    if (!state.active || state.step != PipelineStep.paperCategoryCard) return;
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
            ref.read(pipelineTutorialProvider.notifier).advance();
            _selectCategory('paper');
          },
        ),
      ],
      () {},
      onSkip: () => ref.read(pipelineTutorialProvider.notifier).abandon(),
    );
  }

  Future<void> _loadDefaultPrintMode() async {
    try {
      final res = await ApiClient.instance.get('/users/profile');
      final mode = (res.data['defaultPrintMode'] as String?) ?? 'fitToPage';
      if (mounted) {
        ref.read(orderFlowProvider.notifier).setPrintMode(mode);
      }
    } catch (_) {
      // Non-critical — keep the current default
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

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
                    onPressed: () =>
                        context.go('/customer/order/checkout'),
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
                style: AppTypography.h1.copyWith(color: colors.onBackground),
              ).animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.xl),
              Expanded(
                child: ListView(
                  children: [
                    _CategoryCard(
                      tutorialKey: _paperCategoryKey,
                      illustration: PrinterIllustration(
                        size: 60,
                        color: colors.accent,
                      ),
                      title: 'Paper Printing',
                      description: 'Documents, posters, photos',
                      onTap: () => _selectCategory('paper'),
                    ).animate()
                      .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                      .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
                    const SizedBox(height: AppSpacing.md),
                    _CategoryCard(
                      illustration: ThreeDCubeIllustration(
                        size: 60,
                        color: colors.accent,
                      ),
                      title: '3D Printing',
                      description: 'Models, prototypes, figures',
                      onTap: () => _selectCategory('3d'),
                    ).animate()
                      .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                      .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _selectCategory(String category) async {
    ref.read(orderFlowProvider.notifier).setCategory(category);
    ref.read(orderFlowProvider.notifier).goToStep(1);
    await context.push(
      category == 'paper'
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
                  style: AppTypography.h3.copyWith(color: colors.onBackground),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  description,
                  style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
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
