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
import 'package:printing_app/features/auth/widgets/password_strength_meter.dart';
import 'package:printing_app/features/auth/widgets/password_visibility_toggle.dart';
import 'package:printing_app/features/auth/widgets/registration_step_header.dart';
import 'package:printing_app/features/customer/beta/providers/beta_status_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';

/// The redesigned 5-step registration flow. Account moves to position 2 so a
/// real account exists early (goal-gradient); category+field and gender+age
/// each collapse into one screen; gender/age are skippable.
enum _RegisterStep { welcome, account, nickname, craft, profile }

final _emailPattern = RegExp(r'^[\w.+-]+@[\w-]+\.[\w.-]+$');

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
  _RegisterStep _step = _RegisterStep.welcome;
  bool _consentChecked = false;
  String? _stepError;
  String? _fullNameError;
  String? _emailError;
  String? _phoneError;
  String? _passwordError;
  String? _confirmPasswordError;
  PasswordStrength _passwordStrength = PasswordStrength.empty;

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
      case _RegisterStep.welcome:
        if (!_consentChecked) {
          setState(() => _stepError = 'Please accept the terms to continue');
          return;
        }
        setState(() {
          _draft = _draft.copyWith(hasAcceptedPrivacy: true);
          _step = _RegisterStep.account;
        });
        return;
      case _RegisterStep.account:
        if (!_validateAccountStep()) return;
        setState(() {
          _draft = _draft.copyWith(
            fullName: _fullNameController.text.trim(),
            email: _emailController.text.trim(),
            phoneNumber: _phoneController.text.trim(),
            password: _passwordController.text,
            confirmPassword: _confirmPasswordController.text,
          );
          _step = _RegisterStep.nickname;
        });
        return;
      case _RegisterStep.nickname:
        final nickname = _nicknameController.text.trim();
        if (nickname.isEmpty) {
          setState(() => _stepError = 'Pick a nickname so we can greet you');
          return;
        }
        setState(() {
          _draft = _draft.copyWith(nickname: nickname);
          _step = _RegisterStep.craft;
        });
        return;
      case _RegisterStep.craft:
        if (!_draft.hasCategory) {
          setState(() => _stepError = 'Choose a category to continue');
          return;
        }
        if (!_draft.hasField) {
          setState(() => _stepError = 'Choose a field to continue');
          return;
        }
        setState(() => _step = _RegisterStep.profile);
        return;
      case _RegisterStep.profile:
        // Gender and age are optional — submit whatever is set.
        _submit();
        return;
    }
  }

  void _back(BuildContext context) {
    if (_step == _RegisterStep.welcome) {
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
    } else if (!_emailPattern.hasMatch(email)) {
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
    final draft = _draft;
    await ref
        .read(authProvider.notifier)
        .register(
          draft.email,
          draft.password,
          fullName: draft.fullName,
          nickname: draft.nickname,
          phone: draft.phoneNumber,
          gender: draft.gender,
          ageRange: draft.ageRange,
          profileCategory: draft.profileCategory!,
          profileField: draft.profileField!,
          printingPreferences: draft.printingPreferences,
        );

    if (!mounted) return;
    final auth = ref.read(authProvider);
    if (auth.status != AuthStatus.authenticated) return;

    // Peak-end: when this signup enrolled into an active beta, reveal the
    // founding number + credit grant before the normal onboarding. Invalidate
    // first so we read the authenticated /beta-mode/me (with the rank), not a
    // stale pre-login public status.
    ref.invalidate(betaStatusProvider);
    final beta = await ref.read(betaStatusProvider.future);
    if (!mounted) return;
    if (beta != null && beta.globallyEnabled && beta.rank != null) {
      context.go('/auth/beta-welcome');
    }
    // Otherwise the router redirect handles /onboarding as before.
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
                    Align(
                      alignment: Alignment.centerLeft,
                      child: IconButton(
                        onPressed: () => _back(context),
                        icon: Icon(
                          Icons.arrow_back_rounded,
                          color: colors.onBackground,
                        ),
                        tooltip: 'Back',
                        style: IconButton.styleFrom(
                          minimumSize: const Size(48, 48),
                          backgroundColor: colors.surface,
                        ),
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
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
                                  if (_step == _RegisterStep.profile &&
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
                    if (_step == _RegisterStep.profile) ...[
                      AppButton(
                        label: 'Create account',
                        onTap: _next,
                        isLoading: authState.isLoading,
                        variant: AppButtonVariant.brand,
                        isFullWidth: true,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Center(
                        child: TextButton(
                          key: const Key('register-skip-profile'),
                          onPressed: authState.isLoading
                              ? null
                              : () {
                                  setState(() {
                                    _draft = _draft.copyWith(
                                      gender: null,
                                      ageRange: null,
                                    );
                                  });
                                  _submit();
                                },
                          child: Text(
                            'Skip for now',
                            style: AppTypography.bodyBold.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                        ),
                      ),
                    ] else
                      AppButton(
                        label: 'Continue',
                        onTap: _next,
                        variant: AppButtonVariant.brand,
                        isFullWidth: true,
                      ),
                    const SizedBox(height: AppSpacing.md),
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
    const total = 5;
    switch (_step) {
      case _RegisterStep.welcome:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const RegistrationStepHeader(
              index: 0,
              total: total,
              plateLabel: 'WELCOME',
              title: 'Register your\nprint account.',
              subtitle:
                  'A quick 5-plate setup and your GRIDGO account is ready.',
            ),
            const SizedBox(height: AppSpacing.xl),
            // One checkbox semantics node for the whole row (label + toggle),
            // with the inner controls excluded so screen readers and axe see a
            // single labeled checkbox rather than nested interactive elements.
            Semantics(
              container: true,
              checked: _consentChecked,
              label: 'I agree to keep my data mine and accept the terms',
              child: ExcludeSemantics(
                child: InkWell(
                  key: const Key('consent-checkbox'),
                  onTap: () => setState(() {
                    _consentChecked = !_consentChecked;
                    _stepError = null;
                  }),
                  borderRadius: AppRadius.borderLg,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      vertical: AppSpacing.sm,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 24,
                          height: 24,
                          child: Checkbox(
                            value: _consentChecked,
                            onChanged: (v) => setState(() {
                              _consentChecked = v ?? false;
                              _stepError = null;
                            }),
                            activeColor: colors.brand,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Text.rich(
                            TextSpan(
                              text:
                                  'I agree to keep my data mine and accept the ',
                              style: AppTypography.body.copyWith(
                                color: colors.onSurface,
                                height: 1.4,
                              ),
                              children: [
                                TextSpan(
                                  text: 'Terms & Conditions',
                                  style: AppTypography.bodyBold.copyWith(
                                    color: colors.brand,
                                    decoration: TextDecoration.underline,
                                  ),
                                ),
                                const TextSpan(text: '.'),
                              ],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => context.push('/customer/profile/terms'),
                style: TextButton.styleFrom(
                  minimumSize: const Size(48, 44),
                  padding: EdgeInsets.zero,
                ),
                child: Text(
                  'Read the Terms & Conditions',
                  style: AppTypography.bodyBold.copyWith(color: colors.brand),
                ),
              ),
            ),
          ],
        );

      case _RegisterStep.account:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const RegistrationStepHeader(
              index: 1,
              total: total,
              plateLabel: 'ACCOUNT',
              title: 'Set up your\naccount.',
              subtitle: 'Your login and where deliveries reach you.',
            ),
            const SizedBox(height: AppSpacing.xl),
            _AccountField(
              controller: _fullNameController,
              label: 'Full name',
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
                  _emailPattern.hasMatch(v.trim()) ? null : 'Invalid email',
            ),
            const SizedBox(height: AppSpacing.md),
            _AccountField(
              controller: _phoneController,
              label: 'Phone number',
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
              onChanged: (v) => setState(
                () => _passwordStrength = scorePassword(v),
              ),
            ),
            if (_passwordStrength != PasswordStrength.empty) ...[
              const SizedBox(height: AppSpacing.sm),
              PasswordStrengthMeter(strength: _passwordStrength),
            ],
            const SizedBox(height: AppSpacing.md),
            _AccountField(
              controller: _confirmPasswordController,
              label: 'Confirm password',
              hintText: 'Re-enter your password',
              prefixIcon: Icons.lock_rounded,
              obscureText: true,
              textInputAction: TextInputAction.done,
              errorText: _confirmPasswordError,
            ),
          ],
        );

      case _RegisterStep.nickname:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            RegistrationStepHeader(
              index: 2,
              total: total,
              plateLabel: 'NICKNAME',
              title: 'What should\nwe call you?',
              subtitle: 'Hi ${_draft.fullName.split(' ').first}! '
                  'Pick the name you want to see around the app.',
            ),
            const SizedBox(height: AppSpacing.xl),
            _NicknameInputCard(
              controller: _nicknameController,
              colors: colors,
            ),
          ],
        );

      case _RegisterStep.craft:
        final fields = profileFieldsForCategory(_draft.profileCategory);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const RegistrationStepHeader(
              index: 3,
              total: total,
              plateLabel: 'CRAFT',
              title: 'What do you\nprint?',
              subtitle: 'We preset your print style from your answer.',
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'YOUR LANE',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            for (final category in profileCategories) ...[
              _FieldCard(
                key: ValueKey('register-category-${category.value}'),
                icon: category.icon,
                title: category.label,
                autoSelectsLabel: category.description,
                isSelected: _draft.profileCategory == category.value,
                colors: colors,
                onTap: () => setState(() {
                  _draft = _draft.copyWith(
                    profileCategory: category.value,
                    profileField: null,
                    printingPreferences: const [],
                  );
                  _stepError = null;
                }),
              ),
              if (category != profileCategories.last)
                const SizedBox(height: AppSpacing.sm),
            ],
            if (_draft.hasCategory) ...[
              const SizedBox(height: AppSpacing.lg),
              Text(
                'YOUR FIELD',
                style: AppTypography.overline.copyWith(
                  color: colors.onSurfaceDim,
                  fontSize: 11,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final field in fields) ...[
                _FieldCard(
                  icon: _fieldIcon(field.value),
                  title: field.label,
                  autoSelectsLabel: field.description,
                  isSelected: _draft.profileField == field.value,
                  colors: colors,
                  onTap: () => setState(() {
                    _draft = _draft.copyWith(
                      profileField: field.value,
                      printingPreferences:
                          defaultPrintingPreferencesForField(field.value),
                    );
                    _stepError = null;
                  }),
                ),
                if (field != fields.last)
                  const SizedBox(height: AppSpacing.sm),
              ],
            ],
          ],
        );

      case _RegisterStep.profile:
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const RegistrationStepHeader(
              index: 4,
              total: total,
              plateLabel: 'YOU',
              title: 'A little\nabout you.',
              subtitle: 'Optional — it tunes recommendations. Skip anytime.',
            ),
            const SizedBox(height: AppSpacing.xl),
            Text(
              'IDENTITY',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            GenderIdentitySelector(
              value: _draft.gender,
              onChanged: (value) => setState(() {
                _draft = _draft.copyWith(gender: value);
                _stepError = null;
              }),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'AGE RANGE',
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AgeRangeSelector(
              value: _draft.ageRange,
              onChanged: (value) => setState(() {
                _draft = _draft.copyWith(ageRange: value);
                _stepError = null;
              }),
            ),
          ],
        );
    }
  }
}

class _FieldCard extends StatelessWidget {
  const _FieldCard({
    super.key,
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
    this.onChanged,
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
  final ValueChanged<String>? onChanged;

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
    widget.onChanged?.call(value);
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
