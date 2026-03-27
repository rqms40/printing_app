import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/auth_form.dart';

/// Login screen -- the default entry point for unauthenticated users.
class LoginScreen extends ConsumerWidget {
  const LoginScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.xxl),

              // Heading
              Text(
                'Welcome back',
                style: AppTypography.display.copyWith(
                  color: colors.onBackground,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              Text(
                'Sign in to continue',
                style: AppTypography.bodyLarge.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),

              const SizedBox(height: AppSpacing.xxl),

              // Auth form
              AuthForm(
                isLoading: authState.isLoading,
                onSubmit: (email, password) {
                  ref.read(authProvider.notifier).login(email, password);
                },
              ),

              const SizedBox(height: AppSpacing.lg),

              // Switch to register
              Center(
                child: GestureDetector(
                  onTap: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => const _RegisterScreenPlaceholder(),
                      ),
                    );
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
              ),

              const SizedBox(height: AppSpacing.xxxl),

              // Dev bypass section
              _DevBypassSection(colors: colors),

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

// Temporary placeholder -- will be replaced by proper navigation once
// RegisterScreen is wired via go_router.
class _RegisterScreenPlaceholder extends StatelessWidget {
  const _RegisterScreenPlaceholder();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(body: Center(child: Text('Register')));
  }
}
