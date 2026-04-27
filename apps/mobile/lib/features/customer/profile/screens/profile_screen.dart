import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';
import 'package:printing_app/shared/services/api_client.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/features/customer/profile/screens/storage_settings_screen.dart';

final surveyVisibilityProvider = FutureProvider.autoDispose<bool>((ref) async {
  try {
    final response = await ApiClient.instance.get('/tam-surveys/settings');
    return response.data['isEnabled'] == true;
  } catch (e) {
    return true;
  }
});

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(profileProvider);
    ref.watch(themeProvider);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return ColoredBox(
      color: colors.background,
      child: SafeArea(
        child: Column(
          children: [
            // ── Header: title + avatar ─────────────────────────────────
            Padding(
              padding: const EdgeInsets.only(
                left: AppSpacing.xl,
                right: AppSpacing.xl,
                top: AppSpacing.lg,
                bottom: AppSpacing.md,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Profile',
                      style: AppTypography.h1
                          .copyWith(color: colors.onBackground),
                    ),
                  ),
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      shape: BoxShape.circle,
                    ),
                    child: Center(
                      child: Text(
                        user?.fullName.isNotEmpty == true
                            ? user!.fullName[0].toUpperCase()
                            : '?',
                        style: AppTypography.h3.copyWith(color: colors.accent),
                      ),
                    ),
                  ),
                ],
              ),
            )
                .animate()
                .fadeIn(duration: 350.ms, curve: Curves.easeOut)
                .slideY(begin: 0.02, duration: 350.ms, curve: Curves.easeOut),

            // ── Scrollable content ──────────────────────────────────────
            Expanded(
              child: _ProfileTab(user: user, colors: colors, isDark: isDark),
            ),
          ],
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Profile Tab Content (the original profile list)
// ---------------------------------------------------------------------------

class _ProfileTab extends ConsumerWidget {
  const _ProfileTab({
    required this.user,
    required this.colors,
    required this.isDark,
  });

  final dynamic user;
  final AppColorSet colors;
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final showSurvey = ref.watch(surveyVisibilityProvider).value ?? false;

    return SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Avatar + name card
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
                        user?.fullName.isNotEmpty == true
                            ? user!.fullName[0].toUpperCase()
                            : '?',
                        style: AppTypography.h1.copyWith(
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
          )
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          const SizedBox(height: AppSpacing.lg),

          // WALLET section
          _SectionHeader(label: 'WALLET', colors: colors)
              .animate()
              .fadeIn(duration: 400.ms, delay: 25.ms, curve: Curves.easeOut),
          _MenuRow(
            icon: HugeIcons.strokeRoundedCoins01,
            title: 'GRID Credits: ${user?.credits ?? "0.00"}',
            onTap: () {},
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedWalletAdd01,
            title: 'Top-Up Credits',
            onTap: () => context.push('/customer/profile/top-up'),
            colors: colors,
          ),
          const SizedBox(height: AppSpacing.lg),

          // ACCOUNT section
          _SectionHeader(label: 'ACCOUNT', colors: colors)
              .animate()
              .fadeIn(duration: 400.ms, delay: 50.ms, curve: Curves.easeOut),
          _MenuRow(
            icon: HugeIcons.strokeRoundedUser,
            title: 'Account Details',
            onTap: () => context.push('/customer/profile/account'),
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedLocation01,
            title: 'Saved Addresses',
            onTap: () => context.push('/customer/addresses'),
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedFolder01,
            title: 'Data Grid',
            onTap: () => context.push('/customer/uploads'),
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedCloudUpload,
            title: 'Storage & Files',
            onTap: () => context.push(StorageSettingsScreen.routeName),
            colors: colors,
          ),

          const SizedBox(height: AppSpacing.lg),

          // PREFERENCES section
          _SectionHeader(label: 'PREFERENCES', colors: colors)
              .animate()
              .fadeIn(duration: 400.ms, delay: 100.ms, curve: Curves.easeOut),
          _MenuToggleRow(
            icon: HugeIcons.strokeRoundedMoon02,
            title: 'Dark Mode',
            value: isDark,
            onChanged: (_) {
              ref.read(themeProvider.notifier).toggleFrom(
                    Theme.of(context).brightness,
                  );
            },
            colors: colors,
          ),
          _Divider(colors: colors),
          _PrintModeRow(colors: colors),

          const SizedBox(height: AppSpacing.lg),

          // SUPPORT section
          _SectionHeader(label: 'SUPPORT', colors: colors)
              .animate()
              .fadeIn(duration: 400.ms, delay: 150.ms, curve: Curves.easeOut),
          _MenuRow(
            icon: HugeIcons.strokeRoundedMessageQuestion,
            title: 'Support & Help',
            onTap: () => context.push('/customer/profile/support'),
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedFile02,
            title: 'Terms of Service',
            onTap: () => context.push('/customer/profile/terms'),
            colors: colors,
          ),
          _Divider(colors: colors),
          _MenuRow(
            icon: HugeIcons.strokeRoundedShield01,
            title: 'Privacy Policy',
            onTap: () => context.push('/customer/profile/privacy'),
            colors: colors,
          ),

          const SizedBox(height: AppSpacing.lg),

          // FEEDBACK section
          if (showSurvey) ...[
            _SectionHeader(label: 'FEEDBACK', colors: colors)
                .animate()
                .fadeIn(duration: 400.ms, delay: 175.ms, curve: Curves.easeOut),
            _MenuRow(
              icon: HugeIcons.strokeRoundedTaskEdit01,
              title: 'Survey',
              onTap: () => context.push('/customer/profile/survey'),
              colors: colors,
            ),
            const SizedBox(height: AppSpacing.lg),
          ],

          // Sign out
          _MenuRow(
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
            colors: colors,
          ),

          const SizedBox(height: AppSpacing.xxl),
        ],
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

/// Clean menu row: icon left, label center, chevron right.
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

/// Menu row with trailing toggle switch.
class _MenuToggleRow extends StatelessWidget {
  const _MenuToggleRow({
    required this.icon,
    required this.title,
    required this.value,
    required this.onChanged,
    required this.colors,
  });

  final dynamic icon;
  final String title;
  final bool value;
  final ValueChanged<bool> onChanged;
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
          HugeIcon(icon: icon, size: 20, color: colors.onSurface),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              title,
              style: AppTypography.body.copyWith(color: colors.onSurface),
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeThumbColor: colors.accent,
          ),
        ],
      ),
    );
  }
}

/// Stateful row that controls the Default Print Mode preference.
class _PrintModeRow extends StatefulWidget {
  const _PrintModeRow({required this.colors});

  final AppColorSet colors;

  @override
  State<_PrintModeRow> createState() => _PrintModeRowState();
}

class _PrintModeRowState extends State<_PrintModeRow> {
  String _printMode = 'fitToPage';
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _loadPrintMode();
  }

  Future<void> _loadPrintMode() async {
    try {
      final response = await ApiClient.instance.get('/users/profile');
      final data = response.data as Map<String, dynamic>;
      final mode = (data['defaultPrintMode'] as String?) ?? 'fitToPage';
      if (mounted) setState(() { _printMode = mode; _loaded = true; });
    } catch (_) {
      if (mounted) setState(() => _loaded = true);
    }
  }

  Future<void> _updatePrintMode(String mode) async {
    setState(() => _printMode = mode);
    try {
      await ApiClient.instance.patch('/users/me/profile', data: {'defaultPrintMode': mode});
    } catch (_) {
      // Silently fail — preference not critical
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_loaded) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xl,
        vertical: AppSpacing.md,
      ),
      child: Row(
        children: [
          Icon(Icons.fit_screen_outlined, size: 20, color: widget.colors.onSurface),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Default Print Mode',
                  style: AppTypography.body.copyWith(color: widget.colors.onSurface),
                ),
                Text(
                  _printMode == 'fitToPage' ? 'Fit to paper' : 'Actual size',
                  style: AppTypography.caption.copyWith(color: widget.colors.onSurfaceDim),
                ),
              ],
            ),
          ),
          SegmentedButton<String>(
            segments: const [
              ButtonSegment(value: 'fitToPage', label: Text('Fit')),
              ButtonSegment(value: 'actualSize', label: Text('Actual')),
            ],
            selected: {_printMode},
            onSelectionChanged: (val) => _updatePrintMode(val.first),
            style: ButtonStyle(
              visualDensity: VisualDensity.compact,
            ),
          ),
        ],
      ),
    );
  }
}

/// Thin horizontal divider with xl horizontal padding.
class _Divider extends StatelessWidget {
  const _Divider({required this.colors});

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
