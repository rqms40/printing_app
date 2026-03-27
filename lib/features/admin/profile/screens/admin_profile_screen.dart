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
    final initial = (admin.fullName?.isNotEmpty == true)
        ? admin.fullName![0].toUpperCase()
        : 'A';

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Page title
              Text(
                'Profile',
                style:
                    AppTypography.h1.copyWith(color: colors.onBackground),
              ),
              const SizedBox(height: AppSpacing.lg),

              // User info card with avatar, name, email, role badge
              AppCard(
                child: Column(
                  children: [
                    // Avatar with initial
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
                          style: AppTypography.display.copyWith(
                            color: colors.accent,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      admin.fullName ?? 'Admin',
                      style: AppTypography.h2
                          .copyWith(color: colors.onBackground),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      admin.email,
                      style: AppTypography.body
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    const StatusBadge(
                      label: 'Admin',
                      variant: StatusBadgeVariant.info,
                    ),
                  ],
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(
                      begin: 0.03,
                      duration: 400.ms,
                      curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.lg),

              // Contact details card
              AppCard(
                child: Column(
                  children: [
                    _buildInfoRow(
                      context,
                      HugeIcons.strokeRoundedMail01,
                      'Email',
                      admin.email,
                    ),
                    const Divider(height: AppSpacing.lg),
                    _buildInfoRow(
                      context,
                      HugeIcons.strokeRoundedCall,
                      'Phone',
                      admin.phoneNumber ?? 'Not set',
                    ),
                  ],
                ),
              )
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 60.ms,
                      curve: Curves.easeOut)
                  .slideY(
                      begin: 0.03,
                      duration: 400.ms,
                      delay: 60.ms,
                      curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.lg),

              // App version
              AppCard(
                child: Row(
                  children: [
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedInformationCircle,
                      size: 20,
                      color: colors.onSurfaceDim,
                    ),
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
              )
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 120.ms,
                      curve: Curves.easeOut)
                  .slideY(
                      begin: 0.03,
                      duration: 400.ms,
                      delay: 120.ms,
                      curve: Curves.easeOut),
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
      ),
    );
  }

  Widget _buildInfoRow(
    BuildContext context,
    dynamic icon,
    String label,
    String value,
  ) {
    final colors = _colors(context);
    return Row(
      children: [
        HugeIcon(icon: icon, size: 20, color: colors.onSurfaceDim),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTypography.caption
                    .copyWith(color: colors.onSurfaceDim),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                value,
                style: AppTypography.body
                    .copyWith(color: colors.onBackground),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
