import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/address/widgets/map_pin_picker.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';
import 'package:latlong2/latlong.dart';

class AddressPickerScreen extends ConsumerStatefulWidget {
  const AddressPickerScreen({super.key, this.existingAddress});

  final Address? existingAddress;

  @override
  ConsumerState<AddressPickerScreen> createState() =>
      _AddressPickerScreenState();
}

class _AddressPickerScreenState extends ConsumerState<AddressPickerScreen> {
  late final TextEditingController _labelController;
  late final TextEditingController _fullAddressController;
  late final TextEditingController _barangayController;
  late final TextEditingController _cityController;
  late final TextEditingController _provinceController;
  late final TextEditingController _zipCodeController;
  late final TextEditingController _landmarkController;
  bool _isDefault = false;
  bool _isEditing = false;
  late LatLng _pinnedLocation;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingAddress;
    _isEditing = existing != null;
    _labelController = TextEditingController(text: existing?.label ?? '');
    _fullAddressController = TextEditingController(
      text: existing?.fullAddress ?? '',
    );
    _barangayController = TextEditingController(text: existing?.barangay ?? '');
    _cityController = TextEditingController(text: existing?.city ?? '');
    _provinceController = TextEditingController(text: existing?.province ?? '');
    _zipCodeController = TextEditingController(text: existing?.zipCode ?? '');
    _landmarkController = TextEditingController(text: existing?.landmark ?? '');
    _isDefault = existing?.isDefault ?? false;
    _pinnedLocation = LatLng(
      existing?.latitude ?? 7.0731,
      existing?.longitude ?? 125.6128,
    );
  }

  @override
  void dispose() {
    _labelController.dispose();
    _fullAddressController.dispose();
    _barangayController.dispose();
    _cityController.dispose();
    _provinceController.dispose();
    _zipCodeController.dispose();
    _landmarkController.dispose();
    super.dispose();
  }

  void _save() {
    if (_cityController.text.trim().isEmpty ||
        _landmarkController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('City and Landmark are required')),
      );
      return;
    }

    final now = DateTime.now();
    final notifier = ref.read(addressProvider.notifier);

    if (_isEditing) {
      final updated = widget.existingAddress!.copyWith(
        label: _labelController.text.trim(),
        fullAddress: _fullAddressController.text.trim(),
        barangay: _barangayController.text.trim(),
        city: _cityController.text.trim(),
        province: _provinceController.text.trim(),
        zipCode: _zipCodeController.text.trim(),
        landmark: _landmarkController.text.trim(),
        latitude: _pinnedLocation.latitude,
        longitude: _pinnedLocation.longitude,
        isDefault: _isDefault,
        updatedAt: now,
      );
      notifier.updateAddress(updated);
      if (_isDefault) {
        notifier.setDefault(updated.id);
      }
    } else {
      final newAddress = Address(
        id: 'addr_${now.millisecondsSinceEpoch}',
        userId: 'usr_001',
        label: _labelController.text.trim().isEmpty
            ? 'Address'
            : _labelController.text.trim(),
        fullAddress: _fullAddressController.text.trim(),
        barangay: _barangayController.text.trim(),
        city: _cityController.text.trim(),
        province: _provinceController.text.trim(),
        zipCode: _zipCodeController.text.trim(),
        landmark: _landmarkController.text.trim(),
        latitude: _pinnedLocation.latitude,
        longitude: _pinnedLocation.longitude,
        isDefault: _isDefault,
        createdAt: now,
        updatedAt: now,
      );
      notifier.addAddress(newAddress);
    }

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
          _isEditing ? 'Edit Address' : 'Add Address',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: Column(
        children: [
          // Map placeholder
          Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: MapPinPicker(
                  initialCenter: _pinnedLocation,
                  onChanged: (location) => _pinnedLocation = location,
                ),
              )
              .animate()
              .fadeIn(duration: 400.ms, curve: Curves.easeOut)
              .slideY(begin: 0.03, duration: 400.ms, curve: Curves.easeOut),
          // Form fields
          Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.md,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppTextField(
                        controller: _labelController,
                        label: 'Label',
                        hintText: 'e.g. Home, Office',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppTextField(
                        controller: _fullAddressController,
                        label: 'Full Address',
                        hintText: 'Street, Building, Unit',
                        maxLines: 2,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppTextField(
                        controller: _barangayController,
                        label: 'Barangay',
                        hintText: 'Barangay name',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppTextField(
                        controller: _cityController,
                        label: 'City *',
                        hintText: 'City or Municipality',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppTextField(
                        controller: _provinceController,
                        label: 'Province',
                        hintText: 'Province',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppTextField(
                        controller: _zipCodeController,
                        label: 'Zip Code',
                        hintText: 'e.g. 1229',
                        keyboardType: TextInputType.number,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppTextField(
                        controller: _landmarkController,
                        label: 'Landmark *',
                        hintText: 'e.g. Near Jollibee on Main St',
                      ),
                      const SizedBox(height: AppSpacing.md),
                      // Set as default toggle
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Set as default address',
                            style: AppTypography.body.copyWith(
                              color: colors.onSurface,
                            ),
                          ),
                          Switch(
                            value: _isDefault,
                            onChanged: (value) {
                              setState(() => _isDefault = value);
                            },
                            activeThumbColor: colors.accent,
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                    ],
                  ),
                ),
              )
              .animate()
              .fadeIn(duration: 400.ms, delay: 60.ms, curve: Curves.easeOut)
              .slideY(
                begin: 0.02,
                duration: 400.ms,
                delay: 60.ms,
                curve: Curves.easeOut,
              ),
          // Save button
          Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: AppButton(
                  label: 'Save Address',
                  isFullWidth: true,
                  onTap: _save,
                ),
              )
              .animate()
              .fadeIn(duration: 400.ms, delay: 120.ms, curve: Curves.easeOut)
              .slideY(
                begin: 0.03,
                duration: 400.ms,
                delay: 120.ms,
                curve: Curves.easeOut,
              ),
        ],
      ),
    );
  }
}
