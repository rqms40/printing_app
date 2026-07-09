import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/providers/checkout_provider.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/sheets/slot_picker_sheet.dart';
import 'package:printing_app/features/customer/order/widgets/checkout_section_card.dart';
import 'package:printing_app/utils/formatters.dart';

class CheckoutSpeedCard extends ConsumerWidget {
  const CheckoutSpeedCard({super.key});

  static const _standardPreviewDays = 14;

  String _isoDate(DateTime date) =>
      '${date.year.toString().padLeft(4, '0')}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';

  String _dayLabel(DateTime date, int offset) {
    if (offset == 0) return 'Today';
    if (offset == 1) return 'Tomorrow';
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    return '${months[date.month - 1]} ${date.day}';
  }

  DateTime _parseSlotTime(String date, String hms) {
    final dParts = date.split('-').map(int.parse).toList();
    final tParts = hms.split(':').map((s) => int.tryParse(s) ?? 0).toList();
    return DateTime(
      dParts[0],
      dParts[1],
      dParts[2],
      tParts.isNotEmpty ? tParts[0] : 0,
      tParts.length > 1 ? tParts[1] : 0,
      tParts.length > 2 ? tParts[2] : 0,
    );
  }

  bool _hasLiveTodaySlot(
    DateTime now,
    String today,
    Iterable<DeliverySlot> slots,
  ) {
    return slots.any((s) {
      if (s.isFull) return false;
      final start = _parseSlotTime(today, s.startTime);
      final end = _parseSlotTime(today, s.endTime);
      return !start.isAfter(now) && end.isAfter(now);
    });
  }

  String? _nextBatchLabel({
    required DateTime now,
    required Iterable<_SlotPreviewDay> days,
  }) {
    for (final day in days) {
      final available = day.slots.where((slot) {
        if (slot.isFull) return false;
        if (day.offset == 0) {
          return _parseSlotTime(day.date, slot.endTime).isAfter(now);
        }
        return true;
      }).toList()..sort((a, b) => a.startTime.compareTo(b.startTime));
      if (available.isNotEmpty) {
        return _formatBatchLabel(day.label, available.first);
      }
    }
    return null;
  }

  String _formatBatchLabel(String dayLabel, DeliverySlot slot) =>
      'Next batch: $dayLabel ${slot.startTime.substring(0, 5)}-${slot.endTime.substring(0, 5)} · ${slot.bookedCount}/${slot.capacity} booked';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(checkoutProvider);
    final fees = ref.watch(checkoutFeesProvider);
    final colors = Theme.of(context).brightness == Brightness.dark
        ? AppColors.dark
        : AppColors.light;

    final now = DateTime.now();
    final previewDays = List.generate(_standardPreviewDays, (offset) {
      final date = now.add(Duration(days: offset));
      final isoDate = _isoDate(date);
      return _SlotPreviewDay(
        offset: offset,
        date: isoDate,
        label: _dayLabel(date, offset),
        slots: ref.watch(deliverySlotProvider(isoDate)).slots,
      );
    });
    final today = previewDays.first.date;
    final todaySlots = previewDays.first.slots;
    final hasLiveTodaySlot = _hasLiveTodaySlot(now, today, todaySlots);
    final nextBatchLabel = _nextBatchLabel(now: now, days: previewDays);

    // Preview values mirror the server's default delivery settings.
    const expressFeePreview = 75.0;
    const standardFeePreview = 25.0;

    final tiers = <_TierSpec>[
      _TierSpec(
        DeliverySpeedTier.priority,
        'Express',
        '~15 min · arrives first',
        state.speedTier == DeliverySpeedTier.priority
            ? fees.deliveryFee + fees.priorityFee
            : expressFeePreview,
        HugeIcons.strokeRoundedFlash,
        disabled: !hasLiveTodaySlot,
      ),
      _TierSpec(
        DeliverySpeedTier.standard,
        'Standard',
        hasLiveTodaySlot
            ? '~30 min · most popular'
            : nextBatchLabel ?? 'Nearest available batch will be assigned',
        state.speedTier == DeliverySpeedTier.standard
            ? fees.deliveryFee
            : standardFeePreview,
        HugeIcons.strokeRoundedClock01,
      ),
      _TierSpec(
        DeliverySpeedTier.scheduled,
        'Scheduled',
        state.scheduledSlot == null
            ? 'Pick a time slot'
            : '${state.scheduledSlot!.date} · ${state.scheduledSlot!.startTime.substring(0, 5)}',
        state.speedTier == DeliverySpeedTier.scheduled
            ? fees.deliveryFee
            : standardFeePreview,
        HugeIcons.strokeRoundedCalendar03,
      ),
    ];

    return CheckoutSectionCard(
      title: 'Delivery options',
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!hasLiveTodaySlot) ...[
            _NoSlotBanner(colors: colors),
            const SizedBox(height: 10),
          ] else ...[
            _OngoingBatchBanner(colors: colors),
            const SizedBox(height: 10),
          ],
          for (var i = 0; i < tiers.length; i++) ...[
            if (i > 0) const SizedBox(height: 8),
            _TierRow(
              spec: tiers[i],
              selected: state.speedTier == tiers[i].tier,
              colors: colors,
              onTap: tiers[i].disabled
                  ? null
                  : () async {
                      if (tiers[i].tier == DeliverySpeedTier.scheduled) {
                        final selectedDate = await showDatePicker(
                          context: context,
                          initialDate: now.add(const Duration(days: 1)),
                          firstDate: now.add(const Duration(days: 1)),
                          lastDate: now.add(const Duration(days: 30)),
                        );
                        if (selectedDate == null || !context.mounted) {
                          return;
                        }
                        final slot = await SlotPickerSheet.show(
                          context,
                          initialDate: _isoDate(selectedDate),
                        );
                        if (slot != null) {
                          ref
                              .read(checkoutProvider.notifier)
                              .setScheduledSlot(slot);
                        }
                        return;
                      }
                      ref
                          .read(checkoutProvider.notifier)
                          .setSpeedTier(tiers[i].tier);
                    },
            ),
          ],
        ],
      ),
    );
  }
}

class _TierSpec {
  const _TierSpec(
    this.tier,
    this.label,
    this.subtitle,
    this.fee,
    this.icon, {
    this.disabled = false,
  });
  final DeliverySpeedTier tier;
  final String label;
  final String subtitle;
  final double fee;
  final List<List<dynamic>> icon;
  final bool disabled;
}

class _SlotPreviewDay {
  const _SlotPreviewDay({
    required this.offset,
    required this.date,
    required this.label,
    required this.slots,
  });

  final int offset;
  final String date;
  final String label;
  final List<DeliverySlot> slots;
}

class _NoSlotBanner extends StatelessWidget {
  const _NoSlotBanner({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: colors.brand.withValues(alpha: 0.10),
        borderRadius: AppRadius.borderMd,
      ),
      child: Row(
        children: [
          HugeIcon(
            icon: HugeIcons.strokeRoundedAlert02,
            size: 16,
            color: colors.brand,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'No slot is open right now. Standard will join the nearest available batch, or schedule a future drop.',
              style: AppTypography.caption.copyWith(
                color: colors.onBackground,
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _OngoingBatchBanner extends StatelessWidget {
  const _OngoingBatchBanner({required this.colors});
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: const Color(0xFF78EC75).withValues(alpha: 0.15),
        borderRadius: AppRadius.borderMd,
      ),
      child: Row(
        children: [
          const HugeIcon(
            icon: HugeIcons.strokeRoundedDeliveryTruck01,
            size: 18,
            color: Color(0xFF78EC75),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'A batch is currently ongoing! Checkout now to join the active delivery.',
              style: AppTypography.caption.copyWith(
                color: colors.onBackground,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
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
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final disabled = spec.disabled;
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
              : colors.background.withValues(alpha: disabled ? 0.5 : 1.0),
          borderRadius: AppRadius.borderLg,
          border: Border.all(
            color: selected
                ? colors.brand.withValues(alpha: 0.6)
                : colors.outline.withValues(alpha: 0.35),
            width: selected ? 1.5 : 1,
          ),
        ),
        child: Opacity(
          opacity: disabled ? 0.45 : 1.0,
          child: Row(
            children: [
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: selected ? colors.brand : colors.surface,
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
                      disabled ? 'Unavailable right now' : spec.subtitle,
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
      ),
    );
  }
}
