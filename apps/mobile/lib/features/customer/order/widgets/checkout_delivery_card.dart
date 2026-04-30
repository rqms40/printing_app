import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/multidrop_groups.dart';

class CheckoutDeliveryCard extends ConsumerWidget {
  const CheckoutDeliveryCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.borderXl,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              for (final m in DeliveryMode.values)
                Padding(
                  padding: const EdgeInsets.only(right: AppSpacing.sm),
                  child: ChoiceChip(
                    label: Text(_labelForMode(m)),
                    selected: state.mode == m,
                    onSelected: (_) =>
                        ref.read(checkoutProvider.notifier).setMode(m),
                  ),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (state.mode == DeliveryMode.delivery)
            _SingleAddressRow(state: state, ref: ref)
          else if (state.mode == DeliveryMode.pickup)
            const _PickupCard()
          else
            const MultidropGroups(),
        ],
      ),
    );
  }

  String _labelForMode(DeliveryMode m) {
    switch (m) {
      case DeliveryMode.delivery:
        return 'Delivery';
      case DeliveryMode.pickup:
        return 'Pickup';
      case DeliveryMode.multidrop:
        return 'Multi-drop';
    }
  }
}

class _SingleAddressRow extends StatelessWidget {
  const _SingleAddressRow({required this.state, required this.ref});
  final CheckoutState state;
  final WidgetRef ref;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () async {
        final addr = await AddressPickerSheet.show(context);
        if (addr != null) {
          ref.read(checkoutProvider.notifier).setSingleAddress(addr);
        }
      },
      child: Row(
        children: [
          const Icon(Icons.location_on, color: Colors.red),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Text(
              state.singleAddress?.label ?? 'Pick a delivery address',
              style: AppTypography.body,
            ),
          ),
          const Icon(Icons.chevron_right),
        ],
      ),
    );
  }
}

class _PickupCard extends StatelessWidget {
  const _PickupCard();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Text('🏪 GRID Print Shop · 123 Print St, Makati'),
    );
  }
}
