import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/age_range_selector.dart';
import 'package:printing_app/features/auth/widgets/gender_identity_selector.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

enum _RegisterStep {
  privacy,
  nickname,
  category,
  field,
  gender,
  ageRange,
  account,
}

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen> {
  final _nicknameController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  RegistrationDraft _draft = const RegistrationDraft();
  _RegisterStep _step = _RegisterStep.privacy;
  String? _stepError;
  String? _fullNameError;
  String? _emailError;
  String? _phoneError;
  String? _passwordError;
  String? _confirmPasswordError;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  int get _stepIndex => _RegisterStep.values.indexOf(_step);

  @override
  void dispose() {
    _nicknameController.dispose();
    _fullNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  void _next() {
    setState(() {
      _stepError = null;
    });

    switch (_step) {
      case _RegisterStep.privacy:
        setState(() {
          _draft = _draft.copyWith(hasAcceptedPrivacy: true);
          _step = _RegisterStep.nickname;
        });
        return;
      case _RegisterStep.nickname:
        final nickname = _nicknameController.text.trim();
        if (nickname.isEmpty) {
          setState(() => _stepError = 'Nickname is required');
          return;
        }
        setState(() {
          _draft = _draft.copyWith(nickname: nickname);
          _step = _RegisterStep.category;
        });
        return;
      case _RegisterStep.category:
        if (!_draft.hasCategory) {
          setState(() => _stepError = 'Choose a category to continue');
          return;
        }
        setState(() => _step = _RegisterStep.field);
        return;
      case _RegisterStep.field:
        if (!_draft.hasField) {
          setState(() => _stepError = 'Choose a field to continue');
          return;
        }
        setState(() => _step = _RegisterStep.gender);
        return;
      case _RegisterStep.gender:
        if (!_draft.hasGender) {
          setState(() => _stepError = 'Choose one to continue');
          return;
        }
        setState(() => _step = _RegisterStep.ageRange);
        return;
      case _RegisterStep.ageRange:
        if (!_draft.hasAgeRange) {
          setState(() => _stepError = 'Choose your age range to continue');
          return;
        }
        setState(() => _step = _RegisterStep.account);
        return;
      case _RegisterStep.account:
        _submit();
        return;
    }
  }

  void _back(BuildContext context) {
    if (_step == _RegisterStep.privacy) {
      context.pop();
      return;
    }

    setState(() {
      _stepError = null;
      _step = _RegisterStep.values[_stepIndex - 1];
    });
  }

  bool _validateAccountStep() {
    final fullName = _fullNameController.text.trim();
    final email = _emailController.text.trim();
    final phone = _phoneController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;

    String? fullNameError;
    String? emailError;
    String? phoneError;
    String? passwordError;
    String? confirmPasswordError;

    if (fullName.isEmpty) {
      fullNameError = 'Full name is required';
    }
    if (email.isEmpty) {
      emailError = 'Email is required';
    } else if (!email.contains('@')) {
      emailError = 'Enter a valid email';
    }
    if (phone.isEmpty) {
      phoneError = 'Number is required';
    }
    if (password.isEmpty) {
      passwordError = 'Password is required';
    } else if (password.length < 8) {
      passwordError = 'Password must be at least 8 characters';
    }
    if (confirmPassword.isEmpty) {
      confirmPasswordError = 'Confirm your password';
    } else if (confirmPassword != password) {
      confirmPasswordError = 'Passwords do not match';
    }

    setState(() {
      _fullNameError = fullNameError;
      _emailError = emailError;
      _phoneError = phoneError;
      _passwordError = passwordError;
      _confirmPasswordError = confirmPasswordError;
    });

    return fullNameError == null &&
        emailError == null &&
        phoneError == null &&
        passwordError == null &&
        confirmPasswordError == null;
  }

  Future<void> _submit() async {
    if (!_validateAccountStep()) return;

    final nextDraft = _draft.copyWith(
      fullName: _fullNameController.text.trim(),
      email: _emailController.text.trim(),
      phoneNumber: _phoneController.text.trim(),
      password: _passwordController.text,
      confirmPassword: _confirmPasswordController.text,
    );

    setState(() => _draft = nextDraft);

    await ref
        .read(authProvider.notifier)
        .register(
          nextDraft.email,
          nextDraft.password,
          fullName: nextDraft.fullName,
          nickname: nextDraft.nickname,
          phone: nextDraft.phoneNumber,
          gender: nextDraft.gender,
          ageRange: nextDraft.ageRange,
          profileCategory: nextDraft.profileCategory!,
          profileField: nextDraft.profileField!,
          printingPreferences: nextDraft.printingPreferences,
        );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [colors.background, colors.surfaceDim],
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.xl,
              AppSpacing.xl,
              AppSpacing.xl,
              AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _WizardHeader(
                      stepIndex: _stepIndex,
                      stepCount: _RegisterStep.values.length,
                      onBack: () => _back(context),
                      canGoBack: true,
                      colors: colors,
                    )
                    .animate()
                    .fadeIn(duration: 320.ms, curve: Curves.easeOut)
                    .slideY(
                      begin: 0.02,
                      duration: 320.ms,
                      curve: Curves.easeOut,
                    ),
                const SizedBox(height: AppSpacing.xl),
                Expanded(
                  child: SingleChildScrollView(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AnimatedSwitcher(
                          duration: const Duration(milliseconds: 260),
                          transitionBuilder: (child, animation) {
                            return FadeTransition(
                              opacity: animation,
                              child: SlideTransition(
                                position: Tween<Offset>(
                                  begin: const Offset(0.04, 0),
                                  end: Offset.zero,
                                ).animate(animation),
                                child: child,
                              ),
                            );
                          },
                          child: KeyedSubtree(
                            key: ValueKey(_step),
                            child: _buildStep(context, colors, authState),
                          ),
                        ),
                        if (_stepError != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            _stepError!,
                            style: AppTypography.caption.copyWith(
                              color: colors.error,
                            ),
                          ),
                        ],
                        if (_step == _RegisterStep.account &&
                            authState.errorMessage != null) ...[
                          const SizedBox(height: AppSpacing.md),
                          Text(
                            authState.errorMessage!,
                            style: AppTypography.caption.copyWith(
                              color: colors.error,
                            ),
                          ),
                        ],
                        const SizedBox(height: AppSpacing.lg),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (_step != _RegisterStep.account)
                  Row(
                    children: [
                      Expanded(
                        child: AppButton(
                          label: 'Back',
                          onTap: () => _back(context),
                          variant: AppButtonVariant.secondary,
                          isFullWidth: true,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: AppButton(
                          label: _step == _RegisterStep.privacy
                              ? 'Agree & Continue'
                              : 'Continue',
                          onTap: _next,
                          isFullWidth: true,
                        ),
                      ),
                    ],
                  )
                else
                  AppButton(
                    label: 'Create Account',
                    onTap: _submit,
                    isLoading: authState.isLoading,
                    isFullWidth: true,
                  ),
                const SizedBox(height: AppSpacing.lg),
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
                              color: colors.brand,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStep(
    BuildContext context,
    AppColorSet colors,
    AuthState authState,
  ) {
    switch (_step) {
      case _RegisterStep.privacy:
        return _StepScaffold(
          eyebrow: 'Step 1',
          title: 'Before we begin',
          subtitle:
              'We collect your nickname, profile, gender, age range, and contact info to tailor your experience.',
          child: _PrivacyCard(
            colors: colors,
            onViewTerms: () => context.push('/customer/profile/terms'),
          ),
        );
      case _RegisterStep.nickname:
        return _StepScaffold(
          eyebrow: 'Step 2',
          title: 'What should we call you?',
          subtitle: '',
          child: AppTextField(
            controller: _nicknameController,
            label: 'Nickname',
            hintText: 'Kai',
            autofocus: true,
          ),
        );
      case _RegisterStep.category:
        return _StepScaffold(
          eyebrow: 'Step 3',
          title: 'Tell us a bit about yourself',
          subtitle: 'Pick the lane that feels closest to your work right now.',
          child: Column(
            children: [
              _ChoiceCard(
                title: 'Student',
                subtitle: 'school / uni',
                description:
                    'Designed for reports, plates, thesis work, and deadline mode.',
                icon: Icons.school_rounded,
                isSelected: _draft.profileCategory == 'student',
                colors: colors,
                onTap: () {
                  setState(() {
                    _draft = _draft.copyWith(
                      profileCategory: 'student',
                      profileField: null,
                      printingPreferences: const [],
                    );
                    _stepError = null;
                  });
                },
              ),
              const SizedBox(height: AppSpacing.md),
              _ChoiceCard(
                title: 'Professional',
                subtitle: 'work / client',
                description:
                    'Built for production specs, client decks, site docs, and polished output.',
                icon: Icons.work_outline_rounded,
                isSelected: _draft.profileCategory == 'professional',
                colors: colors,
                onTap: () {
                  setState(() {
                    _draft = _draft.copyWith(
                      profileCategory: 'professional',
                      profileField: null,
                      printingPreferences: const [],
                    );
                    _stepError = null;
                  });
                },
              ),
            ],
          ),
        );
      case _RegisterStep.field:
        final fields = profileFieldsForCategory(_draft.profileCategory);
        return _StepScaffold(
          eyebrow: 'Step 4',
          title: profilingPrompt(_draft.profileCategory),
          subtitle:
              'We will preselect the print style that best matches this field.',
          child: Column(
            children: [
              for (final field in fields) ...[
                _ChoiceCard(
                  title: field.label,
                  subtitle: field.description,
                  description:
                      'Auto-selects ${field.description.split('Pre-selects ').last}',
                  icon: Icons.auto_awesome_rounded,
                  isSelected: _draft.profileField == field.value,
                  colors: colors,
                  onTap: () {
                    setState(() {
                      _draft = _draft.copyWith(
                        profileField: field.value,
                        printingPreferences: defaultPrintingPreferencesForField(
                          field.value,
                        ),
                      );
                      _stepError = null;
                    });
                  },
                ),
                if (field != fields.last) const SizedBox(height: AppSpacing.md),
              ],
            ],
          ),
        );
      case _RegisterStep.gender:
        return _StepScaffold(
          eyebrow: 'Step 5',
          title: 'How do you identify?',
          subtitle: 'Choose what feels right for you.',
          child: GenderIdentitySelector(
            value: _draft.gender,
            onChanged: (value) {
              setState(() {
                _draft = _draft.copyWith(gender: value);
                _stepError = null;
              });
            },
          ),
        );
      case _RegisterStep.ageRange:
        return _StepScaffold(
          eyebrow: 'Step 6',
          title:
              'Age is just a number, but it helps us tailor your experience!',
          subtitle: '',
          child: AgeRangeSelector(
            value: _draft.ageRange,
            onChanged: (value) {
              setState(() {
                _draft = _draft.copyWith(ageRange: value);
                _stepError = null;
              });
            },
          ),
        );
      case _RegisterStep.account:
        return _StepScaffold(
          eyebrow: 'Step 7',
          title: 'Hi, ${_draft.nickname}',
          subtitle:
              '${profileCategoryLabel(_draft.profileCategory)} / ${profileFieldLabel(_draft.profileField)}',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: _draft.printingPreferences
                    .map(
                      (preference) => _SummaryChip(
                        label: printingPreferenceLabel(preference),
                        colors: colors,
                      ),
                    )
                    .toList(),
              ),
              const SizedBox(height: AppSpacing.xl),
              AppTextField(
                controller: _fullNameController,
                label: 'Full Name',
                hintText: 'Kai Reyes',
                errorText: _fullNameError,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _emailController,
                label: 'Email',
                hintText: 'kai@example.com',
                keyboardType: TextInputType.emailAddress,
                errorText: _emailError,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _phoneController,
                label: 'Number',
                hintText: '+63 917 123 4567',
                keyboardType: TextInputType.phone,
                errorText: _phoneError,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _passwordController,
                label: 'Password',
                hintText: 'Enter your password',
                obscureText: true,
                errorText: _passwordError,
              ),
              const SizedBox(height: AppSpacing.lg),
              AppTextField(
                controller: _confirmPasswordController,
                label: 'Confirm Password',
                hintText: 'Confirm your password',
                obscureText: true,
                errorText: _confirmPasswordError,
              ),
            ],
          ),
        );
    }
  }
}

class _WizardHeader extends StatelessWidget {
  const _WizardHeader({
    required this.stepIndex,
    required this.stepCount,
    required this.onBack,
    required this.canGoBack,
    required this.colors,
  });

  final int stepIndex;
  final int stepCount;
  final VoidCallback onBack;
  final bool canGoBack;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: canGoBack ? onBack : null,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: AppRadius.borderFull,
                  border: Border.all(color: colors.outline),
                ),
                child: Icon(
                  Icons.arrow_back_rounded,
                  color: colors.onBackground,
                ),
              ),
            ),
            const Spacer(),
            Text(
              '${stepIndex + 1}/$stepCount',
              style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.lg),
        ClipRRect(
          borderRadius: AppRadius.borderFull,
          child: LinearProgressIndicator(
            value: (stepIndex + 1) / stepCount,
            minHeight: 8,
            backgroundColor: colors.surfaceVariant,
            valueColor: AlwaysStoppedAnimation<Color>(colors.brand),
          ),
        ),
      ],
    );
  }
}

class _StepScaffold extends StatelessWidget {
  const _StepScaffold({
    required this.eyebrow,
    required this.title,
    required this.subtitle,
    required this.child,
  });

  final String eyebrow;
  final String title;
  final String subtitle;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(AppSpacing.xl),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            eyebrow,
            style: AppTypography.caption.copyWith(color: colors.brand),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            title,
            style: AppTypography.h2.copyWith(color: colors.onBackground),
          ),
          if (subtitle.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              subtitle,
              style: AppTypography.body.copyWith(
                color: colors.onSurfaceDim,
                height: 1.5,
              ),
            ),
          ],
          const SizedBox(height: AppSpacing.xl),
          child,
        ],
      ),
    );
  }
}

class _PrivacyCard extends StatelessWidget {
  const _PrivacyCard({required this.colors, required this.onViewTerms});

  final AppColorSet colors;
  final VoidCallback onViewTerms;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(AppSpacing.lg),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: AppRadius.borderLg,
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.brand.withValues(alpha: 0.16),
                  borderRadius: AppRadius.borderLg,
                ),
                child: Icon(Icons.verified_user_outlined, color: colors.brand),
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  'Only the essentials. We use this to personalize your experience and keep your account secure.',
                  style: AppTypography.body.copyWith(
                    color: colors.onSurface,
                    height: 1.5,
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        GestureDetector(
          onTap: onViewTerms,
          child: Text(
            'View Terms & Conditions',
            style: AppTypography.bodyBold.copyWith(color: colors.brand),
          ),
        ),
      ],
    );
  }
}

class _ChoiceCard extends StatelessWidget {
  const _ChoiceCard({
    required this.title,
    required this.subtitle,
    required this.description,
    required this.icon,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String description;
  final IconData icon;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: double.infinity,
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: isSelected
                ? [colors.accent, colors.accentSoft]
                : [colors.surface, colors.surfaceVariant],
          ),
          borderRadius: AppRadius.borderXl,
          border: Border.all(
            color: isSelected ? colors.accent : colors.outline,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: isSelected ? 0.10 : 0.04),
              blurRadius: 22,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: isSelected
                    ? colors.accentOnColor.withValues(alpha: 0.14)
                    : colors.brand.withValues(alpha: 0.12),
                borderRadius: AppRadius.borderLg,
              ),
              child: Icon(
                icon,
                color: isSelected ? colors.accentOnColor : colors.onBackground,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.h3.copyWith(
                      color: isSelected
                          ? colors.accentOnColor
                          : colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    subtitle,
                    style: AppTypography.bodyBold.copyWith(
                      color: isSelected
                          ? colors.accentOnColor
                          : colors.onSurface,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    description,
                    style: AppTypography.caption.copyWith(
                      color: isSelected
                          ? colors.accentOnColor
                          : colors.onSurfaceDim,
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SummaryChip extends StatelessWidget {
  const _SummaryChip({required this.label, required this.colors});

  final String label;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderFull,
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(color: colors.onSurface),
      ),
    );
  }
}
