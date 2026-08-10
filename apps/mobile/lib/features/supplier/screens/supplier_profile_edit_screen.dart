import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:image_picker/image_picker.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/supplier/models/supplier_profile.dart';
import 'package:printing_app/features/supplier/models/supplier_service_focus.dart';
import 'package:printing_app/features/supplier/providers/supplier_profile_provider.dart';
import 'package:printing_app/shared/widgets/app_button.dart';
import 'package:printing_app/shared/widgets/app_text_field.dart';

/// Full editor for supplier shop profile: details, attributes, logo, capabilities.
class SupplierProfileEditScreen extends ConsumerStatefulWidget {
  const SupplierProfileEditScreen({super.key});

  @override
  ConsumerState<SupplierProfileEditScreen> createState() =>
      _SupplierProfileEditScreenState();
}

class _SupplierProfileEditScreenState
    extends ConsumerState<SupplierProfileEditScreen> {
  final _businessNameController = TextEditingController();
  final _descriptionController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _addressController = TextEditingController();
  final _zonesController = TextEditingController();

  final Map<String, String> _attributes = {};
  bool _seeded = false;
  int? _seededProfileId;

  AppColorSet _colors(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
  }

  @override
  void dispose() {
    _businessNameController.dispose();
    _descriptionController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _addressController.dispose();
    _zonesController.dispose();
    super.dispose();
  }

  void _seedFrom(SupplierProfile profile) {
    if (_seeded && _seededProfileId == profile.id) return;
    _businessNameController.text = profile.businessName;
    _descriptionController.text = profile.description ?? '';
    _phoneController.text = profile.contactPhone ?? '';
    _emailController.text = profile.contactEmail ?? '';
    _addressController.text = profile.address ?? '';
    _zonesController.text = profile.serviceZones.join(', ');
    _attributes
      ..clear()
      ..addAll(profile.attributes);
    _seeded = true;
    _seededProfileId = profile.id;
  }

  Future<void> _pickLogo() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      builder: (ctx) {
        final colors = _colors(ctx);
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: HugeIcon(
                  icon: HugeIcons.strokeRoundedCamera01,
                  color: colors.onBackground,
                  size: 22,
                ),
                title: Text(
                  'Take photo',
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.camera),
              ),
              ListTile(
                leading: HugeIcon(
                  icon: HugeIcons.strokeRoundedImage01,
                  color: colors.onBackground,
                  size: 22,
                ),
                title: Text(
                  'Choose from gallery',
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                  ),
                ),
                onTap: () => Navigator.pop(ctx, ImageSource.gallery),
              ),
            ],
          ),
        );
      },
    );
    if (source == null || !mounted) return;

    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
      maxWidth: 1600,
    );
    if (picked == null || !mounted) return;

    final ok = await ref
        .read(supplierProfileProvider.notifier)
        .uploadAndSetLogo(picked);
    if (!mounted) return;
    final msg = ref.read(supplierProfileProvider).successMessage ??
        ref.read(supplierProfileProvider).errorMessage;
    if (msg != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
    if (ok) {
      // Re-seed logo-related fields only; keep in-progress form text.
      final profile = ref.read(supplierProfileProvider).profile;
      if (profile != null) {
        setState(() {
          // Keep form controllers; attributes already local.
        });
      }
    }
  }

  Future<void> _save() async {
    final name = _businessNameController.text.trim();
    if (name.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Business name is required')),
      );
      return;
    }

    final zones = _zonesController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();

    final ok = await ref.read(supplierProfileProvider.notifier).updateProfile(
          businessName: name,
          description: _descriptionController.text.trim(),
          contactPhone: _phoneController.text.trim(),
          contactEmail: _emailController.text.trim(),
          address: _addressController.text.trim(),
          serviceZones: zones,
          attributes: Map<String, String>.from(_attributes),
        );

    if (!mounted) return;
    final state = ref.read(supplierProfileProvider);
    final msg = state.successMessage ?? state.errorMessage;
    if (msg != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
    if (ok && Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
    }
  }

  Future<void> _addOrEditAttribute({String? existingKey}) async {
    final colors = _colors(context);
    final keyController = TextEditingController(text: existingKey ?? '');
    final valueController = TextEditingController(
      text: existingKey != null ? (_attributes[existingKey] ?? '') : '',
    );
    final isEdit = existingKey != null;

    final result = await showDialog<MapEntry<String, String>>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: colors.surface,
          title: Text(
            isEdit ? 'Edit attribute' : 'Add attribute',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppTextField(
                controller: keyController,
                label: 'Name',
                hintText: 'e.g. Equipment, Finishes, Languages',
                enabled: !isEdit,
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                controller: valueController,
                label: 'Value',
                hintText: 'e.g. HP Latex, lamination',
                maxLines: 2,
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Cancel',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
            ),
            TextButton(
              onPressed: () {
                final key = keyController.text.trim();
                final value = valueController.text.trim();
                if (key.isEmpty) return;
                Navigator.pop(ctx, MapEntry(key, value));
              },
              child: Text(
                isEdit ? 'Save' : 'Add',
                style: AppTypography.bodyBold.copyWith(color: colors.accent),
              ),
            ),
          ],
        );
      },
    );

    keyController.dispose();
    valueController.dispose();

    if (result == null) return;
    setState(() {
      if (isEdit && existingKey != result.key) {
        _attributes.remove(existingKey);
      }
      _attributes[result.key] = result.value;
    });
  }

  Future<void> _addCapability() async {
    final colors = _colors(context);
    final familyController = TextEditingController();
    final materialsController = TextEditingController();

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return AlertDialog(
          backgroundColor: colors.surface,
          title: Text(
            'Add product capability',
            style: AppTypography.h3.copyWith(color: colors.onBackground),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              AppTextField(
                controller: familyController,
                label: 'Product family',
                hintText: 'e.g. flyer, tarp, document',
              ),
              const SizedBox(height: AppSpacing.md),
              AppTextField(
                controller: materialsController,
                label: 'Materials (comma-separated)',
                hintText: 'e.g. glossy, matte',
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: Text(
                'Cancel',
                style: AppTypography.body.copyWith(color: colors.onSurfaceDim),
              ),
            ),
            TextButton(
              onPressed: () {
                if (familyController.text.trim().isEmpty) return;
                Navigator.pop(ctx, true);
              },
              child: Text(
                'Add',
                style: AppTypography.bodyBold.copyWith(color: colors.accent),
              ),
            ),
          ],
        );
      },
    );

    final family = familyController.text.trim();
    final materials = materialsController.text
        .split(',')
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    familyController.dispose();
    materialsController.dispose();

    if (confirmed != true || family.isEmpty) return;

    final ok = await ref.read(supplierProfileProvider.notifier).addCapability(
          productFamily: family,
          materials: materials,
        );
    if (!mounted) return;
    final msg = ref.read(supplierProfileProvider).successMessage ??
        ref.read(supplierProfileProvider).errorMessage;
    if (msg != null) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    }
    if (ok) {
      // Capabilities come from server refresh; form fields stay as-is.
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(supplierProfileProvider);
    final profile = state.profile;

    if (profile != null) {
      _seedFrom(profile);
    }

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Edit shop profile',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: state.isLoading && profile == null
          ? const Center(child: CircularProgressIndicator())
          : profile == null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(AppSpacing.xl),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          state.errorMessage ??
                              'Could not load supplier profile.',
                          textAlign: TextAlign.center,
                          style: AppTypography.body.copyWith(
                            color: colors.onSurfaceDim,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.md),
                        AppButton(
                          label: 'Retry',
                          onTap: () => ref
                              .read(supplierProfileProvider.notifier)
                              .refresh(),
                        ),
                      ],
                    ),
                  ),
                )
              : Column(
                  children: [
                    Expanded(
                      child: ListView(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.xl,
                          AppSpacing.md,
                          AppSpacing.xl,
                          AppSpacing.xxl,
                        ),
                        children: [
                          _LogoEditor(
                            logoUrl: profile.logoUrl,
                            businessName: profile.businessName,
                            isUploading: state.isUploadingLogo,
                            onTap: state.isUploadingLogo ? null : _pickLogo,
                          ),
                          const SizedBox(height: AppSpacing.xl),
                          Text(
                            'SERVICE FOCUS',
                            style: AppTypography.overline.copyWith(
                              color: colors.onSurfaceDim,
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Material(
                            color: colors.surface,
                            borderRadius: AppRadius.borderMd,
                            child: ListTile(
                              shape: RoundedRectangleBorder(
                                borderRadius: AppRadius.borderMd,
                                side: BorderSide(color: colors.outline),
                              ),
                              title: Text(
                                'Rank your services',
                                style: AppTypography.bodyBold.copyWith(
                                  color: colors.onBackground,
                                ),
                              ),
                              subtitle: Text(
                                profile.serviceFocusRanks.isEmpty
                                    ? 'Not set yet — add Signages, Tarpaulins…'
                                    : profile.serviceFocusRanks
                                        .asMap()
                                        .entries
                                        .map((e) {
                                          final n = e.key + 1;
                                          final label =
                                              SupplierServiceFocusCatalog
                                                  .labelFor(e.value);
                                          return '$n. $label';
                                        })
                                        .join(' · '),
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                              trailing: HugeIcon(
                                icon: HugeIcons.strokeRoundedArrowRight01,
                                color: colors.onSurfaceDim,
                                size: 18,
                              ),
                              onTap: () =>
                                  context.push('/supplier/service-focus'),
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xl),
                          Text(
                            'SHOP DETAILS',
                            style: AppTypography.overline.copyWith(
                              color: colors.onSurfaceDim,
                              letterSpacing: 1.5,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _businessNameController,
                            label: 'Business name',
                            hintText: 'Your print shop name',
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _descriptionController,
                            label: 'About / description',
                            hintText: 'What you print and who you serve',
                            maxLines: 3,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _phoneController,
                            label: 'Contact phone',
                            hintText: '+63…',
                            keyboardType: TextInputType.phone,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _emailController,
                            label: 'Contact email',
                            hintText: 'hello@shop.ph',
                            keyboardType: TextInputType.emailAddress,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _addressController,
                            label: 'Address',
                            hintText: 'Shop address',
                            maxLines: 2,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          AppTextField(
                            controller: _zonesController,
                            label: 'Service zones',
                            hintText: 'Davao City, Toril, …',
                          ),
                          const SizedBox(height: AppSpacing.xl),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'ATTRIBUTES',
                                  style: AppTypography.overline.copyWith(
                                    color: colors.onSurfaceDim,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                              ),
                              TextButton.icon(
                                onPressed: () => _addOrEditAttribute(),
                                icon: HugeIcon(
                                  icon: HugeIcons.strokeRoundedAdd01,
                                  color: colors.accent,
                                  size: 16,
                                ),
                                label: Text(
                                  'Add',
                                  style: AppTypography.caption.copyWith(
                                    color: colors.accent,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Free-form details shown on your shop profile '
                            '(equipment, finishes, languages, etc.).',
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          if (_attributes.isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: colors.surfaceVariant,
                                borderRadius: AppRadius.borderMd,
                              ),
                              child: Text(
                                'No attributes yet. Tap Add to create one.',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                            )
                          else
                            ..._attributes.entries.map((entry) {
                              return Padding(
                                padding: const EdgeInsets.only(
                                  bottom: AppSpacing.sm,
                                ),
                                child: Material(
                                  color: colors.surface,
                                  borderRadius: AppRadius.borderMd,
                                  child: ListTile(
                                    shape: RoundedRectangleBorder(
                                      borderRadius: AppRadius.borderMd,
                                      side: BorderSide(color: colors.outline),
                                    ),
                                    title: Text(
                                      entry.key,
                                      style: AppTypography.bodyBold.copyWith(
                                        color: colors.onBackground,
                                      ),
                                    ),
                                    subtitle: Text(
                                      entry.value.isEmpty ? '—' : entry.value,
                                      style: AppTypography.caption.copyWith(
                                        color: colors.onSurfaceDim,
                                      ),
                                    ),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        IconButton(
                                          tooltip: 'Edit',
                                          onPressed: () => _addOrEditAttribute(
                                            existingKey: entry.key,
                                          ),
                                          icon: HugeIcon(
                                            icon: HugeIcons.strokeRoundedEdit02,
                                            color: colors.onSurfaceDim,
                                            size: 18,
                                          ),
                                        ),
                                        IconButton(
                                          tooltip: 'Remove',
                                          onPressed: () {
                                            setState(() {
                                              _attributes.remove(entry.key);
                                            });
                                          },
                                          icon: HugeIcon(
                                            icon: HugeIcons
                                                .strokeRoundedDelete02,
                                            color: colors.error,
                                            size: 18,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            }),
                          const SizedBox(height: AppSpacing.xl),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  'CAPABILITIES',
                                  style: AppTypography.overline.copyWith(
                                    color: colors.onSurfaceDim,
                                    letterSpacing: 1.5,
                                  ),
                                ),
                              ),
                              TextButton.icon(
                                onPressed:
                                    state.isSaving ? null : _addCapability,
                                icon: HugeIcon(
                                  icon: HugeIcons.strokeRoundedAdd01,
                                  color: colors.accent,
                                  size: 16,
                                ),
                                label: Text(
                                  'Add',
                                  style: AppTypography.caption.copyWith(
                                    color: colors.accent,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            'Product families you can produce (used for matching).',
                            style: AppTypography.caption.copyWith(
                              color: colors.onSurfaceDim,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          if (profile.capabilities.isEmpty)
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.md),
                              decoration: BoxDecoration(
                                color: colors.surfaceVariant,
                                borderRadius: AppRadius.borderMd,
                              ),
                              child: Text(
                                'No capabilities listed yet.',
                                style: AppTypography.caption.copyWith(
                                  color: colors.onSurfaceDim,
                                ),
                              ),
                            )
                          else
                            ...profile.capabilities.map((cap) {
                              final materials = cap.materials.isEmpty
                                  ? 'No materials listed'
                                  : cap.materials.join(', ');
                              return Padding(
                                padding: const EdgeInsets.only(
                                  bottom: AppSpacing.sm,
                                ),
                                child: Material(
                                  color: colors.surface,
                                  borderRadius: AppRadius.borderMd,
                                  child: ListTile(
                                    shape: RoundedRectangleBorder(
                                      borderRadius: AppRadius.borderMd,
                                      side: BorderSide(color: colors.outline),
                                    ),
                                    title: Text(
                                      cap.productFamily,
                                      style: AppTypography.bodyBold.copyWith(
                                        color: colors.onBackground,
                                      ),
                                    ),
                                    subtitle: Text(
                                      materials,
                                      style: AppTypography.caption.copyWith(
                                        color: colors.onSurfaceDim,
                                      ),
                                    ),
                                    trailing: IconButton(
                                      tooltip: 'Remove',
                                      onPressed: state.isSaving
                                          ? null
                                          : () async {
                                              final messenger =
                                                  ScaffoldMessenger.of(context);
                                              final ok = await ref
                                                  .read(
                                                    supplierProfileProvider
                                                        .notifier,
                                                  )
                                                  .removeCapability(cap.id);
                                              if (!mounted) return;
                                              final msg = ref
                                                      .read(
                                                        supplierProfileProvider,
                                                      )
                                                      .successMessage ??
                                                  ref
                                                      .read(
                                                        supplierProfileProvider,
                                                      )
                                                      .errorMessage;
                                              if (msg != null) {
                                                messenger.showSnackBar(
                                                  SnackBar(
                                                    content: Text(msg),
                                                  ),
                                                );
                                              }
                                              if (ok) setState(() {});
                                            },
                                      icon: HugeIcon(
                                        icon: HugeIcons.strokeRoundedDelete02,
                                        color: colors.error,
                                        size: 18,
                                      ),
                                    ),
                                  ),
                                ),
                              );
                            }),
                        ],
                      ),
                    ),
                    SafeArea(
                      top: false,
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(
                          AppSpacing.xl,
                          AppSpacing.sm,
                          AppSpacing.xl,
                          AppSpacing.md,
                        ),
                        child: AppButton(
                          label: 'Save profile',
                          isFullWidth: true,
                          isLoading: state.isSaving,
                          onTap: state.isSaving || state.isUploadingLogo
                              ? null
                              : _save,
                        ),
                      ),
                    ),
                  ],
                ),
    );
  }
}

class _LogoEditor extends StatelessWidget {
  const _LogoEditor({
    required this.logoUrl,
    required this.businessName,
    required this.isUploading,
    required this.onTap,
  });

  final String? logoUrl;
  final String businessName;
  final bool isUploading;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final initial =
        businessName.isNotEmpty ? businessName[0].toUpperCase() : 'S';

    return Center(
      child: Column(
        children: [
          GestureDetector(
            onTap: onTap,
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: colors.surfaceVariant,
                    shape: BoxShape.circle,
                    border: Border.all(color: colors.outline),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: isUploading
                      ? const Center(
                          child: SizedBox(
                            width: 28,
                            height: 28,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : logoUrl != null && logoUrl!.isNotEmpty
                          ? Image.network(
                              logoUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) =>
                                  Center(
                                child: Text(
                                  initial,
                                  style: AppTypography.h1.copyWith(
                                    color: colors.accent,
                                  ),
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                initial,
                                style: AppTypography.h1.copyWith(
                                  color: colors.accent,
                                ),
                              ),
                            ),
                ),
                Positioned(
                  right: -2,
                  bottom: -2,
                  child: Container(
                    width: 32,
                    height: 32,
                    decoration: BoxDecoration(
                      color: colors.accent,
                      shape: BoxShape.circle,
                      border: Border.all(color: colors.background, width: 2),
                    ),
                    child: Center(
                      child: HugeIcon(
                        icon: HugeIcons.strokeRoundedCamera01,
                        color: colors.accentOnColor,
                        size: 16,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            isUploading ? 'Uploading…' : 'Change profile picture',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
        ],
      ),
    );
  }
}
