import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/auth_form.dart';

/// Registration screen for new users.
class RegisterScreen extends ConsumerWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    // Navigate to profile setup when registration succeeds.
    ref.listen<AuthState>(authProvider, (prev, next) {
      if (next.status == AuthStatus.profileIncomplete && prev?.status != next.status) {
        context.pushReplacement('/auth/profile-setup');
      }
    });

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
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Create Account',
                    style: AppTypography.h1.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Sign up to get started',
                    style: AppTypography.bodyLarge.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                ],
              ).animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xxl),

              // Auth form (register mode)
              AuthForm(
                isRegister: true,
                isLoading: authState.isLoading,
                onSubmit: (email, password) {
                  ref.read(authProvider.notifier).register(email, password);
                },
              ).animate()
                .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.lg),

              // Switch to login
              Center(
                child: GestureDetector(
                  onTap: () => context.pop(),
                  child: Text.rich(
                    TextSpan(
                      text: 'Already have an account? ',
                      style: AppTypography.body.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      children: [
                        TextSpan(
                          text: 'Sign in',
                          style: AppTypography.bodyBold.copyWith(
                            color: colors.accent,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ).animate()
                .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, delay: 120.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}
