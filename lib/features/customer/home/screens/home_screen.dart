import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/widgets/bento_grid.dart';
import 'package:printing_app/features/customer/home/widgets/popular_prints_section.dart';
import 'package:printing_app/features/customer/home/widgets/quick_actions_strip.dart';
import 'package:printing_app/features/customer/home/widgets/recent_orders_section.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Customer home screen with editorial hero banner, service cards, and recent orders.
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final authState = ref.watch(authProvider);
    final userName = authState.user?.fullName ?? 'there';

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: RefreshIndicator(
          color: colors.accent,
          backgroundColor: colors.surface,
          onRefresh: () async {
            await Future.delayed(const Duration(milliseconds: 500));
          },
          child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.lg),

              // Greeting header
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_greeting()},',
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  Text(
                    'Hello, $userName',
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                ],
              )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Bento grid
              const BentoGrid(),

              const SizedBox(height: AppSpacing.lg),

              // Recent orders section
              const RecentOrdersSection()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Quick actions strip
              const QuickActionsStrip()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 320.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 320.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Popular prints carousel
              const PopularPrintsSection()
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 400.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
        ),
      ),
    );
  }
}
