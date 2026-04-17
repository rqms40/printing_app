import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:printing_app/features/auth/widgets/auth_form.dart';
import 'package:printing_app/shared/providers/theme_provider.dart';

/// Login screen -- the default entry point for unauthenticated users.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    ref.watch(themeProvider); // rebuild when theme changes
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.sm),
              Align(
                alignment: Alignment.centerRight,
                child: IconButton(
                  icon: HugeIcon(
                    icon: isDark
                        ? HugeIcons.strokeRoundedSun03
                        : HugeIcons.strokeRoundedMoon02,
                    color: colors.brand,
                    size: 22,
                  ),
                  onPressed: () =>
                      ref.read(themeProvider.notifier).toggleFrom(
                        Theme.of(context).brightness,
                      ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),

              // Heading
              Text(
                'Welcome back',
                style: AppTypography.h1.copyWith(
                  color: colors.onBackground,
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Sign in to continue',
                style: AppTypography.bodyLarge.copyWith(
                  color: colors.onSurfaceDim,
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xxl),

              // Auth form
              AuthForm(
                isLoading: authState.isLoading,
                onSubmit: (submission) {
                  ref
                      .read(authProvider.notifier)
                      .login(submission.email, submission.password);
                },
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),

              // Error message
              if (authState.errorMessage != null)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.sm),
                  child: Text(
                    authState.errorMessage!,
                    style: AppTypography.caption.copyWith(color: colors.error),
                    textAlign: TextAlign.center,
                  ),
                ),

              const SizedBox(height: AppSpacing.lg),

              // Switch to register
              Center(
                child: GestureDetector(
                  onTap: () {
                    context.push('/auth/register');
                  },
                  child: Text.rich(
                    TextSpan(
                      text: "Don't have an account? ",
                      style: AppTypography.body.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      children: [
                        TextSpan(
                          text: 'Create one',
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.accent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 180.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xxxl),

              // Dev bypass section
              _DevBypassSection(colors: colors)
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 240.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.02, duration: 400.ms, delay: 240.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Dev bypass buttons
// ---------------------------------------------------------------------------
class _DevBypassSection extends ConsumerWidget {
  const _DevBypassSection({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        Text(
          'DEV LOGIN',
          style: AppTypography.overline.copyWith(
            color: colors.onSurfaceDim,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            for (final role in ['Customer', 'Driver', 'Admin']) ...[
              if (role != 'Customer') const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: _DevRoleButton(
                  label: role,
                  colors: colors,
                  onTap: () {
                    ref
                        .read(authProvider.notifier)
                        .devBypass(role.toLowerCase());
                  },
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _DevRoleButton extends StatelessWidget {
  const _DevRoleButton({
    required this.label,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: Material(
        color: Colors.transparent,
        shape: RoundedRectangleBorder(
          borderRadius: AppRadius.borderMd,
          side: BorderSide(color: colors.outline),
        ),
        child: InkWell(
          onTap: onTap,
          borderRadius: AppRadius.borderMd,
          child: Center(
            child: Text(
              label,
              style: AppTypography.caption.copyWith(
                color: colors.onSurface,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
