import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/status_badge.dart';

/// Admin profile screen with body-first h1 layout.
class AdminProfileScreen extends ConsumerWidget {
  const AdminProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final admin = MockData.adminUser;
    final initial = (admin.fullName?.isNotEmpty == true)
        ? admin.fullName![0].toUpperCase()
        : 'A';

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // h1 title
              Padding(
                padding: const EdgeInsets.only(
                  left: AppSpacing.xl,
                  right: AppSpacing.xl,
                  top: AppSpacing.lg,
                  bottom: AppSpacing.md,
                ),
                child: Text(
                  'Profile',
                  style:
                      AppTypography.h1.copyWith(color: colors.onBackground),
                ),
              )
                  .animate()
                  .fadeIn(duration: 350.ms, curve: Curves.easeOut)
                  .slideY(
                      begin: 0.02,
                      duration: 350.ms,
                      curve: Curves.easeOut),

              // Avatar + name card
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
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
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(
                      begin: 0.03,
                      duration: 400.ms,
                      curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.lg),

              // CONTACT section
              _SectionHeader(label: 'CONTACT', colors: colors)
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 60.ms,
                      curve: Curves.easeOut),
              _InfoRow(
                icon: HugeIcons.strokeRoundedMail01,
                label: 'Email',
                value: admin.email,
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedCall,
                label: 'Phone',
                value: admin.phoneNumber ?? 'Not set',
                colors: colors,
              ),

              const SizedBox(height: AppSpacing.lg),

              // APP section
              _SectionHeader(label: 'APP', colors: colors)
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 120.ms,
                      curve: Curves.easeOut),
              _InfoRow(
                icon: HugeIcons.strokeRoundedInformationCircle,
                label: 'DarkastixPrint Admin',
                value: 'Version 1.0.0',
                colors: colors,
              ),

              const SizedBox(height: AppSpacing.xl),

              // Sign out
              _MenuRow(
                icon: HugeIcons.strokeRoundedLogout01,
                title: 'Sign Out',
                isDestructive: true,
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
                colors: colors,
              ),

              const SizedBox(height: AppSpacing.xxl),
            ],
          ),
        ),
      ),
    );
  }
}

/// Overline section header.
class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label, required this.colors});

  final String label;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(
        left: AppSpacing.xl,
        right: AppSpacing.xl,
        bottom: AppSpacing.sm,
      ),
      child: Text(
        label,
        style: AppTypography.overline.copyWith(
          color: colors.onSurfaceDim,
          letterSpacing: 1.5,
        ),
      ),
    );
  }
}

/// Info row: icon + label/value pair.
class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    required this.colors,
  });

  final dynamic icon;
  final String label;
  final String value;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xl,
        vertical: AppSpacing.md,
      ),
      child: Row(
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
      ),
    );
  }
}

/// Clean menu row with icon, label, and chevron.
class _MenuRow extends StatelessWidget {
  const _MenuRow({
    required this.icon,
    required this.title,
    this.onTap,
    this.isDestructive = false,
    required this.colors,
  });

  final dynamic icon;
  final String title;
  final VoidCallback? onTap;
  final bool isDestructive;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final textColor = isDestructive ? colors.error : colors.onSurface;

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.xl,
            vertical: AppSpacing.md,
          ),
          child: Row(
            children: [
              HugeIcon(icon: icon, size: 20, color: textColor),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.body.copyWith(color: textColor),
                ),
              ),
              HugeIcon(
                icon: HugeIcons.strokeRoundedArrowRight01,
                size: 18,
                color: colors.onSurfaceDim,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Thin horizontal divider.
class _RowDivider extends StatelessWidget {
  const _RowDivider({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Container(
        height: 1,
        color: colors.outlineVariant,
      ),
    );
  }
}
