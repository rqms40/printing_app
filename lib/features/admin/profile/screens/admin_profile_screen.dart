import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:iconsax_flutter/iconsax_flutter.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
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
      body: ListView(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xl,
          vertical: AppSpacing.lg,
        ),
        children: [
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
                  child: Icon(
                    Iconsax.user,
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
                Icon(Iconsax.info_circle,
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
            icon: Iconsax.logout,
            isFullWidth: true,
            onTap: () {
              ConfirmationDialog.show(
                context,
                title: 'Sign Out',
                message: 'Are you sure you want to sign out?',
                confirmLabel: 'Sign Out',
                cancelLabel: 'Cancel',
                onConfirm: () {
                  Navigator.of(context).pop();
                  // In production, navigate to login screen
                },
                onCancel: () => Navigator.of(context).pop(),
              );
            },
          ),
        ],
      ),
    );
  }
}
