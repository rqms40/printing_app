import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Admin profile screen with user info and sign-out.
class AdminProfileScreen extends ConsumerWidget {
  const AdminProfileScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final admin = MockData.adminUser;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.lg,
          ),
          children: [
            // Page title
            Text(
              'Profile',
              style: AppTypography.h1.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.lg),
            // Admin info card
          AppCard(
            child: Column(
              children: [
                // Avatar
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: colors.surfaceVariant,
                    shape: BoxShape.circle,
                  ),
                  child: HugeIcon(
                    icon: HugeIcons.strokeRoundedUser,
                    size: 32,
                    color: colors.onSurfaceDim,
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  admin.fullName ?? 'Admin',
                  style:
                      AppTypography.h2.copyWith(color: colors.onBackground),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  admin.email,
                  style:
                      AppTypography.body.copyWith(color: colors.onSurfaceDim),
                ),
                const SizedBox(height: AppSpacing.sm),
                const StatusBadge(
                  label: 'Admin',
                  variant: StatusBadgeVariant.info,
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),

          // App version
          AppCard(
            child: Row(
              children: [
                HugeIcon(icon: HugeIcons.strokeRoundedInformationCircle,
                    size: 20, color: colors.onSurfaceDim),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'DarkastixPrint Admin',
                        style: AppTypography.bodyBold
                            .copyWith(color: colors.onBackground),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Version 1.0.0',
                        style: AppTypography.caption
                            .copyWith(color: colors.onSurfaceDim),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),

          // Sign out
          AppButton(
            label: 'Sign Out',
            variant: AppButtonVariant.secondary,
            icon: HugeIcons.strokeRoundedLogout01,
            isFullWidth: true,
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
        ],
        ),
      ),
    );
  }
}
