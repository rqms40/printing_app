import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/slot_picker_sheet.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutSpeedCard extends ConsumerWidget {
  const CheckoutSpeedCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final fees = ref.watch(checkoutFeesProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final tiers = <_TierSpec>[
      _TierSpec(
        DeliverySpeedTier.priority,
        'Priority',
        '~15 min',
        fees.deliveryFee + 50,
      ),
      _TierSpec(
        DeliverySpeedTier.standard,
        'Standard',
        '~30 min',
        fees.deliveryFee,
      ),
      _TierSpec(DeliverySpeedTier.saver, 'Saver', '~60 min', 35),
      _TierSpec(
        DeliverySpeedTier.scheduled,
        'Scheduled',
        state.scheduledSlot == null
            ? 'Pick a slot'
            : '${state.scheduledSlot!.date} ${state.scheduledSlot!.startTime}',
        fees.deliveryFee,
      ),
    ];

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
          Text('How fast?', style: AppTypography.bodyBold),
          const SizedBox(height: AppSpacing.sm),
          for (final t in tiers)
            InkWell(
              onTap: () async {
                if (t.tier == DeliverySpeedTier.scheduled) {
                  final slot = await SlotPickerSheet.show(context);
                  if (slot != null) {
                    ref
                        .read(checkoutProvider.notifier)
                        .setScheduledSlot(slot);
                  }
                  return;
                }
                ref.read(checkoutProvider.notifier).setSpeedTier(t.tier);
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
                child: Row(
                  children: [
                    Radio<DeliverySpeedTier>(
                      value: t.tier,
                      groupValue: state.speedTier,
                      onChanged: (_) {},
                    ),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(t.label, style: AppTypography.bodyBold),
                          Text(t.subtitle, style: AppTypography.caption),
                        ],
                      ),
                    ),
                    Text(
                      formatCurrency(t.fee),
                      style: AppTypography.bodyBold,
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _TierSpec {
  const _TierSpec(this.tier, this.label, this.subtitle, this.fee);
  final DeliverySpeedTier tier;
  final String label;
  final String subtitle;
  final double fee;
}
