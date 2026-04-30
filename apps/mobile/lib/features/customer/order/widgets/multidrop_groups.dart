import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:uuid/uuid.dart';

class MultidropGroups extends ConsumerWidget {
  const MultidropGroups({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final drop in state.drops)
          Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.sm),
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              border: Border.all(color: colors.outline),
              borderRadius: AppRadius.borderMd,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(drop.label, style: AppTypography.bodyBold),
                    const Spacer(),
                    TextButton(
                      onPressed: () async {
                        final addr = await AddressPickerSheet.show(context);
                        if (addr == null) return;
                        ref.read(checkoutProvider.notifier).setDrops([
                          for (final d in state.drops)
                            if (d.id == drop.id)
                              d.copyWith(
                                addressId: int.tryParse(addr.id) ?? 0,
                                label: addr.label,
                              )
                            else
                              d,
                        ]);
                      },
                      child: const Text('Pick address'),
                    ),
                  ],
                ),
                if (drop.addressId == null)
                  Text('No address chosen', style: AppTypography.caption),
                for (final itemId in drop.itemIds)
                  Builder(builder: (_) {
                    final match = state.items.where((i) => i.id == itemId);
                    if (match.isEmpty) return const SizedBox.shrink();
                    return Text('• ${match.first.fileName}');
                  }),
              ],
            ),
          ),
        TextButton(
          onPressed: () {
            ref.read(checkoutProvider.notifier).setDrops([
              ...state.drops,
              DestinationGroup(
                id: const Uuid().v4(),
                label: 'Drop ${state.drops.length + 1}',
                itemIds: const [],
              ),
            ]);
          },
          child: const Text('+ Add another drop'),
        ),
      ],
    );
  }
}
