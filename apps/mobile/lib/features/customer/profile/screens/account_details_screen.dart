import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/auth/models/profiling.dart';
import 'package:printing_app/features/auth/providers/auth_provider.dart';
import 'package:printing_app/features/auth/widgets/profiling_form_section.dart';
import 'package:printing_app/features/customer/profile/providers/profile_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:printing_app/utils/formatters.dart';

class AccountDetailsScreen extends ConsumerStatefulWidget {
  const AccountDetailsScreen({super.key});

  @override
  ConsumerState<AccountDetailsScreen> createState() =>
      _AccountDetailsScreenState();
}

class _AccountDetailsScreenState extends ConsumerState<AccountDetailsScreen> {
  late final TextEditingController _nameController;
  late final TextEditingController _emailController;
  late final TextEditingController _phoneController;
  late final TextEditingController _courseController;
  late final TextEditingController _organizationController;
  DateTime? _dateOfBirth;
  String? _selectedGender;
  ProfilingFormValue _profiling = const ProfilingFormValue();

  static const _genders = ['Male', 'Female', 'Other'];

  @override
  void initState() {
    super.initState();
    final user = ref.read(profileProvider);
    _nameController = TextEditingController(text: user?.fullName ?? '');
    _emailController = TextEditingController(text: user?.email ?? '');
    _phoneController = TextEditingController(text: user?.phone ?? '');
    _courseController = TextEditingController(text: user?.course ?? '');
    _organizationController =
        TextEditingController(text: user?.organization ?? '');
    _dateOfBirth = user?.dateOfBirth;
    _selectedGender = user?.gender;
    _profiling = seededProfilingValue(
      profileCategory: user?.profileCategory,
      profileField: user?.profileField,
      printingPreferences: user?.printingPreferences,
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _courseController.dispose();
    _organizationController.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final picked = await showDatePicker(
      context: context,
      initialDate: _dateOfBirth ?? DateTime(2000, 1, 1),
      firstDate: DateTime(1940),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.fromSeed(
              seedColor: colors.accent,
              brightness: Theme.of(context).brightness,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _dateOfBirth = picked);
    }
  }

  Future<void> _save() async {
    final success = await ref.read(authProvider.notifier).completeProfile(
          fullName: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          gender: _selectedGender ?? '',
          dob: _dateOfBirth,
          profileCategory: _profiling.profileCategory,
          profileField: _profiling.profileField,
          course: _courseController.text.trim(),
          organization: _organizationController.text.trim(),
          printingPreferences: _profiling.printingPreferences,
        );

    if (!success || !mounted) return;

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Profile updated successfully')),
    );
    Navigator.of(context).pop();
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
                    controller: _nameController,
                    label: 'Full Name',
                    hintText: 'Enter your full name',
                  ).animate()
                    .fadeIn(duration: 400.ms, curve: Curves.easeOut)
                    .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
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
                  ProfilingFormSection(
                    value: _profiling,
                    onChanged: (next) {
                      setState(() => _profiling = next);
                    },
                    courseController: _courseController,
                    organizationController: _organizationController,
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
                  InkWell(
                    onTap: _pickDate,
                    child: Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        vertical: AppSpacing.sm,
                      ),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(color: colors.outline),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            _dateOfBirth != null
                                ? formatDate(_dateOfBirth!)
                                : 'Select date',
                            style: AppTypography.body.copyWith(
                              color: _dateOfBirth != null
                                  ? colors.onBackground
                                  : colors.onSurfaceDim,
                            ),
                          ),
                          HugeIcon(
                            icon: HugeIcons.strokeRoundedCalendar03,
                            size: 20,
                            color: colors.onSurfaceDim,
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  // Gender chips
                  Text(
                    'Gender',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    children: _genders.map((gender) {
                      final isSelected = _selectedGender == gender;
                      return ChoiceChip(
                        label: Text(
                          gender,
                          style: AppTypography.body.copyWith(
                            color: isSelected
                                ? colors.background
                                : colors.onSurface,
                          ),
                        ),
                        selected: isSelected,
                        onSelected: (selected) {
                          setState(() {
                            _selectedGender = selected ? gender : null;
                          });
                        },
                        selectedColor: colors.accent,
                        backgroundColor: colors.surfaceVariant,
                        shape: RoundedRectangleBorder(
                          borderRadius: AppRadius.borderFull,
                          side: BorderSide(
                            color: isSelected
                                ? colors.accent
                                : colors.outline,
                          ),
                        ),
                        showCheckmark: false,
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                ],
              ),
            ),
          ),
          // Save button
          Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: AppButton(
              label: 'Save Changes',
              isFullWidth: true,
              onTap: () => _save(),
            ),
          ).animate()
            .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
            .slideY(begin: 0.03, duration: 400.ms, delay: 60.ms, curve: Curves.easeOut),
        ],
      ),
    );
  }
}
