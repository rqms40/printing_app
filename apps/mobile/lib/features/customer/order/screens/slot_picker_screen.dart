import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:go_router/go_router.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/order/providers/order_checkout_provider.dart';

class SlotPickerScreen extends ConsumerStatefulWidget {
  const SlotPickerScreen({super.key, required this.date});
  final String date;

  @override
  ConsumerState<SlotPickerScreen> createState() => _SlotPickerScreenState();
}

class _SlotPickerScreenState extends ConsumerState<SlotPickerScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() =>
        ref.read(deliverySlotProvider(widget.date).notifier).initialize());
  }

  String _format12h(String hms) {
    final parts = hms.split(':');
    final h = int.parse(parts[0]);
    final m = parts[1];
    final pm = h >= 12;
    final hh = h % 12 == 0 ? 12 : h % 12;
    return '$hh:$m ${pm ? 'PM' : 'AM'}';
  }

  AppColorSet _colors(BuildContext context) =>
      Theme.of(context).brightness == Brightness.dark
          ? AppColors.dark
          : AppColors.light;

  @override
  Widget build(BuildContext context) {
    final colors = _colors(context);
    final state = ref.watch(deliverySlotProvider(widget.date));
    final checkout = ref.watch(orderCheckoutProvider);
    final notifier = ref.read(orderCheckoutProvider.notifier);

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
        title: Text('Pick a slot',
            style: AppTypography.h3.copyWith(color: colors.onBackground)),
      ),
      body: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          children: [
            Expanded(
              child: state.isLoading
                  ? Center(
                      child: CircularProgressIndicator(color: colors.brand))
                  : ListView.separated(
                      itemCount: state.slots.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 12),
                      itemBuilder: (_, i) {
                        final slot = state.slots[i];
                        final selected =
                            checkout.slotTemplateId == slot.templateId;
                        return _SlotCard(
                          time:
                              '${_format12h(slot.startTime)} – ${_format12h(slot.endTime)}',
                          bookedCount: slot.bookedCount,
                          capacity: slot.capacity,
                          isFull: slot.isFull,
                          isSelected: selected,
                          onTap: slot.isFull
                              ? null
                              : () => notifier.selectSlot(
                                    templateId: slot.templateId,
                                    date: widget.date,
                                  ),
                          colors: colors,
                        );
                      },
                    ),
            ),
            _PriorityToggle(
              priority: checkout.priority,
              colors: colors,
              onChanged: (_) => notifier.togglePriority(),
            ),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: checkout.slotTemplateId == null
                  ? null
                  : () => context.push('/customer/order/summary'),
              style: FilledButton.styleFrom(
                backgroundColor: colors.accent,
                foregroundColor: colors.accentOnColor,
                minimumSize: const Size.fromHeight(48),
                shape: RoundedRectangleBorder(borderRadius: AppRadius.borderMd),
              ),
              child: const Text('Continue'),
            ),
          ],
        ),
      ),
    );
  }
}

class _SlotCard extends StatelessWidget {
  const _SlotCard({
    required this.time,
    required this.bookedCount,
    required this.capacity,
    required this.isFull,
    required this.isSelected,
    required this.onTap,
    required this.colors,
  });
  final String time;
  final int bookedCount;
  final int capacity;
  final bool isFull;
  final bool isSelected;
  final VoidCallback? onTap;
  final AppColorSet colors;

  @override
  Widget build(BuildContext context) {
    final percent = (bookedCount / capacity).clamp(0, 1).toDouble();
    final fillColor = isFull
        ? colors.error
        : percent > 0.7
            ? colors.warning
            : colors.accent;

    return Material(
      color: isSelected ? colors.accent.withValues(alpha: 0.12) : colors.surface,
      borderRadius: AppRadius.borderMd,
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            border: Border.all(
              color: isSelected ? colors.accent : colors.outline,
              width: isSelected ? 2 : 1,
            ),
            borderRadius: AppRadius.borderMd,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      time,
                      style: AppTypography.bodyBold.copyWith(
                        color: colors.onBackground,
                        fontSize: 16,
                      ),
                    ),
                  ),
                  if (isFull)
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: colors.error,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: const Text(
                        'Full',
                        style: TextStyle(
                            color: Colors.white,
                            fontSize: 11,
                            fontWeight: FontWeight.w700),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '$bookedCount/$capacity booked',
                style: AppTypography.caption
                    .copyWith(color: colors.onSurfaceDim),
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: percent,
                  minHeight: 6,
                  backgroundColor: colors.surfaceVariant,
                  valueColor: AlwaysStoppedAnimation(fillColor),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PriorityToggle extends StatelessWidget {
  const _PriorityToggle({
    required this.priority,
    required this.colors,
    required this.onChanged,
  });
  final bool priority;
  final AppColorSet colors;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      value: priority,
      onChanged: onChanged,
      title: Text(
        'Priority drop',
        style: AppTypography.bodyBold.copyWith(color: colors.onBackground),
      ),
      subtitle: Text(
        '+₱50 — your batch will be dropped first within the slot',
        style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
      ),
      activeThumbColor: colors.accent,
      contentPadding: EdgeInsets.zero,
    );
  }
}
