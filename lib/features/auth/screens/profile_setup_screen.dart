import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
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

  DateTime? _dateOfBirth;
  String _selectedGender = '';

  String? _nameError;

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
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
    setState(() => _nameError = nameErr);
    return nameErr == null;
  }

  void _submit() {
    if (!_validate()) return;
    ref.read(authProvider.notifier).completeProfile(
          _nameController.text.trim(),
          _phoneController.text.trim(),
          _selectedGender,
          _dateOfBirth,
        );
  }

  void _skip() {
    ref.read(authProvider.notifier).completeProfile(
          ref.read(authProvider).user?.email ?? 'User',
          '',
          '',
          null,
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
                    onTap: _submit,
                    variant: AppButtonVariant.primary,
                    isFullWidth: true,
                  ),

                  const SizedBox(height: AppSpacing.md),

                  // Skip button
                  AppButton(
                    label: 'Skip for now',
                    onTap: _skip,
                    variant: AppButtonVariant.ghost,
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
