import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/features/customer/order/screens/paper_specs_screen.dart';
import 'package:printing_app/features/customer/order/screens/three_d_specs_screen.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/app_illustrations.dart';
import 'package:printing_app/shared/widgets/step_indicator.dart';

/// Step 1/6 -- Category selection (Paper Printing or 3D Printing).
class CategoryScreen extends ConsumerWidget {
  const CategoryScreen({super.key});

  static const routeName = '/order/category';

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        title: Text(
          'New Order',
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
              const SizedBox(height: AppSpacing.xl),
              Text(
                'What would you\nlike to print?',
                style: AppTypography.h1.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: AppSpacing.xl),
              Expanded(
                child: Row(
                  children: [
                    Expanded(
                      child: _CategoryCard(
                        illustration: PrinterIllustration(
                          size: 80,
                          color: colors.accent,
                        ),
                        title: 'Paper Printing',
                        description: 'Documents, posters, photos',
                        onTap: () => _selectCategory(context, ref, 'paper'),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _CategoryCard(
                        illustration: ThreeDCubeIllustration(
                          size: 80,
                          color: colors.accent,
                        ),
                        title: '3D Printing',
                        description: 'Models, prototypes, figures',
                        onTap: () => _selectCategory(context, ref, '3d'),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }

  void _selectCategory(BuildContext context, WidgetRef ref, String category) {
    ref.read(orderFlowProvider.notifier).setCategory(category);
    ref.read(orderFlowProvider.notifier).goToStep(1);

    Navigator.of(context).push(
      MaterialPageRoute(
        builder: (_) => category == 'paper'
            ? const PaperSpecsScreen()
            : const ThreeDSpecsScreen(),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.illustration,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final Widget illustration;
  final String title;
  final String description;
  final VoidCallback onTap;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.all(AppSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          illustration,
          const SizedBox(height: AppSpacing.md),
          Text(
            title,
            style: AppTypography.h3.copyWith(color: colors.onBackground),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            description,
            style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.md),
          // Decorative accent line
          Container(
            width: 32,
            height: 1.5,
            decoration: BoxDecoration(
              color: colors.accent.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(1),
            ),
          ),
        ],
      ),
    );
  }
}
