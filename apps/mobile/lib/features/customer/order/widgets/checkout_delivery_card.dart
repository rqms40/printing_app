import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/address_picker_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_segmented.dart';
import 'package:printing_app/features/customer/order/widgets/multidrop_groups.dart';

class CheckoutDeliveryCard extends ConsumerWidget {
  const CheckoutDeliveryCard({super.key, this.segmentedKey});

  final GlobalKey? segmentedKey;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    return CheckoutSectionCard(
      title: 'Delivery',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          CheckoutSegmented<DeliveryMode>(
            tutorialKey: segmentedKey,
            selected: state.mode,
            onChanged: (m) => ref.read(checkoutProvider.notifier).setMode(m),
            items: const [
              SegmentedItem(
                value: DeliveryMode.delivery,
                icon: HugeIcons.strokeRoundedTruckDelivery,
                label: 'Delivery',
              ),
              SegmentedItem(
                value: DeliveryMode.pickup,
                icon: HugeIcons.strokeRoundedStore01,
                label: 'Pickup',
              ),
              SegmentedItem(
                value: DeliveryMode.multidrop,
                icon: HugeIcons.strokeRoundedRoute01,
                label: 'Multi-drop',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          if (state.mode == DeliveryMode.delivery)
            _SingleAddressRow(state: state, ref: ref, colors: colors)
          else if (state.mode == DeliveryMode.pickup)
            _PickupCard(colors: colors)
          else
            const MultidropGroups(),
        ],
      ),
    );
  }
}

class _SingleAddressRow extends StatelessWidget {
  const _SingleAddressRow({
    required this.state,
    required this.ref,
    required this.colors,
  });
  final CheckoutState state;
  final WidgetRef ref;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final addr = state.singleAddress;
    return InkWell(
      borderRadius: AppRadius.borderLg,
      onTap: () async {
        final picked = await AddressPickerSheet.show(context);
        if (picked != null) {
          ref.read(checkoutProvider.notifier).setSingleAddress(picked);
        }
      },
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: colors.background,
          borderRadius: AppRadius.borderLg,
          border: Border.all(
            color: addr == null
                ? colors.brand.withValues(alpha: 0.4)
                : colors.outline.withValues(alpha: 0.4),
            style: addr == null ? BorderStyle.solid : BorderStyle.solid,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: colors.brand.withValues(alpha: 0.14),
                shape: BoxShape.circle,
              ),
              child: Center(
                child: HugeIcon(
                  icon: HugeIcons.strokeRoundedLocation01,
                  size: 18,
                  color: colors.brand,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    addr?.label ?? 'Pick a delivery address',
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                      fontSize: 14,
                    ),
                  ),
                  if (addr != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      addr.fullAddress,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: AppTypography.caption.copyWith(
                        color: colors.onSurfaceDim,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            HugeIcon(
              icon: HugeIcons.strokeRoundedArrowRight01,
              size: 18,
              color: colors.onSurfaceDim,
            ),
          ],
        ),
      ),
    );
  }
}

class _PickupCard extends StatelessWidget {
  const _PickupCard({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: colors.outline.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: colors.brand.withValues(alpha: 0.14),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: HugeIcon(
                icon: HugeIcons.strokeRoundedStore01,
                size: 18,
                color: colors.brand,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'GRID Print Shop',
                  style: AppTypography.bodyBold.copyWith(
                    color: colors.onBackground,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '123 Print St, Makati · Open until 8 PM',
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: colors.brand.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(99),
            ),
            child: Text(
              'FREE',
              style: AppTypography.caption.copyWith(
                color: colors.brand,
                fontSize: 10,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
