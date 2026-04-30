import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
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
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.background,
              borderRadius: AppRadius.borderLg,
              border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    HugeIcon(
                      icon: HugeIcons.strokeRoundedLocation01,
                      size: 16,
                      color: drop.addressId == null
                          ? colors.onSurfaceDim
                          : colors.brand,
                    ),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        drop.label,
                        style: AppTypography.bodyBold.copyWith(
                          color: colors.onBackground,
                          fontSize: 14,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => ref
                          .read(checkoutProvider.notifier)
                          .setDrops(state.drops
                              .where((d) => d.id != drop.id)
                              .toList()),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 4,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            HugeIcon(
                              icon: HugeIcons.strokeRoundedDelete02,
                              size: 14,
                              color: colors.error,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Remove',
                              style: AppTypography.caption.copyWith(
                                color: colors.error,
                                fontWeight: FontWeight.w700,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                GestureDetector(
                  onTap: () async {
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
                  child: Text(
                    drop.addressId == null ? 'Pick address' : 'Change address',
                    style: AppTypography.caption.copyWith(
                      color: colors.brand,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
                if (drop.itemIds.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  for (final itemId in drop.itemIds)
                    Builder(builder: (_) {
                      final match = state.items.where((i) => i.id == itemId);
                      if (match.isEmpty) return const SizedBox.shrink();
                      return Padding(
                        padding: const EdgeInsets.only(top: 2),
                        child: Text(
                          '• ${match.first.fileName}',
                          style: AppTypography.caption.copyWith(
                            color: colors.onSurfaceDim,
                            fontSize: 12,
                          ),
                        ),
                      );
                    }),
                ],
              ],
            ),
          ),
        GestureDetector(
          onTap: () {
            ref.read(checkoutProvider.notifier).setDrops([
              ...state.drops,
              DestinationGroup(
                id: const Uuid().v4(),
                label: 'Drop ${state.drops.length + 1}',
                itemIds: const [],
              ),
            ]);
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedAdd01,
                  size: 16,
                  color: colors.brand,
                ),
                const SizedBox(width: 6),
                Text(
                  'Add another drop',
                  style: AppTypography.body.copyWith(
                    color: colors.brand,
                    fontWeight: FontWeight.w700,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
