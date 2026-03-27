import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';

/// Provider managing the driver's availability toggle state.
final _driverAvailabilityProvider = StateProvider<bool>(
  (ref) => MockData.driverProfileJuan.isAvailable,
);

/// Driver profile screen with body-first h1 layout.
class DriverProfileScreen extends ConsumerWidget {
  const DriverProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isAvailable = ref.watch(_driverAvailabilityProvider);
    final driver = MockData.driverProfileJuan;
    final user = MockData.driverJuan;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
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

              // Availability toggle card
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: AppRadius.borderMd,
                    boxShadow: isDark ? null : AppShadows.subtle,
                    border: isDark
                        ? Border.all(color: colors.outline, width: 0.5)
                        : null,
                  ),
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      // Status icon
                      Container(
                        width: 48,
                        height: 48,
                        decoration: BoxDecoration(
                          color: isAvailable
                              ? colors.success.withValues(alpha: 0.1)
                              : colors.surfaceVariant,
                          borderRadius: AppRadius.borderMd,
                        ),
                        child: Center(
                          child: HugeIcon(
                            icon: isAvailable
                                ? HugeIcons.strokeRoundedWifi01
                                : HugeIcons.strokeRoundedWifiOff01,
                            size: 22,
                            color: isAvailable
                                ? colors.success
                                : colors.onSurfaceDim,
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isAvailable ? 'Online' : 'Offline',
                              style: AppTypography.bodyBold.copyWith(
                                color: isAvailable
                                    ? colors.success
                                    : colors.onSurfaceDim,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isAvailable
                                  ? 'You are receiving delivery requests'
                                  : 'You are not receiving requests',
                              style: AppTypography.caption
                                  .copyWith(color: colors.onSurfaceDim),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: isAvailable,
                        onChanged: (value) {
                          ref
                              .read(_driverAvailabilityProvider.notifier)
                              .state = value;
                        },
                        activeThumbColor: colors.accent,
                        activeTrackColor:
                            colors.accent.withValues(alpha: 0.3),
                        inactiveThumbColor: colors.disabled,
                        inactiveTrackColor:
                            colors.disabled.withValues(alpha: 0.3),
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

              // PROFILE INFO section
              _SectionHeader(label: 'PROFILE INFO', colors: colors)
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 60.ms,
                      curve: Curves.easeOut),
              _InfoRow(
                icon: HugeIcons.strokeRoundedUser,
                label: 'Name',
                value: user.fullName ?? 'Not set',
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedMail01,
                label: 'Email',
                value: user.email,
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedCall,
                label: 'Phone',
                value: user.phoneNumber ?? 'Not set',
                colors: colors,
              ),

              const SizedBox(height: AppSpacing.lg),

              // VEHICLE INFO section
              _SectionHeader(label: 'VEHICLE INFO', colors: colors)
                  .animate()
                  .fadeIn(
                      duration: 400.ms,
                      delay: 120.ms,
                      curve: Curves.easeOut),
              _InfoRow(
                icon: HugeIcons.strokeRoundedCar01,
                label: 'Vehicle Type',
                value: driver.vehicleType.displayName,
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedNote,
                label: 'Plate Number',
                value: driver.plateNumber ?? 'Not set',
                colors: colors,
              ),

              const SizedBox(height: AppSpacing.md),

              // Edit Vehicle Info button
              Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: AppButton(
                  label: 'Edit Vehicle Info',
                  variant: AppButtonVariant.secondary,
                  isFullWidth: true,
                  icon: HugeIcons.strokeRoundedEdit02,
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      shape: const RoundedRectangleBorder(
                        borderRadius: BorderRadius.vertical(
                          top: Radius.circular(AppRadius.lg),
                        ),
                      ),
                      builder: (_) => Padding(
                        padding: EdgeInsets.only(
                          left: AppSpacing.lg,
                          right: AppSpacing.lg,
                          top: AppSpacing.lg,
                          bottom:
                              MediaQuery.of(context).viewInsets.bottom +
                                  AppSpacing.lg,
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            // Drag handle
                            Center(
                              child: Container(
                                width: 40,
                                height: 4,
                                decoration: BoxDecoration(
                                  color: colors.disabled,
                                  borderRadius: AppRadius.borderFull,
                                ),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            Text(
                              'Edit Vehicle Info',
                              style: AppTypography.h3
                                  .copyWith(color: colors.onBackground),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              label: 'Vehicle Type',
                              hintText: 'e.g. Motorcycle',
                              controller: TextEditingController(),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            AppTextField(
                              label: 'Plate Number',
                              hintText: 'e.g. ABC 1234',
                              controller: TextEditingController(),
                            ),
                            const SizedBox(height: AppSpacing.lg),
                            AppButton(
                              label: 'Save Changes',
                              onTap: () => Navigator.pop(context),
                              isFullWidth: true,
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),

              // Sign Out
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

              const SizedBox(height: AppSpacing.lg),
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
