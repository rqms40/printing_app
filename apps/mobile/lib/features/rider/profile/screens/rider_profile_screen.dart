import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/config/theme/app_shadows.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/rider/profile/providers/rider_profile_provider.dart';
import 'package:printing_app/features/rider/shared/rider_theme.dart';
import 'package:printing_app/features/rider/shared/widgets/rider_page_header.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';

/// Rider profile with live availability and vehicle management.
class RiderProfileScreen extends ConsumerStatefulWidget {
  const RiderProfileScreen({super.key});

  @override
  ConsumerState<RiderProfileScreen> createState() => _RiderProfileScreenState();
}

class _RiderProfileScreenState extends ConsumerState<RiderProfileScreen> {
  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  void _showEditVehicleSheet(RiderProfileState profile) {
    final colors = _colors(context);
    final vehicleController = TextEditingController(text: profile.vehicleType);
    final plateController = TextEditingController(text: profile.plateNumber);
    var isSaving = false;

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(AppRadius.lg)),
      ),
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            // Keyboard inset pushes the content up; the scroll view guarantees
            // the Save button is always reachable on short screens.
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(context).viewInsets.bottom,
              ),
              child: SingleChildScrollView(
                padding: EdgeInsets.only(
                  left: AppSpacing.lg,
                  right: AppSpacing.lg,
                  top: AppSpacing.lg,
                  bottom: AppSpacing.lg + MediaQuery.of(context).viewPadding.bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
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
                    'Edit vehicle info',
                    style: AppTypography.h3.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    label: 'Vehicle type',
                    hintText: 'e.g. Motorcycle',
                    controller: vehicleController,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AppTextField(
                    label: 'Plate number',
                    hintText: 'e.g. ABC 1234',
                    controller: plateController,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppButton(
                    label: 'Save changes',
                    isFullWidth: true,
                    isLoading: isSaving,
                    onTap: isSaving
                        ? null
                        : () async {
                            setSheetState(() => isSaving = true);
                            final ok = await ref
                                .read(riderProfileProvider.notifier)
                                .updateVehicle(
                                  vehicleType: vehicleController.text.trim(),
                                  plateNumber: plateController.text.trim(),
                                );
                            if (!context.mounted) return;
                            setSheetState(() => isSaving = false);
                            if (ok) Navigator.pop(sheetContext);
                          },
                  ),
                  ],
                ),
              ),
            );
          },
        );
      },
    ).whenComplete(() {
      vehicleController.dispose();
      plateController.dispose();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final profile = ref.watch(riderProfileProvider);

    if (profile.isLoading) {
      return ColoredBox(
        color: colors.background,
        child: const SafeArea(
          child: Center(child: CircularProgressIndicator()),
        ),
      );
    }

    return ColoredBox(
      color: RiderTheme.background,
      child: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const RiderPageHeader(
                title: 'Profile',
                subtitle: 'Manage availability and vehicle details',
              ).animate().fadeIn(duration: 350.ms),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: Container(
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: AppRadius.borderMd,
                    boxShadow: isDark ? null : AppShadows.subtle,
                    border: Border.all(
                      color: profile.isAvailable
                          ? colors.success.withValues(alpha: 0.35)
                          : colors.outline.withValues(alpha: 0.5),
                    ),
                  ),
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Row(
                    children: [
                      Container(
                        width: 52,
                        height: 52,
                        decoration: BoxDecoration(
                          color: profile.isAvailable
                              ? colors.success.withValues(alpha: 0.12)
                              : colors.surfaceVariant,
                          borderRadius: AppRadius.borderMd,
                        ),
                        child: Center(
                          child: HugeIcon(
                            icon: profile.isAvailable
                                ? HugeIcons.strokeRoundedWifi01
                                : HugeIcons.strokeRoundedWifiOff01,
                            size: 24,
                            color: profile.isAvailable
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
                              profile.isAvailable ? 'Online' : 'Offline',
                              style: AppTypography.bodyBold.copyWith(
                                color: profile.isAvailable
                                    ? colors.success
                                    : colors.onSurfaceDim,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              profile.isAvailable
                                  ? 'Receiving delivery assignments'
                                  : 'You will not receive new jobs',
                              style: AppTypography.caption.copyWith(
                                color: colors.onSurfaceDim,
                              ),
                            ),
                          ],
                        ),
                      ),
                      Switch(
                        value: profile.isAvailable,
                        onChanged: (value) => ref
                            .read(riderProfileProvider.notifier)
                            .setAvailability(value),
                        activeThumbColor: colors.accent,
                        activeTrackColor: colors.accent.withValues(alpha: 0.3),
                      ),
                    ],
                  ),
                ),
              ).animate().fadeIn(duration: 400.ms, delay: 40.ms),
              const SizedBox(height: AppSpacing.lg),
              _SectionHeader(label: 'PROFILE INFO', colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedUser,
                label: 'Name',
                value: profile.fullName ?? 'Not set',
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedMail01,
                label: 'Email',
                value: profile.email ?? 'Not set',
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedCall,
                label: 'Phone',
                value: profile.phoneNumber ?? 'Not set',
                colors: colors,
              ),
              const SizedBox(height: AppSpacing.lg),
              _SectionHeader(label: 'VEHICLE INFO', colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedCar01,
                label: 'Vehicle type',
                value: profile.vehicleType ?? 'Not set',
                colors: colors,
              ),
              _RowDivider(colors: colors),
              _InfoRow(
                icon: HugeIcons.strokeRoundedNote,
                label: 'Plate number',
                value: profile.plateNumber ?? 'Not set',
                colors: colors,
              ),
              const SizedBox(height: AppSpacing.md),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
                child: AppButton(
                  label: 'Edit vehicle info',
                  variant: AppButtonVariant.secondary,
                  isFullWidth: true,
                  icon: HugeIcons.strokeRoundedEdit02,
                  onTap: () => _showEditVehicleSheet(profile),
                ),
              ),
              const SizedBox(height: AppSpacing.xxl),
              _MenuRow(
                icon: HugeIcons.strokeRoundedLogout01,
                title: 'Sign out',
                isDestructive: true,
                onTap: () {
                  ConfirmationDialog.show(
                    context,
                    title: 'Sign out',
                    message: 'Are you sure you want to sign out?',
                    confirmLabel: 'Sign out',
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
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  value,
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

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

class _RowDivider extends StatelessWidget {
  const _RowDivider({required this.colors});

  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Container(height: 1, color: colors.outlineVariant),
    );
  }
}
