import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/address/screens/address_list_screen.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/features/customer/profile/screens/account_details_screen.dart';
import 'package:printing_app/features/customer/profile/screens/privacy_screen.dart';
import 'package:printing_app/features/customer/profile/screens/support_screen.dart';
import 'package:printing_app/features/customer/profile/screens/terms_screen.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';
import 'package:printing_app/shared/widgets/app_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(profileProvider);
    final themeMode = ref.watch(themeProvider);
    final isDark = themeMode == ThemeMode.dark;
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            children: [
              const SizedBox(height: AppSpacing.lg),
              // User info card
              AppCard(
                child: Column(
                  children: [
                    // Avatar
                    Container(
                      width: 72,
                      height: 72,
                      decoration: BoxDecoration(
                        color: colors.surfaceVariant,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text(
                          user?.fullName.isNotEmpty == true
                              ? user!.fullName[0].toUpperCase()
                              : '?',
                          style: AppTypography.display.copyWith(
                            color: colors.accent,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      user?.fullName ?? 'Guest',
                      style: AppTypography.h2.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      user?.email ?? '',
                      style: AppTypography.body.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              // Menu items
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _MenuItem(
                      icon: HugeIcons.strokeRoundedUser,
                      title: 'Account Details',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AccountDetailsScreen(),
                        ),
                      ),
                    ),
                    Divider(height: 1, color: colors.outlineVariant),
                    _MenuItem(
                      icon: HugeIcons.strokeRoundedLocation01,
                      title: 'Saved Addresses',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const AddressListScreen(),
                        ),
                      ),
                    ),
                    Divider(height: 1, color: colors.outlineVariant),
                    _MenuToggle(
                      icon: HugeIcons.strokeRoundedMoon02,
                      title: 'Dark Mode',
                      value: isDark,
                      onChanged: (_) {
                        ref.read(themeProvider.notifier).toggle();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    _MenuItem(
                      icon: HugeIcons.strokeRoundedMessageQuestion,
                      title: 'Support & Help',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const SupportScreen(),
                        ),
                      ),
                    ),
                    Divider(height: 1, color: colors.outlineVariant),
                    _MenuItem(
                      icon: HugeIcons.strokeRoundedFile02,
                      title: 'Terms of Service',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const TermsScreen(),
                        ),
                      ),
                    ),
                    Divider(height: 1, color: colors.outlineVariant),
                    _MenuItem(
                      icon: HugeIcons.strokeRoundedShield01,
                      title: 'Privacy Policy',
                      onTap: () => Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const PrivacyScreen(),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              AppCard(
                padding: EdgeInsets.zero,
                child: _MenuItem(
                  icon: HugeIcons.strokeRoundedLogout01,
                  title: 'Sign Out',
                  isDestructive: true,
                  onTap: () {
                    ConfirmationDialog.show(
                      context,
                      title: 'Sign Out',
                      message:
                          'Are you sure you want to sign out of your account?',
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

class _MenuItem extends StatelessWidget {
  const _MenuItem({
    required this.icon,
    required this.title,
    this.onTap,
    this.isDestructive = false,
  });

  final dynamic icon;
  final String title;
  final VoidCallback? onTap;
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final textColor = isDestructive ? colors.error : colors.onSurface;

    return ListTile(
      leading: HugeIcon(icon: icon, size: 20, color: textColor),
      title: Text(
        title,
        style: AppTypography.body.copyWith(color: textColor),
      ),
      trailing: HugeIcon(
        icon: HugeIcons.strokeRoundedArrowRight01,
        size: 18,
        color: colors.onSurfaceDim,
      ),
      onTap: onTap,
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
    );
  }
}

class _MenuToggle extends StatelessWidget {
  const _MenuToggle({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
  });

  final dynamic icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return ListTile(
      leading: HugeIcon(icon: icon, size: 20, color: colors.onSurface),
      title: Text(
        title,
        style: AppTypography.body.copyWith(color: colors.onSurface),
      ),
      trailing: Switch(
        value: value,
        onChanged: onChanged,
        activeThumbColor: colors.accent,
      ),
      contentPadding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.xs,
      ),
    );
  }
}
