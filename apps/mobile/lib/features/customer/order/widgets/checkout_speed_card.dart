import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/sheets/slot_picker_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';
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
        '~15 min · arrives first',
        fees.deliveryFee + 50,
        HugeIcons.strokeRoundedFlash,
      ),
      _TierSpec(
        DeliverySpeedTier.standard,
        'Standard',
        '~30 min · most popular',
        fees.deliveryFee,
        HugeIcons.strokeRoundedClock01,
      ),
      _TierSpec(
        DeliverySpeedTier.saver,
        'Saver',
        '~60 min · cheaper',
        35,
        HugeIcons.strokeRoundedLeaf01,
      ),
      _TierSpec(
        DeliverySpeedTier.scheduled,
        'Scheduled',
        state.scheduledSlot == null
            ? 'Pick a time slot'
            : '${state.scheduledSlot!.date} · ${state.scheduledSlot!.startTime.substring(0, 5)}',
        fees.deliveryFee,
        HugeIcons.strokeRoundedCalendar03,
      ),
    ];

    return CheckoutSectionCard(
      title: 'Delivery options',
      child: Column(
        children: [
          for (var i = 0; i < tiers.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _TierRow(
              spec: tiers[i],
              selected: state.speedTier == tiers[i].tier,
              colors: colors,
              onTap: () async {
                if (tiers[i].tier == DeliverySpeedTier.scheduled) {
                  final slot = await SlotPickerSheet.show(context);
                  if (slot != null) {
                    ref.read(checkoutProvider.notifier).setScheduledSlot(slot);
                  }
                  return;
                }
                ref.read(checkoutProvider.notifier).setSpeedTier(tiers[i].tier);
              },
            ),
          ],
        ],
      ),
    );
  }
}

class _TierSpec {
  const _TierSpec(this.tier, this.label, this.subtitle, this.fee, this.icon);
  final DeliverySpeedTier tier;
  final String label;
  final String subtitle;
  final double fee;
  final List<List<dynamic>> icon;
}

class _TierRow extends StatelessWidget {
  const _TierRow({
    required this.spec,
    required this.selected,
    required this.colors,
    required this.onTap,
  });

  final _TierSpec spec;
  final bool selected;
  final AppColorSet colors;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: AppRadius.borderLg,
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm + 2,
        ),
        decoration: BoxDecoration(
          color: selected
              ? colors.brand.withValues(alpha: 0.10)
              : colors.background,
          borderRadius: AppRadius.borderLg,
          border: Border.all(
            color: selected
                ? colors.brand.withValues(alpha: 0.6)
                : colors.outline.withValues(alpha: 0.35),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: selected
                    ? colors.brand
                    : colors.surface,
                shape: BoxShape.circle,
              ),
              child: Center(
                child: HugeIcon(
                  icon: spec.icon,
                  size: 16,
                  color: selected ? colors.background : colors.onSurfaceDim,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    spec.label,
                    style: AppTypography.bodyBold.copyWith(
                      color: colors.onBackground,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    spec.subtitle,
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurfaceDim,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
            Text(
              formatCurrency(spec.fee),
              style: AppTypography.bodyBold.copyWith(
                color: selected ? colors.brand : colors.onBackground,
                fontSize: 14,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
