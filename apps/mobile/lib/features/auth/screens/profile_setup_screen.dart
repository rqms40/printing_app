import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/profiling_form_section.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

/// Profile setup screen shown after registration.
class ProfileSetupScreen extends ConsumerStatefulWidget {
  const ProfileSetupScreen({super.key});

  @override
  ConsumerState<ProfileSetupScreen> createState() =>
      _ProfileSetupScreenState();
}

class _ProfileSetupScreenState extends ConsumerState<ProfileSetupScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _courseController = TextEditingController();
  final _organizationController = TextEditingController();

  DateTime? _dateOfBirth;
  String _selectedGender = '';
  ProfilingFormValue _profiling = const ProfilingFormValue();

  String? _nameError;
  String? _categoryError;
  String? _fieldError;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authProvider).user;
    _nameController.text = user?.fullName ?? '';
    _phoneController.text = user?.phone ?? '';
    _courseController.text = user?.course ?? '';
    _organizationController.text = user?.organization ?? '';
    _dateOfBirth = user?.dateOfBirth;
    _selectedGender = user?.gender ?? '';
    _profiling = seededProfilingValue(
      profileCategory: user?.profileCategory,
      profileField: user?.profileField,
      printingPreferences: user?.printingPreferences,
    );
  }

  @override
  void dispose() {
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
    final name = _nameController.text.trim();
    String? nameErr;
    if (name.isEmpty) {
      nameErr = 'Full name is required';
    }
    setState(() {
      _nameError = nameErr;
      _categoryError =
          _profiling.profileCategory == null ? 'Choose a role first' : null;
      _fieldError = _profiling.profileField == null
          ? 'Select your field to finish setup'
          : null;
    });
    return nameErr == null && _categoryError == null && _fieldError == null;
  }

  Future<void> _submit() async {
    if (!_validate()) return;
    await ref.read(authProvider.notifier).completeProfile(
          fullName: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          gender: _selectedGender,
          dob: _dateOfBirth,
          profileCategory: _profiling.profileCategory,
          profileField: _profiling.profileField,
          course: _courseController.text.trim(),
          organization: _organizationController.text.trim(),
          printingPreferences: _profiling.printingPreferences,
        );
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: DateTime(now.year - 25),
      firstDate: DateTime(1920),
      lastDate: now,
    );
    if (picked != null) {
      setState(() => _dateOfBirth = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);

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
              ).animate()
                .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xxl),

              // Full name
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppTextField(
                    controller: _nameController,
                    label: 'Full Name',
                    hintText: 'e.g. Maria Santos',
                    textInputAction: TextInputAction.next,
                    errorText: _nameError,
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Phone number
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

                  // Date of birth
                  Text(
                    'Date of Birth',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  GestureDetector(
                    onTap: _pickDate,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.md,
                      ),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(color: colors.outline),
                        ),
                      ),
                      child: Text(
                        _dateOfBirth != null
                            ? '${_dateOfBirth!.month}/${_dateOfBirth!.day}/${_dateOfBirth!.year}'
                            : 'Select date',
                        style: AppTypography.body.copyWith(
                          color: _dateOfBirth != null
                              ? colors.onBackground
                              : colors.onSurfaceDim,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),

                  // Gender
                  Text(
                    'Gender',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Row(
                    children: [
                      for (final gender in ['Male', 'Female', 'Other']) ...[
                        if (gender != 'Male') const SizedBox(width: AppSpacing.sm),
                        _GenderChip(
                          label: gender,
                          isSelected: _selectedGender == gender,
                          colors: colors,
                          onTap: () =>
                              setState(() => _selectedGender = gender),
                        ),
                      ],
                    ],
                  ),
                ],
              ).animate()
                .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
                .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),

              const SizedBox(height: AppSpacing.xl),

              // Complete profile button
              Column(
                children: [
                  AppButton(
                    label: 'Complete Profile',
                    onTap: () => _submit(),
                    variant: AppButtonVariant.primary,
                    isFullWidth: true,
                  ),
                ],
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

// ---------------------------------------------------------------------------
// Gender selection chip
// ---------------------------------------------------------------------------
class _GenderChip extends StatelessWidget {
  const _GenderChip({
    required this.label,
    required this.isSelected,
    required this.colors,
    required this.onTap,
  });

  final String label;
  final bool isSelected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isSelected ? colors.accent : Colors.transparent,
          borderRadius: AppRadius.borderFull,
          border: Border.all(
            color: isSelected ? colors.accent : colors.outline,
          ),
        ),
        child: Text(
          label,
          style: AppTypography.caption.copyWith(
            color: isSelected ? colors.background : colors.onSurface,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.w400,
          ),
        ),
      ),
    );
  }
}
