import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';
import 'package:printing_app/features/auth/models/registration_draft.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/age_range_selector.dart';
import 'package:printing_app/features/auth/widgets/gender_identity_selector.dart';
import 'package:printing_app/features/auth/widgets/profiling_form_section.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

/// Legacy-safe profile setup screen for users whose profile is still incomplete.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key, this.draft});

  final RegistrationDraft? draft;

  @override
  ConsumerState<ProfileSetupScreen> createState() => _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _nicknameController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _courseController = TextEditingController();
  final _organizationController = TextEditingController();

  String? _selectedGender;
  String? _selectedAgeRange;
  ProfilingFormValue _profiling = const ProfilingFormValue();

  String? _nicknameError;
  String? _nameError;
  String? _categoryError;
  String? _fieldError;
  String? _genderError;
  String? _ageRangeError;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    _nicknameController.text = widget.draft?.nickname ?? user?.nickname ?? '';
    _nameController.text = widget.draft?.fullName ?? user?.fullName ?? '';
    _phoneController.text = widget.draft?.phoneNumber ?? user?.phone ?? '';
    _courseController.text = user?.course ?? '';
    _organizationController.text = user?.organization ?? '';
    _selectedGender = widget.draft?.gender ?? user?.gender;
    _selectedAgeRange = widget.draft?.ageRange ?? user?.ageRange;
    _profiling = seededProfilingValue(
      profileCategory: widget.draft?.profileCategory ?? user?.profileCategory,
      profileField: widget.draft?.profileField ?? user?.profileField,
      printingPreferences: widget.draft?.printingPreferences.isNotEmpty == true
          ? widget.draft?.printingPreferences
          : user?.printingPreferences,
      matchingPreference: user?.matchingPreference,
    );
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _courseController.dispose();
    _organizationController.dispose();
    super.dispose();
  }

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  bool _validate() {
    final nickname = _nicknameController.text.trim();
    final name = _nameController.text.trim();

    setState(() {
      _nicknameError = nickname.isEmpty ? 'Nickname is required' : null;
      _nameError = name.isEmpty ? 'Full name is required' : null;
      _categoryError = _profiling.profileCategory == null
          ? 'Choose a role first'
          : null;
      _fieldError = _profiling.profileField == null
          ? 'Select your field to finish setup'
          : null;
      _genderError = (_selectedGender == null || _selectedGender!.isEmpty)
          ? 'Choose a gender identity option'
          : null;
      _ageRangeError = (_selectedAgeRange == null || _selectedAgeRange!.isEmpty)
          ? 'Choose your age range'
          : null;
    });

    return _nicknameError == null &&
        _nameError == null &&
        _categoryError == null &&
        _fieldError == null &&
        _genderError == null &&
        _ageRangeError == null;
  }

  Future<void> _submit() async {
    if (!_validate()) return;

    if (widget.draft != null) {
      await ref
          .read(authProvider.notifier)
          .register(
            widget.draft!.email,
            widget.draft!.password,
            fullName: _nameController.text.trim(),
            nickname: _nicknameController.text.trim(),
            profileCategory: _profiling.profileCategory!,
            profileField: _profiling.profileField!,
            phone: _phoneController.text.trim(),
            gender: _selectedGender,
            ageRange: _selectedAgeRange,
            course: _courseController.text.trim(),
            organization: _organizationController.text.trim(),
            printingPreferences: _profiling.printingPreferences,
            matchingPreference: _profiling.matchingPreference,
          );
      return;
    }

    await ref
        .read(authProvider.notifier)
        .completeProfile(
          fullName: _nameController.text.trim(),
          nickname: _nicknameController.text.trim(),
          phone: _phoneController.text.trim(),
          gender: _selectedGender,
          ageRange: _selectedAgeRange,
          profileCategory: _profiling.profileCategory,
          profileField: _profiling.profileField,
          course: _courseController.text.trim(),
          organization: _organizationController.text.trim(),
          printingPreferences: _profiling.printingPreferences,
          matchingPreference: _profiling.matchingPreference,
        );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final authState = ref.watch(authProvider);

    if (widget.draft == null &&
        authState.status == AuthStatus.unauthenticated) {
      return Scaffold(
        backgroundColor: colors.background,
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Your signup session expired',
                    style: AppTypography.h2.copyWith(
                      color: colors.onBackground,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text(
                    'Please restart signup to continue.',
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  AppButton(
                    label: 'Restart signup',
                    onTap: () => context.go('/auth/register'),
                    isFullWidth: true,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: AppSpacing.xxl),
              Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Complete Your Profile',
                        style: AppTypography.h1.copyWith(
                          color: colors.onBackground,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        'Tell us about yourself',
                        style: AppTypography.bodyLarge.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                    ],
                  )
                  .animate()
                  .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                  .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
              const SizedBox(height: AppSpacing.xxl),
              Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppTextField(
                        controller: _nicknameController,
                        label: 'Nickname',
                        hintText: 'Kai',
                        textInputAction: TextInputAction.next,
                        errorText: _nicknameError,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppTextField(
                        controller: _nameController,
                        label: 'Full Name',
                        hintText: 'e.g. Maria Santos',
                        textInputAction: TextInputAction.next,
                        errorText: _nameError,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppTextField(
                        controller: _phoneController,
                        label: 'Phone Number',
                        hintText: '+63 9XX XXX XXXX',
                        keyboardType: TextInputType.phone,
                        textInputAction: TextInputAction.done,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      ProfilingFormSection(
                        value: _profiling,
                        onChanged: (next) {
                          setState(() {
                            _profiling = next;
                            _categoryError = null;
                            _fieldError = null;
                          });
                        },
                        courseController: _courseController,
                        organizationController: _organizationController,
                        categoryError: _categoryError,
                        fieldError: _fieldError,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Gender Identity',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      GenderIdentitySelector(
                        value: _selectedGender,
                        onChanged: (value) {
                          setState(() {
                            _selectedGender = value;
                            _genderError = null;
                          });
                        },
                      ),
                      if (_genderError != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          _genderError!,
                          style: AppTypography.caption.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        'Age Range',
                        style: AppTypography.caption.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Age is just a number, but it helps us tailor your experience!',
                        style: AppTypography.body.copyWith(
                          color: colors.onSurfaceDim,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      AgeRangeSelector(
                        value: _selectedAgeRange,
                        onChanged: (value) {
                          setState(() {
                            _selectedAgeRange = value;
                            _ageRangeError = null;
                          });
                        },
                      ),
                      if (_ageRangeError != null) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Text(
                          _ageRangeError!,
                          style: AppTypography.caption.copyWith(
                            color: colors.error,
                          ),
                        ),
                      ],
                    ],
                  )
                  .animate()
                  .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                  .slideY(
                    begin: 0.03,
                    duration: 400.ms,
                    delay: 60.ms,
                    curve: Curves.easeOut,
                  ),
              const SizedBox(height: AppSpacing.xl),
              if (authState.errorMessage != null) ...[
                Text(
                  authState.errorMessage!,
                  style: AppTypography.caption.copyWith(color: colors.error),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              AppButton(
                    label: 'Complete Profile',
                    onTap: _submit,
                    isLoading: authState.isLoading,
                    isFullWidth: true,
                  )
                  .animate()
                  .fadeIn(
                    duration: 400.ms,
                    delay: 120.ms,
                    curve: Curves.easeOut,
                  )
                  .slideY(
                    begin: 0.03,
                    duration: 400.ms,
                    delay: 120.ms,
                    curve: Curves.easeOut,
                  ),
              const SizedBox(height: AppSpacing.xl),
            ],
          ),
        ),
      ),
    );
  }
}
