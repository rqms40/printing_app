import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
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
import 'package:printing_app/features/auth/widgets/password_visibility_toggle.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/features/auth/widgets/onboarding_hero.dart';

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
          child: Stack(
            fit: StackFit.expand,
            children: [
              Positioned(
                top: MediaQuery.sizeOf(context).height * 0.08,
                left: -150,
                right: -150,
                child: IgnorePointer(
                  child:
                      Container(
                            height: 500,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  colors.brand.withValues(alpha: 0.50),
                                  colors.brand.withValues(alpha: 0.0),
                                ],
                              ),
                            ),
                          )
                          .animate(
                            onPlay: (controller) =>
                                controller.repeat(reverse: true),
                          )
                          .slideX(
                            begin: -0.15,
                            end: 0.15,
                            duration: 5000.ms,
                            curve: Curves.easeInOutSine,
                          )
                          .slideY(
                            begin: -0.05,
                            end: 0.05,
                            duration: 7000.ms,
                            curve: Curves.easeInOutSine,
                          ),
                ),
              ),
              Padding(
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
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          return SingleChildScrollView(
                            child: ConstrainedBox(
                              constraints: BoxConstraints.tightFor(
                                width: constraints.maxWidth,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  AnimatedSwitcher(
                                    duration: const Duration(milliseconds: 280),
                                    transitionBuilder: (child, animation) {
                                      return FadeTransition(
                                        opacity: animation,
                                        child: ScaleTransition(
                                          scale:
                                              Tween<double>(
                                                begin: 0.96,
                                                end: 1.0,
                                              ).animate(
                                                CurvedAnimation(
                                                  parent: animation,
                                                  curve: Curves.easeOutCubic,
                                                ),
                                              ),
                                          child: SlideTransition(
                                            position:
                                                Tween<Offset>(
                                                  begin: const Offset(0.04, 0),
                                                  end: Offset.zero,
                                                ).animate(
                                                  CurvedAnimation(
                                                    parent: animation,
                                                    curve: Curves.easeOutCubic,
                                                  ),
                                                ),
                                            child: child,
                                          ),
                                        ),
                                      );
                                    },
                                    child: KeyedSubtree(
                                      key: ValueKey(_step),
                                      child: SizedBox(
                                        width: double.infinity,
                                        child: _buildStep(
                                          context,
                                          colors,
                                          authState,
                                        ),
                                      ),
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
                          );
                        },
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
                              variant: AppButtonVariant.brand,
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
                        variant: AppButtonVariant.brand,
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
            ],
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
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 48),
            Center(
                  child: SvgPicture.asset(
                    'assets/animations/undraw_certificate.svg',
                    height: 240,
                  ),
                )
                .animate()
                .fadeIn(duration: 500.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  duration: 500.ms,
                  curve: Curves.easeOutCubic,
                ),
            const SizedBox(height: 64),
            Center(
                  child: Text(
                    'Your data, your rules.',
                    textAlign: TextAlign.center,
                    style: AppTypography.display.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                )
                .animate()
                .fadeIn(delay: 100.ms, duration: 500.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  delay: 100.ms,
                  duration: 500.ms,
                  curve: Curves.easeOutCubic,
                ),
            const SizedBox(height: AppSpacing.xl),
            Center(
                  child: GestureDetector(
                    onTap: () => context.push('/customer/profile/terms'),
                    child: Text(
                      'View Terms & Conditions',
                      style: AppTypography.body.copyWith(
                        color: colors.onSurfaceDim,
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ),
                )
                .animate()
                .fadeIn(delay: 200.ms, duration: 500.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  delay: 200.ms,
                  duration: 500.ms,
                  curve: Curves.easeOutCubic,
                ),
          ],
        );
      case _RegisterStep.nickname:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
                  child: SizedBox(
                    height: 300,
                    width: 300,
                    child: Stack(
                      children: [
                        SvgPicture.asset(
                          'assets/animations/undraw_friendly-guy-avatar_body.svg',
                        ),
                        SvgPicture.asset(
                              'assets/animations/undraw_friendly-guy-avatar_arm.svg',
                            )
                            .animate(
                              onPlay: (controller) =>
                                  controller.repeat(reverse: true),
                            )
                            .rotate(
                              begin: 0,
                              end: 0.05,
                              alignment: const Alignment(-0.35, 0.35),
                              duration: 1500.ms,
                              curve: Curves.easeInOut,
                            ),
                      ],
                    ),
                  ),
                )
                .animate()
                .fadeIn(duration: 500.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  duration: 500.ms,
                  curve: Curves.easeOutCubic,
                ),
            const SizedBox(height: 64),
            Center(
                  child: Text(
                    'What should we call you?',
                    textAlign: TextAlign.center,
                    style: AppTypography.display.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                )
                .animate()
                .fadeIn(delay: 100.ms, duration: 500.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  delay: 100.ms,
                  duration: 500.ms,
                  curve: Curves.easeOutCubic,
                ),
            const SizedBox(height: AppSpacing.sm),
            Center(
                  child: Text(
                    'This is how we\'ll greet you throughout the app.',
                    textAlign: TextAlign.center,
                    style: AppTypography.bodyLarge.copyWith(
                      color: colors.onSurfaceDim,
                      height: 1.5,
                    ),
                  ),
                )
                .animate()
                .fadeIn(delay: 200.ms, duration: 500.ms, curve: Curves.easeOut)
                .slideY(
                  begin: 0.05,
                  end: 0,
                  delay: 200.ms,
                  duration: 500.ms,
                  curve: Curves.easeOutCubic,
                ),
            const SizedBox(height: AppSpacing.xl),
            _NicknameInputCard(controller: _nicknameController, colors: colors),
          ],
        );
      case _RegisterStep.category:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hey ${_draft.nickname.isNotEmpty ? _draft.nickname : 'there'},\ntell us about yourself.',
              style: AppTypography.display.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Pick the lane that fits.',
              style: AppTypography.bodyLarge.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            for (final category in profileCategories) ...[
              KeyedSubtree(
                key: ValueKey('register-category-${category.value}'),
                child: _FieldCard(
                  icon: category.icon,
                  title: category.label,
                  autoSelectsLabel: category.description,
                  isSelected: _draft.profileCategory == category.value,
                  colors: colors,
                  onTap: () {
                    setState(() {
                      _draft = _draft.copyWith(
                        profileCategory: category.value,
                        profileField: null,
                        printingPreferences: const [],
                      );
                      _stepError = null;
                    });
                  },
                ),
              ),
              if (category != profileCategories.last)
                const SizedBox(height: AppSpacing.md),
            ],
          ],
        );
      case _RegisterStep.field:
        final fields = profileFieldsForCategory(_draft.profileCategory);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            OnboardingHero(
              icon: _draft.profileCategory == 'professional'
                  ? Icons.work_rounded
                  : Icons.school_rounded,
              headline: profilingPrompt(_draft.profileCategory),
              subtitle: 'We\'ll preselect your print style automatically.',
            ),
            const SizedBox(height: AppSpacing.xl),
            for (final field in fields) ...[
              _FieldCard(
                icon: _fieldIcon(field.value),
                title: field.label,
                autoSelectsLabel: field.description,
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
        );
      case _RegisterStep.gender:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const OnboardingHero(
              headline: 'How do you identify?',
              subtitle: 'Choose what feels right for you.',
            ),
            const SizedBox(height: AppSpacing.xl),
            GenderIdentitySelector(
              value: _draft.gender,
              onChanged: (value) {
                setState(() {
                  _draft = _draft.copyWith(gender: value);
                  _stepError = null;
                });
              },
            ),
          ],
        );
      case _RegisterStep.ageRange:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Age is just a number —\nbut it shapes\nyour experience.',
              style: AppTypography.display.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Swipe to find your range.',
              style: AppTypography.bodyLarge.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            AgeRangeSelector(
              value: _draft.ageRange,
              onChanged: (value) {
                setState(() {
                  _draft = _draft.copyWith(ageRange: value);
                  _stepError = null;
                });
              },
            ),
          ],
        );
      case _RegisterStep.account:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (_draft.printingPreferences.isNotEmpty)
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: _draft.printingPreferences
                    .map(
                      (p) => _SummaryChip(
                        label: printingPreferenceLabel(p),
                        colors: colors,
                      ),
                    )
                    .toList(),
              ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Hi, ${_draft.nickname} 👋',
              style: AppTypography.display.copyWith(color: colors.onBackground),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Let\'s create your account.',
              style: AppTypography.bodyLarge.copyWith(
                color: colors.onSurfaceDim,
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            _AccountField(
              controller: _fullNameController,
              label: 'Full Name',
              hintText: 'Kai Reyes',
              prefixIcon: Icons.person_rounded,
              textInputAction: TextInputAction.next,
              errorText: _fullNameError,
              validator: (v) => v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: AppSpacing.md),
            _AccountField(
              controller: _emailController,
              label: 'Email',
              hintText: 'kai@example.com',
              prefixIcon: Icons.mail_rounded,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              errorText: _emailError,
              validator: (v) =>
                  v.trim().isEmpty || !v.contains('@') ? 'Invalid email' : null,
            ),
            const SizedBox(height: AppSpacing.md),
            _AccountField(
              controller: _phoneController,
              label: 'Phone Number',
              hintText: '+63 917 123 4567',
              prefixIcon: Icons.phone_rounded,
              keyboardType: TextInputType.phone,
              textInputAction: TextInputAction.next,
              errorText: _phoneError,
              validator: (v) => v.trim().isEmpty ? 'Required' : null,
            ),
            const SizedBox(height: AppSpacing.md),
            _AccountField(
              controller: _passwordController,
              label: 'Password',
              hintText: 'Min. 8 characters',
              prefixIcon: Icons.lock_rounded,
              obscureText: true,
              textInputAction: TextInputAction.next,
              errorText: _passwordError,
            ),
            const SizedBox(height: AppSpacing.md),
            _AccountField(
              controller: _confirmPasswordController,
              label: 'Confirm Password',
              hintText: 'Re-enter your password',
              prefixIcon: Icons.lock_rounded,
              obscureText: true,
              textInputAction: TextInputAction.done,
              errorText: _confirmPasswordError,
            ),
          ],
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
      crossAxisAlignment: CrossAxisAlignment.stretch,
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
                alignment: Alignment.center,
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

class _FieldCard extends StatelessWidget {
  const _FieldCard({
    required this.icon,
    required this.title,
    required this.autoSelectsLabel,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String autoSelectsLabel;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: isSelected
              ? colors.brand.withValues(alpha: 0.08)
              : colors.surfaceVariant,
          borderRadius: AppRadius.borderXl,
          border: Border.all(
            color: isSelected ? colors.brand : colors.outline,
            width: isSelected ? 2 : 1,
          ),
          boxShadow: [
            BoxShadow(
              color: isSelected
                  ? colors.brand.withValues(alpha: 0.25)
                  : Colors.black.withValues(alpha: 0.04),
              blurRadius: isSelected ? 20 : 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                color: isSelected
                    ? colors.brand.withValues(alpha: 0.15)
                    : colors.surface,
                borderRadius: AppRadius.borderLg,
              ),
              alignment: Alignment.center,
              child: Icon(
                icon,
                size: 28,
                color: isSelected ? colors.brand : colors.onSurfaceDim,
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.sm,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: colors.brand.withValues(alpha: 0.20),
                      borderRadius: AppRadius.borderFull,
                    ),
                    child: Text(
                      autoSelectsLabel,
                      style: AppTypography.caption.copyWith(
                        color: colors.brand,
                      ),
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
        color: colors.brand.withValues(alpha: 0.15),
        borderRadius: AppRadius.borderFull,
        border: Border.all(color: colors.brand.withValues(alpha: 0.40)),
      ),
      child: Text(
        label,
        style: AppTypography.caption.copyWith(color: colors.brand),
      ),
    );
  }
}

IconData _fieldIcon(String fieldValue) {
  switch (fieldValue) {
    case 'architecture':
      return Icons.architecture;
    case 'engineering':
      return Icons.precision_manufacturing_rounded;
    case 'medical_nursing':
      return Icons.medical_services_rounded;
    case 'law_arts_others':
      return Icons.gavel_rounded;
    case 'architect_designer':
      return Icons.design_services_rounded;
    case 'engineer_contractor':
      return Icons.construction_rounded;
    case 'medical_professional':
      return Icons.local_hospital_rounded;
    case 'business_corporate':
      return Icons.business_center_rounded;
    default:
      return Icons.auto_awesome_rounded;
  }
}

class _AccountField extends StatefulWidget {
  const _AccountField({
    required this.controller,
    required this.label,
    required this.hintText,
    required this.prefixIcon,
    this.keyboardType,
    this.obscureText = false,
    this.errorText,
    this.validator,
    this.textInputAction,
  });

  final TextEditingController controller;
  final String label;
  final String hintText;
  final IconData prefixIcon;
  final TextInputType? keyboardType;
  final bool obscureText;
  final String? errorText;
  final String? Function(String)? validator;
  final TextInputAction? textInputAction;

  @override
  State<_AccountField> createState() => _AccountFieldState();
}

class _AccountFieldState extends State<_AccountField> {
  late final FocusNode _focusNode;
  late final VoidCallback _focusListener;
  bool _isFocused = false;
  bool _isValid = false;
  bool _obscured = true;

  @override
  void initState() {
    super.initState();
    _obscured = widget.obscureText;
    _focusListener = () => setState(() => _isFocused = _focusNode.hasFocus);
    _focusNode = FocusNode()..addListener(_focusListener);
  }

  void _handleChange(String value) {
    final valid = widget.validator != null
        ? widget.validator!(value) == null
        : value.trim().isNotEmpty;
    setState(() => _isValid = valid);
  }

  @override
  void dispose() {
    _focusNode.removeListener(_focusListener);
    _focusNode.dispose();
    super.dispose();
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          width: double.infinity,
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.borderLg,
            border: Border.all(
              color: hasError
                  ? colors.error
                  : _isFocused
                  ? colors.brand
                  : colors.outline,
              width: _isFocused || hasError ? 2 : 1,
            ),
          ),
          child: Row(
            children: [
              Icon(
                widget.prefixIcon,
                size: 20,
                color: _isFocused ? colors.brand : colors.onSurfaceDim,
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      widget.label,
                      style: AppTypography.caption.copyWith(
                        color: _isFocused ? colors.brand : colors.onSurfaceDim,
                      ),
                    ),
                    TextField(
                      controller: widget.controller,
                      focusNode: _focusNode,
                      obscureText: widget.obscureText ? _obscured : false,
                      onChanged: _handleChange,
                      keyboardType: widget.keyboardType,
                      textInputAction: widget.textInputAction,
                      style: AppTypography.body.copyWith(
                        color: colors.onBackground,
                      ),
                      cursorColor: colors.brand,
                      decoration: InputDecoration(
                        hintText: widget.hintText,
                        hintStyle: AppTypography.body.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                        suffixIcon: widget.obscureText
                            ? PasswordVisibilityToggle(
                                isObscured: _obscured,
                                onPressed: () =>
                                    setState(() => _obscured = !_obscured),
                              )
                            : null,
                        suffixIconConstraints: const BoxConstraints(
                          minWidth: 44,
                          minHeight: 40,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          vertical: AppSpacing.xs,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              if (!widget.obscureText && _isValid && !hasError)
                Icon(
                      Icons.check_circle_rounded,
                      key: const ValueKey('valid'),
                      size: 20,
                      color: colors.success,
                    )
                    .animate()
                    .fadeIn(duration: 80.ms)
                    .scale(
                      begin: const Offset(0.6, 0.6),
                      duration: 200.ms,
                      curve: Curves.elasticOut,
                    ),
            ],
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: AppSpacing.xs),
          Padding(
            padding: const EdgeInsets.only(left: AppSpacing.sm),
            child: Text(
              widget.errorText!,
              style: AppTypography.caption.copyWith(color: colors.error),
            ),
          ),
        ],
      ],
    );
  }
}

class _NicknameInputCard extends StatefulWidget {
  const _NicknameInputCard({required this.controller, required this.colors});

  final TextEditingController controller;
  final AppColorSet colors;

  @override
  State<_NicknameInputCard> createState() => _NicknameInputCardState();
}

class _NicknameInputCardState extends State<_NicknameInputCard> {
  final _focusNode = FocusNode();
  bool _isFocused = false;
  late final VoidCallback _focusListener;

  @override
  void initState() {
    super.initState();
    _focusListener = () => setState(() => _isFocused = _focusNode.hasFocus);
    _focusNode.addListener(_focusListener);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _focusNode.removeListener(_focusListener);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = widget.colors;
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderLg,
        border: Border.all(
          color: _isFocused ? colors.brand : colors.outline,
          width: _isFocused ? 2 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.edit_rounded,
            size: 20,
            color: _isFocused ? colors.brand : colors.onSurfaceDim,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              style: AppTypography.bodyLarge.copyWith(
                color: colors.onBackground,
              ),
              cursorColor: colors.brand,
              decoration: InputDecoration(
                hintText: 'e.g. Kai',
                hintStyle: AppTypography.bodyLarge.copyWith(
                  color: colors.onSurfaceDim,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.sm,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
