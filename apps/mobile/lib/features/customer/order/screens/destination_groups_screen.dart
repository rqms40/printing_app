import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/cart/providers/cart_provider.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/order_checkout_provider.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/widgets/file_type_icon.dart';

class DestinationGroupsScreen extends ConsumerStatefulWidget {
  const DestinationGroupsScreen({super.key});

  static const routeName = '/customer/order/destinations';

  @override
  ConsumerState<DestinationGroupsScreen> createState() =>
      _DestinationGroupsScreenState();
}

class _DestinationGroupsScreenState
    extends ConsumerState<DestinationGroupsScreen> {
  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  @override
  void initState() {
    super.initState();
    Future.microtask(_initGroups);
  }

  void _initGroups() {
    final checkout = ref.read(orderCheckoutProvider);
    if (checkout.groups.isNotEmpty) return;

    final notifier = ref.read(orderCheckoutProvider.notifier);
    notifier.addGroup('All deliveries');

    // After adding, the new group is now at index 0
    final groupId = ref.read(orderCheckoutProvider).groups.first.id;
    final cartItems = ref.read(cartProvider).items;
    for (final item in cartItems) {
      notifier.moveItemToGroup(item.id, groupId);
    }
  }

  bool _allGroupsHaveAddress(List<DestinationGroup> groups) {
    if (groups.isEmpty) return false;
    return groups.every((g) => g.addressId != null);
  }

  void _onContinue(List<DestinationGroup> groups) {
    final today = DateTime.now().toIso8601String().substring(0, 10);
    context.push('/customer/order/slot-picker', extra: {'date': today});
  }

  void _showAddressPicker(
    BuildContext context,
    AppColorSet colors,
    DestinationGroup group,
    List<Address> addresses,
  ) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.lg,
                  AppSpacing.sm,
                ),
                child: Text(
                  'Select address',
                  style: AppTypography.h3.copyWith(color: colors.onBackground),
                ),
              ),
              if (addresses.isEmpty)
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.lg),
                  child: Text(
                    'No saved addresses. Add one in your profile.',
                    style: AppTypography.body.copyWith(
                      color: colors.onSurfaceDim,
                    ),
                  ),
                )
              else
                ...addresses.map(
                  (addr) => ListTile(
                    leading: HugeIcon(
                      icon: HugeIcons.strokeRoundedLocation01,
                      size: 22,
                      color: colors.brand,
                    ),
                    title: Text(
                      addr.label,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                      ),
                    ),
                    subtitle: Text(
                      addr.fullAddress.isNotEmpty
                          ? addr.fullAddress
                          : addr.city,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    onTap: () {
                      final numericId = int.tryParse(addr.id);
                      if (numericId != null) {
                        ref
                            .read(orderCheckoutProvider.notifier)
                            .assignAddress(group.id, numericId);
                      }
                      Navigator.of(ctx).pop();
                    },
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final checkout = ref.watch(orderCheckoutProvider);
    final cart = ref.watch(cartProvider);
    final addresses = ref.watch(addressProvider);
    final groups = checkout.groups;
    final canContinue = _allGroupsHaveAddress(groups);

    // Build a quick lookup for cart items by id
    final cartItemMap = <String, CartItem>{
      for (final item in cart.items) item.id: item,
    };

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        backgroundColor: colors.background,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.of(context).pop(),
          icon: HugeIcon(
            icon: HugeIcons.strokeRoundedArrowLeft01,
            size: 22,
            color: colors.onBackground,
          ),
          tooltip: 'Back',
        ),
        title: Text(
          'Destinations',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                AppSpacing.xxl,
              ),
              children: [
                ...groups.map((group) {
                  final groupAddressId = group.addressId;
                  final Address? selectedAddress = groupAddressId != null
                      ? addresses.where((a) {
                          final numericId = int.tryParse(a.id);
                          return numericId == groupAddressId;
                        }).firstOrNull
                      : null;

                  return Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.md),
                    child: _GroupCard(
                      group: group,
                      selectedAddress: selectedAddress,
                      cartItemMap: cartItemMap,
                      colors: colors,
                      onAddressTap: () => _showAddressPicker(
                        context,
                        colors,
                        group,
                        addresses,
                      ),
                    ),
                  );
                }),
                TextButton.icon(
                  onPressed: () {
                    ref
                        .read(orderCheckoutProvider.notifier)
                        .addGroup('Destination ${groups.length + 1}');
                  },
                  icon: HugeIcon(
                    icon: HugeIcons.strokeRoundedPlusSign,
                    size: 18,
                    color: colors.brand,
                  ),
                  label: Text(
                    '+ New Destination',
                    style:
                        AppTypography.bodyBold.copyWith(color: colors.brand),
                  ),
                  style: TextButton.styleFrom(
                    alignment: Alignment.centerLeft,
                    padding: EdgeInsets.zero,
                    minimumSize: const Size(0, 44),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                ),
              ],
            ),
          ),
          _ContinueBar(
            colors: colors,
            enabled: canContinue,
            onTap: canContinue ? () => _onContinue(groups) : null,
          ),
        ],
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------

class _GroupCard extends ConsumerStatefulWidget {
  const _GroupCard({
    required this.group,
    required this.selectedAddress,
    required this.cartItemMap,
    required this.colors,
    required this.onAddressTap,
  });

  final DestinationGroup group;
  final Address? selectedAddress;
  final Map<String, CartItem> cartItemMap;
  final AppColorSet colors;
  final VoidCallback onAddressTap;

  @override
  ConsumerState<_GroupCard> createState() => _GroupCardState();
}

class _GroupCardState extends ConsumerState<_GroupCard> {
  late final TextEditingController _labelController;
  bool _editingLabel = false;

  @override
  void initState() {
    super.initState();
    _labelController = TextEditingController(text: widget.group.label);
  }

  @override
  void dispose() {
    _labelController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final group = widget.group;
    final colors = widget.colors;

    // Resolve cart items assigned to this group
    final assignedItems = group.itemIds
        .map((id) => widget.cartItemMap[id])
        .whereType<CartItem>()
        .toList();

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outline.withValues(alpha: 0.45)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Editable label row
            _editingLabel
                ? TextField(
                    controller: _labelController,
                    autofocus: true,
                    style: AppTypography.h3.copyWith(
                      color: colors.onBackground,
                    ),
                    decoration: InputDecoration(
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                      border: InputBorder.none,
                      hintText: 'Group name',
                      hintStyle: AppTypography.h3.copyWith(
                        color: colors.onSurfaceDim,
                      ),
                    ),
                    onSubmitted: (_) => _commitLabel(group.id),
                    onEditingComplete: () => _commitLabel(group.id),
                  )
                : GestureDetector(
                    onTap: () => setState(() => _editingLabel = true),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            group.label,
                            style: AppTypography.h3.copyWith(
                              color: colors.onBackground,
                            ),
                          ),
                        ),
                        HugeIcon(
                          icon: HugeIcons.strokeRoundedPencilEdit01,
                          size: 16,
                          color: colors.onSurfaceDim,
                        ),
                      ],
                    ),
                  ),
            const SizedBox(height: AppSpacing.sm),

            // Address picker chip
            GestureDetector(
              onTap: widget.onAddressTap,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: widget.selectedAddress != null
                      ? colors.brand.withValues(alpha: 0.1)
                      : colors.surfaceVariant,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: widget.selectedAddress != null
                        ? colors.brand.withValues(alpha: 0.4)
                        : colors.outline.withValues(alpha: 0.5),
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedLocation01,
                      size: 14,
                      color: widget.selectedAddress != null
                          ? colors.brand
                          : colors.onSurfaceDim,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        widget.selectedAddress != null
                            ? '${widget.selectedAddress!.label} — ${widget.selectedAddress!.city}'
                            : 'Select address',
                        style: AppTypography.caption.copyWith(
                          color: widget.selectedAddress != null
                              ? colors.brand
                              : colors.onSurfaceDim,
                          fontWeight: FontWeight.w600,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Assigned items list
            if (assignedItems.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.sm),
              Divider(color: colors.outline.withValues(alpha: 0.4)),
              const SizedBox(height: AppSpacing.xs),
              ...assignedItems.map((CartItem item) {
                final fileName = item.fileName;
                final extension = fileName.split('.').last.toLowerCase();
                final mimeType = _mimeForExtension(extension);
                return Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: Row(
                    children: [
                      FileTypeIcon(mimeType: mimeType, size: 24),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Text(
                          fileName,
                          style: AppTypography.caption.copyWith(
                            color: colors.onBackground,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ] else ...[
              const SizedBox(height: AppSpacing.sm),
              Text(
                'No items assigned',
                style: AppTypography.caption.copyWith(
                  color: colors.onSurfaceDim,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  void _commitLabel(String groupId) {
    final label = _labelController.text.trim();
    if (label.isNotEmpty) {
      ref.read(orderCheckoutProvider.notifier).renameGroup(groupId, label);
    } else {
      // Restore the old label in the controller
      _labelController.text = widget.group.label;
    }
    setState(() => _editingLabel = false);
  }

  String _mimeForExtension(String ext) {
    switch (ext) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      case 'pdf':
        return 'application/pdf';
      case 'stl':
        return 'model/stl';
      case 'obj':
        return 'model/obj';
      case '3mf':
        return 'model/3mf';
      default:
        return 'application/octet-stream';
    }
  }
}

// ---------------------------------------------------------------------------
// Continue bar
// ---------------------------------------------------------------------------

class _ContinueBar extends StatelessWidget {
  const _ContinueBar({
    required this.colors,
    required this.enabled,
    required this.onTap,
  });

  final AppColorSet colors;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outline, width: 0.5)),
      ),
      child: FilledButton(
        onPressed: onTap,
        style: FilledButton.styleFrom(
          backgroundColor: colors.brand,
          disabledBackgroundColor: colors.brand.withValues(alpha: 0.35),
          foregroundColor: Colors.white,
          minimumSize: const Size.fromHeight(48),
          shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
        ),
        child: const Text('Continue'),
      ),
    );
  }
}
