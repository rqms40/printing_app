import 'package:flutter/material.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

class AuthFormSubmission {
  const AuthFormSubmission({
    required this.email,
    required this.password,
  });

  final String email;
  final String password;
}

/// Reusable authentication form used by both [LoginScreen] and
/// [RegisterScreen].
///
/// When [isRegister] is true the form shows a "Confirm Password" field.
class AuthForm extends StatefulWidget {
  const AuthForm({
    super.key,
    required this.onSubmit,
    this.isRegister = false,
    this.isLoading = false,
  });

  /// Called with the validated auth form payload.
  final void Function(AuthFormSubmission submission) onSubmit;

  /// Whether to show the confirm-password field.
  final bool isRegister;

  /// Shows a loading indicator on the submit button.
  final bool isLoading;

  @override
  State<AuthForm> createState() => _AuthFormState();
}

class _AuthFormState extends State<AuthForm> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String? _emailError;
  String? _passwordError;
  String? _confirmPasswordError;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  bool _validate() {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    String? emailErr;
    String? passwordErr;
    String? confirmErr;

    if (email.isEmpty) {
      emailErr = 'Email is required';
    } else if (!email.contains('@')) {
      emailErr = 'Enter a valid email';
    }

    if (password.isEmpty) {
      passwordErr = 'Password is required';
    } else if (password.length < 6) {
      passwordErr = 'Password must be at least 6 characters';
    }

    if (widget.isRegister) {
      final confirm = _confirmPasswordController.text;
      if (confirm.isEmpty) {
        confirmErr = 'Please confirm your password';
      } else if (confirm != password) {
        confirmErr = 'Passwords do not match';
      }
    }

    setState(() {
      _emailError = emailErr;
      _passwordError = passwordErr;
      _confirmPasswordError = confirmErr;
    });

    return emailErr == null && passwordErr == null && confirmErr == null;
  }

  void _handleSubmit() {
    if (_validate()) {
      widget.onSubmit(
        AuthFormSubmission(
          email: _emailController.text.trim(),
          password: _passwordController.text,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Email
        AppTextField(
          controller: _emailController,
          label: 'Email',
          hintText: 'you@example.com',
          keyboardType: TextInputType.emailAddress,
          textInputAction: TextInputAction.next,
          errorText: _emailError,
        ),
        const SizedBox(height: AppSpacing.lg),

        // Password
        AppTextField(
          controller: _passwordController,
          label: 'Password',
          hintText: 'Enter your password',
          obscureText: true,
          textInputAction:
              widget.isRegister ? TextInputAction.next : TextInputAction.done,
          errorText: _passwordError,
          onSubmitted: widget.isRegister ? null : (_) => _handleSubmit(),
        ),

        if (!widget.isRegister) ...[
          const SizedBox(height: AppSpacing.sm),
          Align(
            alignment: Alignment.centerRight,
            child: GestureDetector(
              onTap: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Coming soon')),
                );
              },
              child: Text(
                'Forgot password?',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ),
          ),
        ],

        // Confirm password (register only)
        if (widget.isRegister) ...[
          const SizedBox(height: AppSpacing.lg),
          AppTextField(
            controller: _confirmPasswordController,
            label: 'Confirm Password',
            hintText: 'Re-enter your password',
            obscureText: true,
            textInputAction: TextInputAction.done,
            errorText: _confirmPasswordError,
            onSubmitted: (_) => _handleSubmit(),
          ),
        ],

        const SizedBox(height: AppSpacing.xl),

        // Submit button
        AppButton(
          label: widget.isRegister ? 'Continue' : 'Sign In',
          onTap: _handleSubmit,
          variant: AppButtonVariant.primary,
          isLoading: widget.isLoading,
          isFullWidth: true,
        ),
      ],
    );
  }
}
