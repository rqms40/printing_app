import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hugeicons/hugeicons.dart';
import 'package:printing_app/config/theme/app_colors.dart';
import 'package:printing_app/config/theme/app_radius.dart';
import 'package:printing_app/config/theme/app_spacing.dart';
import 'package:printing_app/config/theme/app_typography.dart';
import 'package:printing_app/features/customer/order/models/delivery_slot.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';

enum NextBatchReason { allFull, dayOver, weekend, midDay }

class NextBatchInfo {
  const NextBatchInfo({
    required this.reason,
    required this.todayDate,
    required this.nextDate,
    this.nextSlotStart,
    this.nextSlotEnd,
    this.todaysLastEnd,
    this.bookedTotal = 0,
    this.capacityTotal = 0,
  });

  final NextBatchReason reason;
  final String todayDate;
  final String nextDate;
  final String? nextSlotStart;
  final String? nextSlotEnd;
  final String? todaysLastEnd;
  final int bookedTotal;
  final int capacityTotal;
}

String _formatDateLabel(DateTime d) {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const days = [
    'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun',
  ];
  return '${days[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}';
}

String _format12h(String hms) {
  final parts = hms.split(':');
  if (parts.length < 2) return hms;
  final h = int.tryParse(parts[0]) ?? 0;
  final m = parts[1];
  final period = h >= 12 ? 'PM' : 'AM';
  final hh = h % 12 == 0 ? 12 : h % 12;
  return '$hh:$m $period';
}

String _isoDate(DateTime d) =>
    '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

DateTime _parseDateTime(String date, String hms) {
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

/// Looks at today's slots; if all are full or all have ended, returns
/// information that drives the dialog. Returns `null` if nothing to show.
final nextBatchInfoProvider = Provider.autoDispose<NextBatchInfo?>((ref) {
  final now = DateTime.now();
  final today = _isoDate(now);
  final tomorrow = _isoDate(now.add(const Duration(days: 1)));
  final dayAfter = _isoDate(now.add(const Duration(days: 2)));

  final todayState = ref.watch(deliverySlotProvider(today));
  if (todayState.isLoading) return null;

  final slots = todayState.slots;

  if (slots.isEmpty) {
    final probe = ref.watch(deliverySlotProvider(tomorrow));
    final tom = probe.slots;
    final firstTom = tom.isNotEmpty ? tom.first : null;
    return NextBatchInfo(
      reason: NextBatchReason.weekend,
      todayDate: today,
      nextDate: firstTom != null ? tomorrow : dayAfter,
      nextSlotStart: firstTom?.startTime,
      nextSlotEnd: firstTom?.endTime,
    );
  }

  final allFull = slots.every((s) => s.isFull);
  final allEnded = slots.every(
    (s) => _parseDateTime(today, s.endTime).isBefore(now),
  );
  final firstStarted = slots.any(
    (s) => _parseDateTime(today, s.startTime).isBefore(now),
  );

  // Find the next bookable slot (today first, then tomorrow).
  final upcomingToday = slots
      .where((s) =>
          !s.isFull &&
          _parseDateTime(today, s.startTime).isAfter(now))
      .toList()
    ..sort((a, b) => a.startTime.compareTo(b.startTime));
  final nextToday = upcomingToday.isNotEmpty ? upcomingToday.first : null;

  final probe = ref.watch(deliverySlotProvider(tomorrow));
  final firstTom = probe.slots.isNotEmpty ? probe.slots.first : null;

  final NextBatchReason reason;
  if (allFull) {
    reason = NextBatchReason.allFull;
  } else if (allEnded) {
    reason = NextBatchReason.dayOver;
  } else if (firstStarted) {
    reason = NextBatchReason.midDay;
  } else {
    return null;
  }

  final lastEnd = slots
      .map((s) => s.endTime)
      .reduce((a, b) => a.compareTo(b) >= 0 ? a : b);
  final booked = slots.fold<int>(0, (acc, s) => acc + s.bookedCount);
  final cap = slots.fold<int>(0, (acc, s) => acc + s.capacity);

  final nextSlot = nextToday ?? firstTom;
  final nextDateStr = nextToday != null
      ? today
      : (firstTom != null ? tomorrow : dayAfter);

  return NextBatchInfo(
    reason: reason,
    todayDate: today,
    nextDate: nextDateStr,
    nextSlotStart: nextSlot?.startTime,
    nextSlotEnd: nextSlot?.endTime,
    todaysLastEnd: lastEnd,
    bookedTotal: booked,
    capacityTotal: cap,
  );
});

class NextBatchDialog extends StatefulWidget {
  const NextBatchDialog({super.key, required this.info});

  final NextBatchInfo info;

  static Future<void> show(BuildContext context, NextBatchInfo info) async {
    await showGeneralDialog<void>(
      context: context,
      barrierLabel: 'next-batch',
      barrierDismissible: true,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      transitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (_, _, _) => const SizedBox.shrink(),
      transitionBuilder: (ctx, anim, _, _) {
        final curved = CurvedAnimation(
          parent: anim,
          curve: Curves.easeOutCubic,
          reverseCurve: Curves.easeInCubic,
        );
        return Opacity(
          opacity: curved.value,
          child: Transform.translate(
            offset: Offset(0, (1 - curved.value) * 18),
            child: NextBatchDialog(info: info),
          ),
        );
      },
    );
  }

  @override
  State<NextBatchDialog> createState() => _NextBatchDialogState();
}

class _NextBatchDialogState extends State<NextBatchDialog> {
  static const _pageCount = 4;
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _next() {
    if (_page >= _pageCount - 1) {
      Navigator.of(context).pop();
      return;
    }
    _controller.nextPage(
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeOutCubic,
    );
  }

  void _back() {
    if (_page == 0) return;
    _controller.previousPage(
      duration: const Duration(milliseconds: 280),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final info = widget.info;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final colors = isDark ? AppColors.dark : AppColors.light;
    final brand = isDark ? AppColors.brandDark : AppColors.brandLight;

    final headline = switch (info.reason) {
      NextBatchReason.allFull => "Today's batches are full",
      NextBatchReason.dayOver => "Today's last batch has departed",
      NextBatchReason.weekend => "No deliveries scheduled today",
      NextBatchReason.midDay => "You've passed today's first batch",
    };
    final subhead = switch (info.reason) {
      NextBatchReason.allFull =>
        "Every slot today is fully booked. New orders will join the next available batch.",
      NextBatchReason.dayOver =>
        "We've already finished today's runs. New orders will join the next available batch.",
      NextBatchReason.weekend =>
        "Batch deliveries run Monday to Friday. Place your order anytime — it'll go out on the next batch day.",
      NextBatchReason.midDay =>
        "Order now to ride the next batch out. Here's how today's schedule shapes up.",
    };

    final nextDate = DateTime.parse(info.nextDate);
    final nextLabel = _formatDateLabel(nextDate);
    final nextSlotLabel = info.nextSlotStart != null && info.nextSlotEnd != null
        ? '${_format12h(info.nextSlotStart!)} – ${_format12h(info.nextSlotEnd!)}'
        : 'First available slot';

    final isLast = _page == _pageCount - 1;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 420),
          child: Material(
            color: Colors.transparent,
            child: Container(
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: AppRadius.borderXl,
                border: Border.all(color: colors.outline, width: 1),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.45),
                    blurRadius: 32,
                    offset: const Offset(0, 12),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: AppRadius.borderXl,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _Header(
                      colors: colors,
                      brand: brand,
                      headline: headline,
                      subhead: subhead,
                      reason: info.reason,
                    ),
                    SizedBox(
                      height: 320,
                      child: PageView(
                        controller: _controller,
                        onPageChanged: (i) => setState(() => _page = i),
                        children: [
                          _PageStatus(
                            colors: colors,
                            brand: brand,
                            dateLabel: nextLabel,
                            slotLabel: nextSlotLabel,
                            booked: info.bookedTotal,
                            capacity: info.capacityTotal,
                          ),
                          _PageHowItWorks(colors: colors, brand: brand),
                          _PageSchedule(colors: colors, brand: brand),
                          _PagePriority(colors: colors, brand: brand),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(
                        AppSpacing.xl,
                        AppSpacing.md,
                        AppSpacing.xl,
                        AppSpacing.xl,
                      ),
                      child: Column(
                        children: [
                          _PageDots(
                            count: _pageCount,
                            current: _page,
                            colors: colors,
                            brand: brand,
                          ),
                          const SizedBox(height: AppSpacing.md),
                          Row(
                            children: [
                              if (_page > 0)
                                Expanded(
                                  child: _SecondaryButton(
                                    colors: colors,
                                    label: 'Back',
                                    onTap: _back,
                                  ),
                                )
                              else
                                Expanded(
                                  child: _SecondaryButton(
                                    colors: colors,
                                    label: 'Skip',
                                    onTap: () =>
                                        Navigator.of(context).pop(),
                                  ),
                                ),
                              const SizedBox(width: AppSpacing.sm),
                              Expanded(
                                flex: 2,
                                child: _PrimaryButton(
                                  colors: colors,
                                  label: isLast
                                      ? 'Got it'
                                      : (_page == 0
                                          ? 'See how it works'
                                          : 'Next'),
                                  onTap: _next,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            )
                .animate()
                .scale(
                  duration: 360.ms,
                  curve: Curves.easeOutBack,
                  begin: const Offset(0.94, 0.94),
                  end: const Offset(1, 1),
                ),
          ),
        ),
      ),
    );
  }
}

// ── Pages ────────────────────────────────────────────────────────────────

class _PageStatus extends StatelessWidget {
  const _PageStatus({
    required this.colors,
    required this.brand,
    required this.dateLabel,
    required this.slotLabel,
    required this.booked,
    required this.capacity,
  });

  final AppColorSet colors;
  final Color brand;
  final String dateLabel;
  final String slotLabel;
  final int booked;
  final int capacity;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel(colors: colors, text: 'YOUR NEXT WINDOW'),
          const SizedBox(height: AppSpacing.sm),
          _NextBatchCard(
            colors: colors,
            brand: brand,
            dateLabel: dateLabel,
            slotLabel: slotLabel,
          ),
          if (capacity > 0) ...[
            const SizedBox(height: AppSpacing.lg),
            _CapacityStrip(
              colors: colors,
              brand: brand,
              booked: booked,
              total: capacity,
            ),
          ],
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
            ),
            child: Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedInformationCircle,
                  size: 16,
                  color: colors.onSurfaceDim,
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    'Swipe or tap Next to see how batch delivery works.',
                    style: AppTypography.caption.copyWith(
                      color: colors.onSurface,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PageHowItWorks extends StatelessWidget {
  const _PageHowItWorks({required this.colors, required this.brand});
  final AppColorSet colors;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel(colors: colors, text: 'HOW BATCH DELIVERY WORKS'),
          const SizedBox(height: AppSpacing.md),
          _ExplainerStep(
            colors: colors,
            brand: brand,
            index: '01',
            title: 'Orders bundle into batches',
            body:
                'Each batch is a single delivery run. Up to 10 orders share one slot, riding together to keep fees low.',
          ),
          const SizedBox(height: AppSpacing.md),
          _ExplainerStep(
            colors: colors,
            brand: brand,
            index: '02',
            title: 'You pick the slot at checkout',
            body:
                'Choose a window when you place your order. Your batch goes out at the start of that window.',
          ),
          const SizedBox(height: AppSpacing.md),
          _ExplainerStep(
            colors: colors,
            brand: brand,
            index: '03',
            title: 'Track the run in real-time',
            body:
                'Once the rider picks up your batch, the home screen shows the truck on its route.',
          ),
        ],
      ),
    );
  }
}

class _PageSchedule extends StatelessWidget {
  const _PageSchedule({required this.colors, required this.brand});
  final AppColorSet colors;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    final slots = const [
      ('Morning', '9:30 AM', '11:30 AM'),
      ('Afternoon', '2:00 PM', '4:00 PM'),
      ('Evening', '9:00 PM', '11:00 PM'),
    ];
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel(colors: colors, text: "TODAY'S WINDOWS"),
          const SizedBox(height: 4),
          Text(
            'Three batches a day · Mon–Fri',
            style: AppTypography.caption.copyWith(color: colors.onSurfaceDim),
          ),
          const SizedBox(height: AppSpacing.md),
          for (final s in slots) ...[
            _SlotRow(
              colors: colors,
              brand: brand,
              label: s.$1,
              start: s.$2,
              end: s.$3,
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: colors.surfaceVariant,
              borderRadius: AppRadius.borderMd,
            ),
            child: Text(
              'Saturday & Sunday: no batch runs. Orders queue for Monday morning.',
              style: AppTypography.caption.copyWith(color: colors.onSurface),
            ),
          ),
        ],
      ),
    );
  }
}

class _PagePriority extends StatelessWidget {
  const _PagePriority({required this.colors, required this.brand});
  final AppColorSet colors;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.lg,
        AppSpacing.xl,
        0,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionLabel(colors: colors, text: 'NEED IT FIRST?'),
          const SizedBox(height: AppSpacing.sm),
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: colors.accent,
              borderRadius: AppRadius.borderLg,
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: brand.withValues(alpha: 0.18),
                    borderRadius: AppRadius.borderMd,
                  ),
                  child: HugeIcon(
                    icon: HugeIcons.strokeRoundedFlash,
                    color: brand,
                    size: 22,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Priority drop · ₱50',
                        style: AppTypography.bodyLarge.copyWith(
                          color: colors.accentOnColor,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Front of the line within your slot.',
                        style: AppTypography.caption.copyWith(
                          color: colors.accentOnColor.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _BulletRow(
            colors: colors,
            brand: brand,
            text: 'Same delivery window — your batch is unloaded first.',
          ),
          const SizedBox(height: AppSpacing.sm),
          _BulletRow(
            colors: colors,
            brand: brand,
            text: 'Toggle priority at the slot picker before paying.',
          ),
          const SizedBox(height: AppSpacing.sm),
          _BulletRow(
            colors: colors,
            brand: brand,
            text: 'Capacity is shared — if a slot is full, even priority waits.',
          ),
        ],
      ),
    );
  }
}

class _SlotRow extends StatelessWidget {
  const _SlotRow({
    required this.colors,
    required this.brand,
    required this.label,
    required this.start,
    required this.end,
  });
  final AppColorSet colors;
  final Color brand;
  final String label;
  final String start;
  final String end;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderMd,
        border: Border.all(color: colors.outlineVariant, width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 6,
            height: 28,
            decoration: BoxDecoration(
              color: brand,
              borderRadius: AppRadius.borderFull,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: AppTypography.body.copyWith(
                    color: colors.onBackground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '$start – $end',
            style: AppTypography.caption.copyWith(
              color: colors.onSurface,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _BulletRow extends StatelessWidget {
  const _BulletRow({
    required this.colors,
    required this.brand,
    required this.text,
  });
  final AppColorSet colors;
  final Color brand;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.only(top: 7),
          width: 5,
          height: 5,
          decoration: BoxDecoration(
            color: brand,
            borderRadius: AppRadius.borderFull,
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: AppTypography.caption.copyWith(
              color: colors.onSurface,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({
    required this.count,
    required this.current,
    required this.colors,
    required this.brand,
  });
  final int count;
  final int current;
  final AppColorSet colors;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < count; i++) ...[
          AnimatedContainer(
            duration: const Duration(milliseconds: 240),
            curve: Curves.easeOut,
            width: i == current ? 22 : 6,
            height: 6,
            decoration: BoxDecoration(
              color: i == current
                  ? brand
                  : colors.onSurfaceDim.withValues(alpha: 0.3),
              borderRadius: AppRadius.borderFull,
            ),
          ),
          if (i != count - 1) const SizedBox(width: 6),
        ],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.colors,
    required this.brand,
    required this.headline,
    required this.subhead,
    required this.reason,
  });

  final AppColorSet colors;
  final Color brand;
  final String headline;
  final String subhead;
  final NextBatchReason reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.xl,
        AppSpacing.xl,
        AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            colors.accent,
            colors.accent.withValues(alpha: 0.92),
          ],
        ),
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -20,
            top: -28,
            child: Container(
              width: 140,
              height: 140,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: brand.withValues(alpha: 0.10),
              ),
            ),
          ),
          Positioned(
            right: 22,
            top: 12,
            child: HugeIcon(
              icon: HugeIcons.strokeRoundedClock01,
              size: 56,
              color: brand.withValues(alpha: 0.65),
            )
                .animate(onPlay: (c) => c.repeat(reverse: true))
                .moveY(begin: 0, end: -3, duration: 1800.ms, curve: Curves.easeInOut),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: brand.withValues(alpha: 0.18),
                  borderRadius: AppRadius.borderFull,
                  border: Border.all(
                    color: brand.withValues(alpha: 0.45),
                    width: 1,
                  ),
                ),
                child: Text(
                  switch (reason) {
                    NextBatchReason.allFull => 'BATCH FULL',
                    NextBatchReason.dayOver => "TODAY'S DAY OVER",
                    NextBatchReason.weekend => 'NO RUNS TODAY',
                    NextBatchReason.midDay => 'BATCH SCHEDULE',
                  },
                  style: AppTypography.overline.copyWith(
                    color: brand,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SizedBox(
                width: 240,
                child: Text(
                  headline,
                  style: AppTypography.h2.copyWith(
                    color: colors.accentOnColor,
                    height: 1.15,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              SizedBox(
                width: 280,
                child: Text(
                  subhead,
                  style: AppTypography.caption.copyWith(
                    color: colors.accentOnColor.withValues(alpha: 0.75),
                    height: 1.45,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NextBatchCard extends StatelessWidget {
  const _NextBatchCard({
    required this.colors,
    required this.brand,
    required this.dateLabel,
    required this.slotLabel,
  });

  final AppColorSet colors;
  final Color brand;
  final String dateLabel;
  final String slotLabel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(AppSpacing.md),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: AppRadius.borderLg,
        border: Border.all(color: colors.outlineVariant, width: 1),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: brand.withValues(alpha: 0.14),
              borderRadius: AppRadius.borderMd,
            ),
            child: HugeIcon(
              icon: HugeIcons.strokeRoundedDeliveryTruck02,
              color: brand,
              size: 22,
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'NEXT AVAILABLE BATCH',
                  style: AppTypography.overline.copyWith(
                    color: colors.onSurfaceDim,
                    fontSize: 9,
                    letterSpacing: 1.4,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  dateLabel,
                  style: AppTypography.bodyLarge.copyWith(
                    color: colors.onBackground,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                Text(
                  slotLabel,
                  style: AppTypography.caption.copyWith(
                    color: colors.onSurface,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.colors, required this.text});
  final AppColorSet colors;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: AppTypography.overline.copyWith(
        color: colors.onSurfaceDim,
        fontSize: 10,
        letterSpacing: 1.6,
        fontWeight: FontWeight.w700,
      ),
    );
  }
}

class _ExplainerStep extends StatelessWidget {
  const _ExplainerStep({
    required this.colors,
    required this.brand,
    required this.index,
    required this.title,
    required this.body,
  });

  final AppColorSet colors;
  final Color brand;
  final String index;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 36,
          child: Text(
            index,
            style: AppTypography.h3.copyWith(
              color: brand,
              fontWeight: FontWeight.w800,
              height: 1.0,
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: AppTypography.body.copyWith(
                  color: colors.onBackground,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                body,
                style: AppTypography.caption.copyWith(
                  color: colors.onSurface,
                  height: 1.45,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _StepDivider extends StatelessWidget {
  const _StepDivider();

  @override
  Widget build(BuildContext context) =>
      const SizedBox(height: AppSpacing.md);
}

class _CapacityStrip extends StatelessWidget {
  const _CapacityStrip({
    required this.colors,
    required this.brand,
    required this.booked,
    required this.total,
  });

  final AppColorSet colors;
  final Color brand;
  final int booked;
  final int total;

  @override
  Widget build(BuildContext context) {
    final pct = total == 0 ? 0.0 : (booked / total).clamp(0.0, 1.0);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Text(
              "TODAY'S CAPACITY",
              style: AppTypography.overline.copyWith(
                color: colors.onSurfaceDim,
                fontSize: 9,
                letterSpacing: 1.5,
                fontWeight: FontWeight.w700,
              ),
            ),
            const Spacer(),
            Text(
              '$booked / $total',
              style: AppTypography.caption.copyWith(
                color: colors.onSurface,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
        const SizedBox(height: 6),
        ClipRRect(
          borderRadius: AppRadius.borderFull,
          child: Stack(
            children: [
              Container(height: 6, color: colors.surfaceDim),
              FractionallySizedBox(
                widthFactor: pct,
                child: Container(
                  height: 6,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [brand, brand.withValues(alpha: 0.6)],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.colors,
    required this.label,
    required this.onTap,
  });

  final AppColorSet colors;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.borderLg,
      child: Container(
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.accent,
          borderRadius: AppRadius.borderLg,
        ),
        child: Text(
          label,
          style: AppTypography.body.copyWith(
            color: colors.accentOnColor,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _SecondaryButton extends StatelessWidget {
  const _SecondaryButton({
    required this.colors,
    required this.label,
    required this.onTap,
  });

  final AppColorSet colors;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: AppRadius.borderLg,
      child: Container(
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: AppRadius.borderLg,
          border: Border.all(color: colors.outline, width: 1),
        ),
        child: Text(
          label,
          style: AppTypography.body.copyWith(
            color: colors.onBackground,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

