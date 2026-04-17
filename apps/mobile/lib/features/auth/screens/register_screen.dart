import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/auth/widgets/auth_form.dart';

/// Registration screen for new users.
class RegisterScreen extends StatelessWidget {
  const RegisterScreen({super.key});

  @override
  Widget build(BuildContext context) {
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
                onSubmit: (submission) {
                  context.pushReplacement(
                    '/auth/profile-setup',
                    extra: RegistrationDraft(
                      email: submission.email,
                      password: submission.password,
                    ),
                  );
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
