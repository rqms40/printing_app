import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/age_range_selector.dart';
import 'package:printing_app/features/auth/widgets/gender_identity_selector.dart';
import 'package:printing_app/features/auth/widgets/profiling_form_section.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

class AccountDetailsScreen extends ConsumerStatefulWidget {
  const AccountDetailsScreen({super.key});

  @override
  ConsumerState<AccountDetailsScreen> createState() =>
      _AccountDetailsScreenState();
}

class _AccountDetailsScreenState extends ConsumerState<AccountDetailsScreen> {
  late final TextEditingController _nicknameController;
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late final TextEditingController _courseController;
  late final TextEditingController _organizationController;

  String? _selectedGender;
  String? _selectedAgeRange;
  ProfilingFormValue _profiling = const ProfilingFormValue();

  @override
  void initState() {
    super.initState();
    final user = ref.read(profileProvider);
    _nicknameController = TextEditingController(text: user?.nickname ?? '');
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _courseController = TextEditingController(text: user?.course ?? '');
    _organizationController = TextEditingController(
      text: user?.organization ?? '',
    );
    _selectedGender = user?.gender;
    _selectedAgeRange = user?.ageRange;
    _profiling = seededProfilingValue(
      profileCategory: user?.profileCategory,
      profileField: user?.profileField,
      printingPreferences: user?.printingPreferences,
      matchingPreference: user?.matchingPreference,
    );
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _courseController.dispose();
    _organizationController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    final success = await ref
        .read(authProvider.notifier)
        .completeProfile(
          fullName: _nameController.text.trim(),
          nickname: _nicknameController.text.trim(),
          phone: _phoneController.text.trim(),
          gender: _selectedGender ?? '',
          ageRange: _selectedAgeRange,
          profileCategory: _profiling.profileCategory,
          profileField: _profiling.profileField,
          course: _courseController.text.trim(),
          organization: _organizationController.text.trim(),
          printingPreferences: _profiling.printingPreferences,
          matchingPreference: _profiling.matchingPreference,
        );

    if (!mounted) return;
    if (!success) {
      final message =
          ref.read(authProvider).errorMessage ?? 'Failed to update profile';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
      return;
    }

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profile updated successfully')),
    );
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Account Details',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  AppTextField(
                        controller: _nicknameController,
                        label: 'Nickname',
                        hintText: 'Kai',
                      )
                      .animate()
                      .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                      .slideY(
                        begin: 0.03,
                        duration: 400.ms,
                        curve: Curves.easeOut,
                      ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    controller: _nameController,
                    label: 'Full Name',
                    hintText: 'Enter your full name',
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    controller: _emailController,
                    label: 'Email',
                    hintText: 'Email address',
                    enabled: false,
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  AppTextField(
                    controller: _phoneController,
                    label: 'Phone',
                    hintText: '+63 917 123 4567',
                    keyboardType: TextInputType.phone,
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
                      setState(() => _selectedGender = value);
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Age Range',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  AgeRangeSelector(
                    value: _selectedAgeRange,
                    onChanged: (value) {
                      setState(() => _selectedAgeRange = value);
                    },
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  ProfilingFormSection(
                    value: _profiling,
                    onChanged: (next) {
                      setState(() => _profiling = next);
                    },
                    courseController: _courseController,
                    organizationController: _organizationController,
                  ),
                ],
              ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: AppButton(
                label: 'Save Changes',
                onTap: _save,
                isFullWidth: true,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
