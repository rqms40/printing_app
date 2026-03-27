import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
import 'package:printing_app/features/customer/address/screens/address_picker_screen.dart';
import 'package:printing_app/features/customer/address/widgets/address_card.dart';
import 'package:printing_app/shared/widgets/confirmation_dialog.dart';
import 'package:printing_app/shared/widgets/empty_state.dart';

class AddressListScreen extends ConsumerWidget {
  const AddressListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addresses = ref.watch(addressProvider);
    final notifier = ref.read(addressProvider.notifier);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(
        title: Text(
          'Saved Addresses',
          style: AppTypography.h3.copyWith(color: colors.onBackground),
        ),
        backgroundColor: colors.background,
        elevation: 0,
        iconTheme: IconThemeData(color: colors.onBackground),
      ),
      body: addresses.isEmpty
          ? const EmptyState(
              heading: 'No saved addresses',
              body: 'Add your delivery addresses to make ordering easier.',
              icon: HugeIcons.strokeRoundedLocation01,
            )
          : ListView.separated(
              padding: const EdgeInsets.all(AppSpacing.md),
              itemCount: addresses.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: AppSpacing.md),
              itemBuilder: (context, index) {
                final address = addresses[index];
                return Dismissible(
                  key: ValueKey(address.id),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding:
                        const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
                    decoration: BoxDecoration(
                      color: colors.error,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const HugeIcon(
                      icon: HugeIcons.strokeRoundedDelete02,
                      color: Colors.white,
                    ),
                  ),
                  confirmDismiss: (_) async {
                    bool? confirmed;
                    await ConfirmationDialog.show(
                      context,
                      title: 'Delete Address',
                      message:
                          'Are you sure you want to delete "${address.label}"?',
                      confirmLabel: 'Delete',
                      cancelLabel: 'Cancel',
                      onConfirm: () {
                        confirmed = true;
                        Navigator.of(context).pop();
                      },
                      onCancel: () {
                        confirmed = false;
                        Navigator.of(context).pop();
                      },
                    );
                    return confirmed ?? false;
                  },
                  onDismissed: (_) {
                    notifier.deleteAddress(address.id);
                  },
                  child: AddressCard(
                    address: address,
                    onEdit: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) =>
                              AddressPickerScreen(existingAddress: address),
                        ),
                      );
                    },
                    onDelete: () {
                      ConfirmationDialog.show(
                        context,
                        title: 'Delete Address',
                        message:
                            'Are you sure you want to delete "${address.label}"?',
                        confirmLabel: 'Delete',
                        cancelLabel: 'Cancel',
                        onConfirm: () {
                          notifier.deleteAddress(address.id);
                          Navigator.of(context).pop();
                        },
                        onCancel: () => Navigator.of(context).pop(),
                      );
                    },
                  ),
                );
              },
            ),
      floatingActionButton: notifier.canAddMore
          ? FloatingActionButton.extended(
              backgroundColor: colors.accent,
              foregroundColor: colors.background,
              onPressed: () {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => const AddressPickerScreen(),
                  ),
                );
              },
              icon: const HugeIcon(icon: HugeIcons.strokeRoundedAdd01),
              label: Text(
                'Add Address',
                style: AppTypography.button.copyWith(color: colors.background),
              ),
            )
          : null,
    );
  }
}
