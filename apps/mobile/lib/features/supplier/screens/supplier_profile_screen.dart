import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/app_version.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Supplier profile stub — identity + payout notice link + sign out.
class SupplierProfileScreen extends ConsumerWidget {
  const SupplierProfileScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final user = ref.watch(authProvider).user;
    final name = user?.fullName ?? 'Supplier';
    final email = user?.email ?? '—';
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'S';

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  AppSpacing.lg,
                  AppSpacing.xl,
                  AppSpacing.md,
                ),
                child: Text(
                  'Profile',
                  style: AppTypography.h1.copyWith(
                    color: colors.onBackground,
                  ),
                ),
              )
                  .animate()
                  .fadeIn(duration: 350.ms)
                  .slideY(begin: 0.02, duration: 350.ms),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Center(
                  child: Column(
                    children: [
                      Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          color: colors.surfaceVariant,
                          shape: BoxShape.circle,
                        ),
                        child: Center(
                          child: Text(
                            initial,
                            style: AppTypography.h1.copyWith(
                              color: colors.accent,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        name,
                        style: AppTypography.h2.copyWith(
                          color: colors.onBackground,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        email,
                        style: AppTypography.body.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      const StatusBadge(
                        label: 'Supplier',
                        variant: StatusBadgeVariant.info,
                      ),
                    ],
                  ),
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms)
                  .slideY(begin: 0.03, duration: 400.ms),

              const SizedBox(height: AppSpacing.xl),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: AppCard(
                  onTap: () => context.push('/supplier/payouts'),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: colors.surfaceVariant,
                          borderRadius: AppRadius.borderMd,
                        ),
                        child: Center(
                          child: HugeIcon(
                            icon: HugeIcons.strokeRoundedWallet01,
                            color: colors.accent,
                            size: 20,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Payouts',
                              style: AppTypography.bodyBold.copyWith(
                                color: colors.onBackground,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Coming soon — payout notices after delivery',
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                              ),
                            ),
                          ],
                        ),
                      ),
                      HugeIcon(
                        icon: HugeIcons.strokeRoundedArrowRight01,
                        color: colors.onSurfaceDim,
                        size: 18,
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: AppSpacing.lg),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Text(
                  'APP',
                  style: AppTypography.overline.copyWith(
                    color: colors.onSurfaceDim,
                    letterSpacing: 1.5,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Row(
                  children: [
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedInformationCircle,
                      color: colors.onSurfaceDim,
                      size: 18,
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: Text(
                        'GRIDGO Supplier',
                        style: AppTypography.body.copyWith(
                          color: colors.onBackground,
                        ),
                      ),
                    ),
                    Text(
                      AppVersion.display,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: AppSpacing.xl),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: HugeIcon(
                    icon: HugeIcons.strokeRoundedLogout01,
                    color: colors.error,
                    size: 22,
                  ),
                  title: Text(
                    'Sign Out',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.error,
                    ),
                  ),
                  onTap: () {
                    ConfirmationDialog.show(
                      context,
                      title: 'Sign Out',
                      message: 'Are you sure you want to sign out?',
                      confirmLabel: 'Sign Out',
                      cancelLabel: 'Cancel',
                      onConfirm: () {
                        ref.read(authProvider.notifier).logout();
                        Navigator.of(context).pop();
                      },
                      onCancel: () => Navigator.of(context).pop(),
                    );
                  },
                ),
              ),

              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }
}
