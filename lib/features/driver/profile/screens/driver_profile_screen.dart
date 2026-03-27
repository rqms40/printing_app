import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/app_card.dart';

/// Provider managing the driver's availability toggle state.
final _driverAvailabilityProvider = StateProvider<bool>(
  (ref) => MockData.driverProfileJuan.isAvailable,
);

/// Driver profile screen with availability toggle, profile info, and vehicle info.
class DriverProfileScreen extends ConsumerWidget {
  const DriverProfileScreen({super.key});

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = _colors(context);
    final isAvailable = ref.watch(_driverAvailabilityProvider);
    final driver = MockData.driverProfileJuan;
    final user = MockData.driverJuan;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.surface,
        title: Text(
          'Profile',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          // Availability toggle
          AppCard(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isAvailable ? 'Online' : 'Offline',
                      style: AppTypography.h3.copyWith(
                        color: isAvailable
                            ? colors.success
                            : colors.onSurfaceDim,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      isAvailable
                          ? 'You are receiving delivery requests'
                          : 'You are not receiving requests',
                      style: AppTypography.caption
                          .copyWith(color: colors.onSurfaceDim),
                    ),
                  ],
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
          )
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          const SizedBox(height: AppSpacing.lg),

          // Profile info card
          Text(
            'PROFILE INFO',
            style: AppTypography.overline
                .copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Column(
              children: [
                _buildInfoRow(
                  context,
                  HugeIcons.strokeRoundedUser,
                  'Name',
                  user.fullName ?? 'Not set',
                ),
                const Divider(height: AppSpacing.lg),
                _buildInfoRow(
                  context,
                  HugeIcons.strokeRoundedMail01,
                  'Email',
                  user.email,
                ),
                const Divider(height: AppSpacing.lg),
                _buildInfoRow(
                  context,
                  HugeIcons.strokeRoundedCall,
                  'Phone',
                  user.phoneNumber ?? 'Not set',
                ),
              ],
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
          const SizedBox(height: AppSpacing.lg),

          // Vehicle info card
          Text(
            'VEHICLE INFO',
            style: AppTypography.overline
                .copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.sm),
          AppCard(
            child: Column(
              children: [
                _buildInfoRow(
                  context,
                  HugeIcons.strokeRoundedCar01,
                  'Vehicle Type',
                  driver.vehicleType.displayName,
                ),
                const Divider(height: AppSpacing.lg),
                _buildInfoRow(
                  context,
                  HugeIcons.strokeRoundedNote,
                  'Plate Number',
                  driver.plateNumber ?? 'Not set',
                ),
              ],
            ),
          )
              .animate()
              .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),
          const SizedBox(height: AppSpacing.md),

          // Edit Vehicle Info button
          AppButton(
            label: 'Edit Vehicle Info',
            variant: AppButtonVariant.secondary,
            isFullWidth: true,
            icon: HugeIcons.strokeRoundedEdit02,
            onTap: () {
              // Not implemented
            },
          ),
          const SizedBox(height: AppSpacing.xxl),

          // Sign Out button
          AppButton(
            label: 'Sign Out',
            variant: AppButtonVariant.ghost,
            isFullWidth: true,
            icon: HugeIcons.strokeRoundedLogout01,
            onTap: () {
              showDialog(
                context: context,
                builder: (ctx) => AlertDialog(
                  title: Text(
                    'Sign Out',
                    style: AppTypography.h3
                        .copyWith(color: colors.onBackground),
                  ),
                  content: Text(
                    'Are you sure you want to sign out?',
                    style: AppTypography.body
                        .copyWith(color: colors.onSurface),
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.of(ctx).pop(),
                      child: Text(
                        'Cancel',
                        style: AppTypography.button
                            .copyWith(color: colors.onSurfaceDim),
                      ),
                    ),
                    TextButton(
                      onPressed: () {
                        Navigator.of(ctx).pop();
                        ref.read(authProvider.notifier).logout();
                      },
                      child: Text(
                        'Sign Out',
                        style: AppTypography.button
                            .copyWith(color: colors.error),
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: AppSpacing.lg),
        ],
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
