import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/order/providers/order_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
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
              ).animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.xl),
              Expanded(
                child: ListView(
                  children: [
                    _CategoryCard(
                      illustration: PrinterIllustration(
                        size: 60,
                        color: colors.accent,
                      ),
                      title: 'Paper Printing',
                      description: 'Documents, posters, photos',
                      onTap: () => _selectCategory(context, ref, 'paper'),
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
                      onTap: () => _selectCategory(context, ref, '3d'),
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

  void _selectCategory(BuildContext context, WidgetRef ref, String category) {
    ref.read(orderFlowProvider.notifier).setCategory(category);
    ref.read(orderFlowProvider.notifier).goToStep(1);

    // Pre-fill printMode from the user's saved preference (best-effort).
    ApiClient.instance.get('/users/profile').then((response) {
      final data = response.data as Map<String, dynamic>;
      final defaultMode = (data['defaultPrintMode'] as String?) ?? 'fitToPage';
      ref.read(orderFlowProvider.notifier).setPrintMode(defaultMode);
    }).catchError((_) {
      // Non-critical — keep the current default
    });

    context.push(
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
    );
  }
}
