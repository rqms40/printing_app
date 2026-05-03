import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:latlong2/latlong.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/address/widgets/map_pin_picker.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/shared/models/address.dart';

class AddressPickerSheet {
  static Future<Address?> show(BuildContext context) async {
    final selection = await _showSelection(
      context,
      allowTemporary: false,
      mapTilesEnabled: true,
    );
    return selection?.savedAddress;
  }

  static Future<CheckoutAddressSelection?> showSelection(
    BuildContext context, {
    bool mapTilesEnabled = true,
    TemporaryCheckoutAddress? initialTemporaryAddress,
  }) {
    return _showSelection(
      context,
      allowTemporary: true,
      mapTilesEnabled: mapTilesEnabled,
      initialTemporaryAddress: initialTemporaryAddress,
    );
  }

  static Future<CheckoutAddressSelection?> _showSelection(
    BuildContext context, {
    required bool allowTemporary,
    required bool mapTilesEnabled,
    TemporaryCheckoutAddress? initialTemporaryAddress,
  }) {
    return showModalBottomSheet<CheckoutAddressSelection>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _AddressPickerBody(
        allowTemporary: allowTemporary,
        mapTilesEnabled: mapTilesEnabled,
        initialTemporaryAddress: initialTemporaryAddress,
      ),
    );
  }
}

class _AddressPickerBody extends ConsumerStatefulWidget {
  const _AddressPickerBody({
    required this.allowTemporary,
    required this.mapTilesEnabled,
    this.initialTemporaryAddress,
  });

  final bool allowTemporary;
  final bool mapTilesEnabled;
  final TemporaryCheckoutAddress? initialTemporaryAddress;

  @override
  ConsumerState<_AddressPickerBody> createState() => _AddressPickerBodyState();
}

class _AddressPickerBodyState extends ConsumerState<_AddressPickerBody> {
  final _formKey = GlobalKey<FormState>();
  final _labelController = TextEditingController();
  final _fullAddressController = TextEditingController();
  final _cityController = TextEditingController();
  final _landmarkController = TextEditingController();
  var _pinMode = false;
  var _selectedPoint = const LatLng(7.0731, 125.6128);

  @override
  void initState() {
    super.initState();
    final initial = widget.initialTemporaryAddress;
    if (initial == null) return;
    _labelController.text = initial.label ?? '';
    _fullAddressController.text = initial.fullAddress;
    _cityController.text = initial.city;
    _landmarkController.text = initial.landmark ?? '';
    _selectedPoint = LatLng(initial.latitude, initial.longitude);
  }

  @override
  void dispose() {
    _labelController.dispose();
    _fullAddressController.dispose();
    _cityController.dispose();
    _landmarkController.dispose();
    super.dispose();
  }

  void _submitTemporaryAddress() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    final address = TemporaryCheckoutAddress(
      label: _labelController.text,
      fullAddress: _fullAddressController.text,
      city: _cityController.text,
      landmark: _landmarkController.text,
      latitude: _selectedPoint.latitude,
      longitude: _selectedPoint.longitude,
    );
    Navigator.of(context).pop(CheckoutAddressSelection.temporary(address));
  }

  @override
  Widget build(BuildContext context) {
    final addresses = ref.watch(addressProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;
    final media = MediaQuery.of(context);
    final bottomInset = media.viewInsets.bottom > 0
        ? media.viewInsets.bottom
        : media.viewPadding.bottom;

    return Padding(
      padding: EdgeInsets.only(bottom: bottomInset),
      child: Container(
        height: _pinMode ? media.size.height * 0.9 : null,
        constraints: BoxConstraints(maxHeight: media.size.height * 0.9),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
        ),
        child: _pinMode
            ? _buildTemporaryAddressForm(colors)
            : _buildSavedAddressList(addresses, colors),
      ),
    );
  }

  Widget _buildSavedAddressList(List<Address> addresses, AppColorSet colors) {
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _SheetHeader(title: 'Choose a delivery address', colors: colors),
          if (widget.allowTemporary)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: _SheetActionTile(
                icon: Icons.add_location_alt_outlined,
                title: 'Pin Location',
                subtitle: 'Use a temporary delivery address for this order',
                colors: colors,
                onTap: () => setState(() => _pinMode = true),
              ),
            ),
          Flexible(
            child: ListView.separated(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                0,
                AppSpacing.md,
                AppSpacing.md,
              ),
              itemCount: addresses.length,
              separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
              itemBuilder: (context, index) {
                final address = addresses[index];
                return _SheetActionTile(
                  icon: Icons.place_outlined,
                  title: address.label,
                  subtitle: address.fullAddress,
                  colors: colors,
                  onTap: () => Navigator.of(
                    context,
                  ).pop(CheckoutAddressSelection.saved(address)),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTemporaryAddressForm(AppColorSet colors) {
    return SafeArea(
      top: false,
      child: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.md,
            0,
            AppSpacing.md,
            AppSpacing.md,
          ),
          children: [
            _SheetHeader(
              title: 'Pin temporary address',
              colors: colors,
              leading: IconButton(
                onPressed: () => setState(() => _pinMode = false),
                icon: Icon(Icons.arrow_back, color: colors.onBackground),
              ),
            ),
            MapPinPicker(
              height: 220,
              mapTilesEnabled: widget.mapTilesEnabled,
              initialCenter: _selectedPoint,
              onChanged: (point) => _selectedPoint = point,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _labelController,
              decoration: const InputDecoration(
                labelText: 'Label',
                hintText: 'e.g. Event booth, Client office',
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _fullAddressController,
              decoration: const InputDecoration(
                labelText: 'Full Address *',
                hintText: 'Street, building, unit',
              ),
              maxLines: 2,
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Enter the delivery address'
                  : null,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _cityController,
              decoration: const InputDecoration(
                labelText: 'City *',
                hintText: 'City or municipality',
              ),
              validator: (value) => value == null || value.trim().isEmpty
                  ? 'Enter the city'
                  : null,
            ),
            const SizedBox(height: AppSpacing.md),
            TextFormField(
              controller: _landmarkController,
              decoration: const InputDecoration(
                labelText: 'Landmark',
                hintText: 'Nearby store, gate, floor, or handoff note',
              ),
              maxLines: 2,
            ),
            const SizedBox(height: AppSpacing.lg),
            SizedBox(
              height: 52,
              child: FilledButton(
                onPressed: _submitTemporaryAddress,
                child: const Text('Use this location'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SheetHeader extends StatelessWidget {
  const _SheetHeader({required this.title, required this.colors, this.leading});

  final String title;
  final AppColorSet colors;
  final Widget? leading;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.md,
        AppSpacing.sm,
      ),
      child: Row(
        children: [
          if (leading != null) ...[
            leading!,
            const SizedBox(width: AppSpacing.xs),
          ],
          Expanded(
            child: Text(
              title,
              style: AppTypography.bodyBold.copyWith(
                color: colors.onBackground,
                fontSize: 16,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SheetActionTile extends StatelessWidget {
  const _SheetActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.colors,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: colors.background,
      borderRadius: AppRadius.borderLg,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Icon(icon, color: colors.brand, size: 22),
              const SizedBox(width: AppSpacing.sm),
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
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: colors.onSurfaceDim, size: 20),
            ],
          ),
        ),
      ),
    );
  }
}
