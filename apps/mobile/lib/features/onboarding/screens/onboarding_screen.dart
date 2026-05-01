import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/onboarding/models/onboarding_page_data.dart';
import 'package:printing_app/features/onboarding/widgets/onboarding_illustrations.dart';
import 'package:printing_app/features/tutorial/models/tutorial_key.dart';
import 'package:printing_app/features/tutorial/providers/tutorial_provider.dart';

/// Role-specific onboarding screen shown every login.
///
/// Displays swipeable pages tailored to the user's role (customer, driver,
/// admin) with animated illustrations, dot indicator, and a "Get Started" CTA
/// on the final page. Customer and Driver get 5 pages; Admin gets 3.
class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  late final PageController _pageController;
  int _currentPage = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  /// Navigate to the role-specific home screen.
  void _goToHome() {
    ref.read(tutorialProvider.notifier).markSeen(TutorialKey.onboarding);
    final role = ref.read(authProvider).user?.role ?? 'customer';
    switch (role) {
      case 'driver':
        context.go('/driver/deliveries');
      case 'admin':
        context.go('/admin/dashboard');
      default:
        context.go('/customer/home');
    }
  }

  void _nextPage() {
    final pages = _pages;
    if (_currentPage < pages.length - 1) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeOutCubic,
      );
    } else {
      _goToHome();
    }
  }

  List<OnboardingPageData> get _pages {
    final role = ref.read(authProvider).user?.role ?? 'customer';
    return OnboardingPageData.forRole(role);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final pages = _pages;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: Column(
          children: [
            // ---------------------------------------------------------------
            // Top bar: Skip button
            // ---------------------------------------------------------------
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.xl,
                vertical: AppSpacing.sm,
              ),
              child: Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: _goToHome,
                  child: Text(
                    'Skip',
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ),
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut),

            // ---------------------------------------------------------------
            // Page content (expandable)
            // ---------------------------------------------------------------
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                itemCount: pages.length,
                onPageChanged: (i) => setState(() => _currentPage = i),
                physics: const BouncingScrollPhysics(),
                itemBuilder: (context, index) {
                  return _OnboardingPage(
                    data: pages[index],
                    colors: colors,
                  );
                },
              ),
            ),

            // ---------------------------------------------------------------
            // Bottom section: dots + button
            // ---------------------------------------------------------------
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
              child: Column(
                children: [
                  // Dot indicator
                  _DotIndicator(
                    count: pages.length,
                    currentIndex: _currentPage,
                    colors: colors,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Next / Get Started button
                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _nextPage,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.accent,
                        foregroundColor: colors.accentOnColor,
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadius.borderMd,
                        ),
                        elevation: 0,
                      ),
                      child: AnimatedSwitcher(
                        duration: const Duration(milliseconds: 200),
                        child: Text(
                          _currentPage == pages.length - 1
                              ? 'Get Started'
                              : 'Next',
                          key: ValueKey(_currentPage == pages.length - 1),
                          style: AppTypography.button,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 400.ms, delay: 200.ms, curve: Curves.easeOut)
                .slideY(
                    begin: 0.05,
                    duration: 400.ms,
                    delay: 200.ms,
                    curve: Curves.easeOut),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Single onboarding page content
// ---------------------------------------------------------------------------
class _OnboardingPage extends StatelessWidget {
  const _OnboardingPage({
    required this.data,
    required this.colors,
  });

  final OnboardingPageData data;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Spacer(flex: 1),

          // Illustration with decorative circle
          OnboardingIllustrationWidget(
            type: data.illustrationType,
            size: 180,
          )
              .animate()
              .fadeIn(duration: 500.ms, curve: Curves.easeOut)
              .scale(
                  begin: const Offset(0.9, 0.9),
                  end: const Offset(1.0, 1.0),
                  duration: 500.ms,
                  curve: Curves.easeOut),

          const Spacer(flex: 1),

          // Overline label (brand yellow)
          Text(
            data.overline,
            style: AppTypography.overline.copyWith(
              color: colors.brand,
            ),
            textAlign: TextAlign.center,
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 100.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.08,
                  duration: 400.ms,
                  delay: 100.ms,
                  curve: Curves.easeOut),

          const SizedBox(height: AppSpacing.md),

          // Bold heading
          Text(
            data.heading,
            style: AppTypography.h1.copyWith(
              color: colors.onBackground,
              height: 1.2,
            ),
            textAlign: TextAlign.center,
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 180.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.08,
                  duration: 400.ms,
                  delay: 180.ms,
                  curve: Curves.easeOut),

          const SizedBox(height: AppSpacing.md),

          // Body text
          Text(
            data.body,
            style: AppTypography.bodyLarge.copyWith(
              color: colors.onSurfaceDim,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 260.ms, curve: Curves.easeOut)
              .slideY(
                  begin: 0.06,
                  duration: 400.ms,
                  delay: 260.ms,
                  curve: Curves.easeOut),

          const Spacer(flex: 2),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Animated dot indicator with expanding active pill
// ---------------------------------------------------------------------------
class _DotIndicator extends StatelessWidget {
  const _DotIndicator({
    required this.count,
    required this.currentIndex,
    required this.colors,
  });

  final int count;
  final int currentIndex;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(count, (i) {
        final isActive = i == currentIndex;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOutCubic,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          width: isActive ? 24 : 8,
          height: 8,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: isActive ? colors.accent : colors.surfaceDim,
          ),
        );
      }),
    );
  }
}
