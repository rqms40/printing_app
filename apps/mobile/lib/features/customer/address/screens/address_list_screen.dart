import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/features/customer/address/providers/address_provider.dart';
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
    final errorMessage = notifier.errorMessage;

    Future<bool> deleteAddress(String id) async {
      final deleted = await notifier.deleteAddress(id);
      if (!deleted && context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              notifier.errorMessage ?? 'Unable to delete this address',
            ),
          ),
        );
      }
      return deleted;
    }

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
      body: Column(
        children: [
          if (errorMessage != null)
            MaterialBanner(
              content: Text(errorMessage),
              actions: [
                TextButton(
                  onPressed: notifier.refreshAddresses,
                  child: const Text('Retry'),
                ),
              ],
            ),
          Expanded(
            child: addresses.isEmpty
                ? const EmptyState(
                    heading: 'No saved addresses',
                    body:
                        'Add your delivery addresses to make ordering easier.',
                    icon: HugeIcons.strokeRoundedLocation01,
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(AppSpacing.md),
                    itemCount: addresses.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: AppSpacing.md),
                    itemBuilder: (context, index) {
                      final address = addresses[index];
                      final delay = (index * 60).ms;
                      return Dismissible(
                            key: ValueKey(address.id),
                            direction: DismissDirection.endToStart,
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.symmetric(
                                horizontal: AppSpacing.lg,
                              ),
                              decoration: BoxDecoration(
                                color: colors.error,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: HugeIcon(
                                icon: HugeIcons.strokeRoundedDelete02,
                                color: colors.background,
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
                              if (confirmed != true) return false;
                              return deleteAddress(address.id);
                            },
                            onDismissed: (_) {},
                            child: AddressCard(
                              address: address,
                              onEdit: () {
                                context.push('/customer/addresses/new');
                              },
                              onDelete: () {
                                ConfirmationDialog.show(
                                  context,
                                  title: 'Delete Address',
                                  message:
                                      'Are you sure you want to delete "${address.label}"?',
                                  confirmLabel: 'Delete',
                                  cancelLabel: 'Cancel',
                                  onConfirm: () async {
                                    Navigator.of(context).pop();
                                    await deleteAddress(address.id);
                                  },
                                  onCancel: () => Navigator.of(context).pop(),
                                );
                              },
                            ),
                          )
                          .animate()
                          .fadeIn(
                            duration: 400.ms,
                            delay: delay,
                            curve: Curves.easeOut,
                          )
                          .slideY(
                            begin: 0.03,
                            duration: 400.ms,
                            delay: delay,
                            curve: Curves.easeOut,
                          );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: notifier.canAddMore
          ? FloatingActionButton.extended(
              backgroundColor: colors.accent,
              foregroundColor: colors.background,
              onPressed: () {
                context.push('/customer/addresses/new');
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
