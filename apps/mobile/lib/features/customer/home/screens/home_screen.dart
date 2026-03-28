import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/home/widgets/bento_grid.dart';
import 'package:printing_app/features/customer/home/widgets/popular_prints_section.dart';
import 'package:printing_app/features/customer/home/widgets/quick_actions_strip.dart';
import 'package:printing_app/features/customer/home/widgets/recent_orders_section.dart';
import 'package:printing_app/shared/services/draft_storage_service.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Customer home screen with editorial hero banner, service cards, and recent orders.
class HomeScreen extends ConsumerStatefulWidget {
  const HomeScreen({super.key});

  @override
  ConsumerState<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends ConsumerState<HomeScreen> {
  /// Tracks whether the draft banner has been dismissed this session.
  bool _draftDismissed = false;

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
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final authState = ref.watch(authProvider);
    final userName = authState.user?.fullName ?? 'there';
    final hasDraft = !_draftDismissed && DraftStorageService.hasDraft;

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

              // Resume draft banner
              if (hasDraft) ...[
                Container(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: AppRadius.borderMd,
                    border: Border.all(color: colors.brand),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.edit_note_rounded, color: colors.brand),
                      const SizedBox(width: AppSpacing.sm),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Continue your order',
                                style: AppTypography.bodyBold),
                            Text('You have an unfinished order',
                                style: AppTypography.caption),
                          ],
                        ),
                      ),
                      TextButton(
                        onPressed: () => context.push('/customer/order/new'),
                        child: Text('Resume',
                            style: TextStyle(color: colors.brand)),
                      ),
                      IconButton(
                        icon: const Icon(Icons.close, size: 18),
                        onPressed: () {
                          DraftStorageService.clearDraft();
                          setState(() => _draftDismissed = true);
                        },
                      ),
                    ],
                  ),
                )
                    .animate()
                    .fadeIn(duration: 300.ms, curve: Curves.easeOut)
                    .slideY(begin: 0.02, duration: 300.ms, curve: Curves.easeOut),
                const SizedBox(height: AppSpacing.md),
              ],

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
