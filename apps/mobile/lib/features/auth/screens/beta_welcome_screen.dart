import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// The "press proof" reveal shown right after a beta-eligible signup: the
/// tester's founding number stamps in like a print serial and the 100-credit
/// grant lands like ink on paper. This is registration's peak-and-end moment,
/// turning the previously invisible server enrollment into something felt.
class BetaWelcomeScreen extends ConsumerWidget {
  const BetaWelcomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    const dark = AppColors.dark; // reveal is always the dark press-proof look
    final beta = ref.watch(betaStatusProvider).valueOrNull;
    final credits = ref.watch(
      authProvider.select((s) => s.user?.credits),
    );
    final rankLabel = beta?.rank != null
        ? '#${beta!.rank.toString().padLeft(3, '0')}'
        : '#000';
    final creditsLabel = credits != null
        ? '${double.tryParse(credits)?.toStringAsFixed(0) ?? credits} GRIDGO Credits'
        : '100 GRIDGO Credits';
    final reduceMotion = MediaQuery.disableAnimationsOf(context);

    Widget stamp(Widget child, {int delayMs = 0}) {
      if (reduceMotion) return child;
      return child
          .animate()
          .fadeIn(delay: delayMs.ms, duration: 420.ms)
          .scaleXY(begin: 0.9, end: 1, delay: delayMs.ms, duration: 420.ms);
    }

    return Scaffold(
      backgroundColor: dark.background,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              const Spacer(),
              stamp(const _GridGoDots()),
              const SizedBox(height: AppSpacing.xl),
              stamp(
                Text(
                  'FOUNDING TESTER',
                  style: AppTypography.overline.copyWith(
                    color: dark.brand,
                    fontSize: 13,
                    letterSpacing: 3,
                  ),
                ),
                delayMs: 120,
              ),
              const SizedBox(height: AppSpacing.sm),
              stamp(
                Text(
                  rankLabel,
                  style: AppTypography.display.copyWith(
                    color: dark.onBackground,
                    fontSize: 64,
                    height: 1,
                  ),
                ),
                delayMs: 240,
              ),
              const SizedBox(height: AppSpacing.xl),
              stamp(
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.lg,
                    vertical: AppSpacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: dark.brand.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: dark.brand, width: 1),
                  ),
                  child: Text(
                    creditsLabel,
                    style: AppTypography.h2.copyWith(color: dark.brand),
                  ),
                ),
                delayMs: 380,
              ),
              const SizedBox(height: AppSpacing.md),
              stamp(
                Text(
                  'Loaded to your wallet — beta prints are on us.',
                  textAlign: TextAlign.center,
                  style: AppTypography.body.copyWith(color: dark.onSurfaceDim),
                ),
                delayMs: 480,
              ),
              const Spacer(),
              AppButton(
                label: 'Start printing',
                variant: AppButtonVariant.brand,
                isFullWidth: true,
                onTap: () {
                  // The reveal is the beta tester's welcome, so skip the
                  // separate onboarding carousel and go straight to printing.
                  ref
                      .read(tutorialProvider.notifier)
                      .markSeen(TutorialKey.onboarding);
                  context.go('/customer/home');
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The GRIDGO 3×3 dot-grid mark, brand dot lit.
class _GridGoDots extends StatelessWidget {
  const _GridGoDots();

  @override
  Widget build(BuildContext context) {
    const dark = AppColors.dark;
    return SizedBox(
      width: 54,
      height: 54,
      child: GridView.count(
        crossAxisCount: 3,
        physics: const NeverScrollableScrollPhysics(),
        mainAxisSpacing: 6,
        crossAxisSpacing: 6,
        children: List.generate(9, (i) {
          final lit = i == 2; // top-right, matching the logo accent dot
          return DecoratedBox(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: lit ? dark.brand : dark.onSurfaceDim,
            ),
          );
        }),
      ),
    );
  }
}
