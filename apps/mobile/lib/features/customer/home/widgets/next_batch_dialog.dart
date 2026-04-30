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

class UpcomingSlot {
  const UpcomingSlot({
    required this.startTime,
    required this.endTime,
    required this.bookedCount,
    required this.capacity,
  });
  final String startTime;
  final String endTime;
  final int bookedCount;
  final int capacity;
  bool get isFull => bookedCount >= capacity;
}

class NextBatchInfo {
  const NextBatchInfo({
    required this.reason,
    required this.todayDate,
    required this.relevantDate,
    required this.relevantIsToday,
    required this.upcoming,
    this.nextSlotStart,
    this.nextSlotEnd,
  });

  final NextBatchReason reason;
  final String todayDate;
  final String relevantDate;
  final bool relevantIsToday;
  final List<UpcomingSlot> upcoming;
  final String? nextSlotStart;
  final String? nextSlotEnd;

  int get bookedTotal =>
      upcoming.fold(0, (acc, s) => acc + s.bookedCount);
  int get capacityTotal => upcoming.fold(0, (acc, s) => acc + s.capacity);
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

List<UpcomingSlot> _toUpcoming(Iterable<DeliverySlot> slots) => slots
    .map((s) => UpcomingSlot(
          startTime: s.startTime,
          endTime: s.endTime,
          bookedCount: s.bookedCount,
          capacity: s.capacity,
        ))
    .toList()
  ..sort((a, b) => a.startTime.compareTo(b.startTime));

/// Returns information for the dialog whenever today is constrained
/// (mid-day, full, day-over, or weekend). Capacity is scoped only to the
/// **remaining** slots — past/missed slots are excluded.
final nextBatchInfoProvider = Provider.autoDispose<NextBatchInfo?>((ref) {
  final now = DateTime.now();
  final today = _isoDate(now);
  final tomorrow = _isoDate(now.add(const Duration(days: 1)));
  final dayAfter = _isoDate(now.add(const Duration(days: 2)));

  final todayState = ref.watch(deliverySlotProvider(today));
  if (todayState.isLoading) return null;

  final slots = todayState.slots;

  // Slots that haven't started yet today (the only ones a customer can book
  // for today's runs without conflict — past/in-progress are excluded).
  final remainingToday = slots
      .where((s) => _parseDateTime(today, s.startTime).isAfter(now))
      .toList()
    ..sort((a, b) => a.startTime.compareTo(b.startTime));

  final tomState = ref.watch(deliverySlotProvider(tomorrow));
  final tomSlots = tomState.slots;

  // Weekend / no templates today.
  if (slots.isEmpty) {
    final firstTom = tomSlots.isNotEmpty ? tomSlots.first : null;
    return NextBatchInfo(
      reason: NextBatchReason.weekend,
      todayDate: today,
      relevantDate: firstTom != null ? tomorrow : dayAfter,
      relevantIsToday: false,
      upcoming: _toUpcoming(tomSlots),
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

  // Decide reason; if nothing has started yet and today still has its full
  // schedule ahead, suppress the dialog entirely.
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

  // Capacity is scoped to upcoming slots only.
  // - If today still has not-yet-started slots → use those (ignore missed).
  // - Otherwise fall back to tomorrow.
  final useToday = remainingToday.isNotEmpty;
  final upcoming = useToday
      ? _toUpcoming(remainingToday)
      : _toUpcoming(tomSlots);
  final relevantDate = useToday
      ? today
      : (tomSlots.isNotEmpty ? tomorrow : dayAfter);

  final firstUpcoming = upcoming.isNotEmpty ? upcoming.first : null;

  return NextBatchInfo(
    reason: reason,
    todayDate: today,
    relevantDate: relevantDate,
    relevantIsToday: useToday,
    upcoming: upcoming,
    nextSlotStart: firstUpcoming?.startTime,
    nextSlotEnd: firstUpcoming?.endTime,
  );
});

class NextBatchDialog extends StatefulWidget {
  const NextBatchDialog({super.key, required this.info});

  final NextBatchInfo info;

  static Future<void> show(BuildContext context, NextBatchInfo info) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.55),
      builder: (_) => NextBatchDialog(info: info),
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

    // Force dark sheet so brand yellow has high contrast.
    const sheetBg = Color(0xFF111111);
    const sheetSurface = Color(0xFF1A1A1A);
    const sheetOutline = Color(0xFF2A2A2A);
    const onSheet = Color(0xFFEDEDED);
    const onSheetDim = Color(0xFF8A8A8A);
    const brand = AppColors.brandDark;

    final eyebrow = switch (info.reason) {
      NextBatchReason.allFull => 'TODAY · BATCHES FULL',
      NextBatchReason.dayOver => "TODAY · DAY OVER",
      NextBatchReason.weekend => 'TODAY · NO RUNS',
      NextBatchReason.midDay => 'TODAY · IN PROGRESS',
    };
    final headline = switch (info.reason) {
      NextBatchReason.allFull => "Today's batches are full",
      NextBatchReason.dayOver => "Today's last batch has departed",
      NextBatchReason.weekend => "No deliveries scheduled today",
      NextBatchReason.midDay => "Catch the next batch",
    };

    final relevantDate = DateTime.parse(info.relevantDate);
    final relevantDateLabel = info.relevantIsToday
        ? 'TODAY'
        : _formatDateLabel(relevantDate).toUpperCase();
    final nextSlotLabel = info.nextSlotStart != null && info.nextSlotEnd != null
        ? '${_format12h(info.nextSlotStart!)} – ${_format12h(info.nextSlotEnd!)}'
        : 'First available slot';

    final isLast = _page == _pageCount - 1;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewPadding.bottom,
      ),
      child: Container(
        decoration: const BoxDecoration(
          color: sheetBg,
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Padding(
                padding: const EdgeInsets.only(top: 10, bottom: 6),
                child: Container(
                  width: 38,
                  height: 4,
                  decoration: BoxDecoration(
                    color: onSheetDim.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              // Header row
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  AppSpacing.sm,
                  AppSpacing.sm,
                  AppSpacing.md,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            eyebrow,
                            style: AppTypography.overline.copyWith(
                              color: brand,
                              fontSize: 10,
                              letterSpacing: 1.4,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            headline,
                            style: AppTypography.h3.copyWith(
                              color: onSheet,
                              fontWeight: FontWeight.w700,
                              height: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      onPressed: () => Navigator.of(context).pop(),
                      splashRadius: 20,
                      icon: const Icon(
                        Icons.close_rounded,
                        color: onSheetDim,
                        size: 22,
                      ),
                    ),
                  ],
                ),
              ),
              // Pages
              SizedBox(
                height: 240,
                child: PageView(
                  controller: _controller,
                  onPageChanged: (i) => setState(() => _page = i),
                  children: [
                    _SheetPageStatus(
                      surface: sheetSurface,
                      outline: sheetOutline,
                      onSheet: onSheet,
                      onSheetDim: onSheetDim,
                      brand: brand,
                      reason: info.reason,
                      relevantDateLabel: relevantDateLabel,
                      relevantIsToday: info.relevantIsToday,
                      nextSlotLabel: nextSlotLabel,
                      upcoming: info.upcoming,
                      booked: info.bookedTotal,
                      capacity: info.capacityTotal,
                    ),
                    _SheetPageHowItWorks(
                      onSheet: onSheet,
                      onSheetDim: onSheetDim,
                      brand: brand,
                    ),
                    _SheetPageSchedule(
                      surface: sheetSurface,
                      outline: sheetOutline,
                      onSheet: onSheet,
                      onSheetDim: onSheetDim,
                      brand: brand,
                    ),
                    _SheetPagePriority(
                      surface: sheetSurface,
                      onSheet: onSheet,
                      onSheetDim: onSheetDim,
                      brand: brand,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              // Page dots
              _SheetPageDots(
                count: _pageCount,
                current: _page,
                brand: brand,
                dim: onSheetDim,
              ),
              // Footer CTAs
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.xl,
                  AppSpacing.md,
                  AppSpacing.xl,
                  AppSpacing.lg,
                ),
                child: Row(
                  children: [
                    if (_page > 0)
                      Expanded(
                        child: _SheetSecondaryBtn(
                          onSheet: onSheet,
                          outline: sheetOutline,
                          label: 'Back',
                          onTap: _back,
                        ),
                      ),
                    if (_page > 0) const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      flex: _page == 0 ? 1 : 2,
                      child: _SheetPrimaryBtn(
                        brand: brand,
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
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Sheet primitives ─────────────────────────────────────────────────────

class _SheetPrimaryBtn extends StatelessWidget {
  const _SheetPrimaryBtn({
    required this.brand,
    required this.label,
    required this.onTap,
  });
  final Color brand;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: brand,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          label,
          style: AppTypography.body.copyWith(
            color: const Color(0xFF111111),
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}

class _SheetSecondaryBtn extends StatelessWidget {
  const _SheetSecondaryBtn({
    required this.onSheet,
    required this.outline,
    required this.label,
    required this.onTap,
  });
  final Color onSheet;
  final Color outline;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 48,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: outline, width: 1),
        ),
        child: Text(
          label,
          style: AppTypography.body.copyWith(
            color: onSheet,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _SheetPageDots extends StatelessWidget {
  const _SheetPageDots({
    required this.count,
    required this.current,
    required this.brand,
    required this.dim,
  });
  final int count;
  final int current;
  final Color brand;
  final Color dim;

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
              color: i == current ? brand : dim.withValues(alpha: 0.35),
              borderRadius: BorderRadius.circular(3),
            ),
          ),
          if (i != count - 1) const SizedBox(width: 6),
        ],
      ],
    );
  }
}

// ── Sheet pages ──────────────────────────────────────────────────────────

class _SheetPageStatus extends StatelessWidget {
  const _SheetPageStatus({
    required this.surface,
    required this.outline,
    required this.onSheet,
    required this.onSheetDim,
    required this.brand,
    required this.reason,
    required this.relevantDateLabel,
    required this.relevantIsToday,
    required this.nextSlotLabel,
    required this.upcoming,
    required this.booked,
    required this.capacity,
  });
  final Color surface;
  final Color outline;
  final Color onSheet;
  final Color onSheetDim;
  final Color brand;
  final NextBatchReason reason;
  final String relevantDateLabel;
  final bool relevantIsToday;
  final String nextSlotLabel;
  final List<UpcomingSlot> upcoming;
  final int booked;
  final int capacity;

  @override
  Widget build(BuildContext context) {
    final remaining = capacity - booked;
    final pct = capacity == 0 ? 0.0 : (booked / capacity).clamp(0.0, 1.0);
    final capacityLabel =
        relevantIsToday ? 'REMAINING TODAY' : "TOMORROW'S CAPACITY";
    final summary = switch (reason) {
      NextBatchReason.allFull =>
        'Every batch today is fully booked.',
      NextBatchReason.dayOver =>
        "Today's last batch has departed.",
      NextBatchReason.weekend =>
        'No batch runs scheduled today.',
      NextBatchReason.midDay =>
        'You missed earlier batches today, but more are still open.',
    };

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            summary,
            style: AppTypography.body.copyWith(
              color: onSheet,
              height: 1.4,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Hero next-slot strip
          Container(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.sm,
            ),
            decoration: BoxDecoration(
              color: surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: outline, width: 1),
            ),
            child: Row(
              children: [
                Container(
                  width: 4,
                  height: 36,
                  decoration: BoxDecoration(
                    color: brand,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        relevantIsToday
                            ? 'NEXT BATCH · TODAY'
                            : 'NEXT BATCH · $relevantDateLabel',
                        style: AppTypography.overline.copyWith(
                          color: onSheetDim,
                          fontSize: 9,
                          letterSpacing: 1.4,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        nextSlotLabel,
                        style: AppTypography.bodyLarge.copyWith(
                          color: onSheet,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (upcoming.length > 1) ...[
            const SizedBox(height: 6),
            for (final s in upcoming.skip(1).take(2))
              Padding(
                padding: const EdgeInsets.only(top: 4),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 18,
                      margin: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: onSheetDim.withValues(alpha: 0.4),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      'then ${_format12h(s.startTime)} – ${_format12h(s.endTime)}',
                      style: AppTypography.caption.copyWith(
                        color: onSheetDim,
                      ),
                    ),
                    const Spacer(),
                    if (s.isFull)
                      Text(
                        'Full',
                        style: AppTypography.caption.copyWith(
                          color: brand,
                          fontWeight: FontWeight.w700,
                        ),
                      )
                    else
                      Text(
                        '${s.capacity - s.bookedCount} open',
                        style: AppTypography.caption.copyWith(
                          color: onSheetDim,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                  ],
                ),
              ),
          ],
          if (capacity > 0) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Text(
                  capacityLabel,
                  style: AppTypography.overline.copyWith(
                    color: onSheetDim,
                    fontSize: 9,
                    letterSpacing: 1.4,
                  ),
                ),
                const Spacer(),
                Text(
                  '$remaining of $capacity open',
                  style: AppTypography.caption.copyWith(
                    color: onSheet,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: Stack(
                children: [
                  Container(height: 6, color: surface),
                  FractionallySizedBox(
                    widthFactor: pct,
                    child: Container(height: 6, color: brand),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _SheetPageHowItWorks extends StatelessWidget {
  const _SheetPageHowItWorks({
    required this.onSheet,
    required this.onSheetDim,
    required this.brand,
  });
  final Color onSheet;
  final Color onSheetDim;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SheetStep(
            brand: brand,
            onSheet: onSheet,
            onSheetDim: onSheetDim,
            index: '01',
            title: 'Orders bundle into batches',
            body:
                'Up to 10 orders share a single delivery run, keeping fees low.',
          ),
          const SizedBox(height: AppSpacing.md),
          _SheetStep(
            brand: brand,
            onSheet: onSheet,
            onSheetDim: onSheetDim,
            index: '02',
            title: 'You pick the slot at checkout',
            body:
                'Choose a delivery window. Your batch heads out at the start of it.',
          ),
          const SizedBox(height: AppSpacing.md),
          _SheetStep(
            brand: brand,
            onSheet: onSheet,
            onSheetDim: onSheetDim,
            index: '03',
            title: 'Track the run live',
            body:
                'Once the rider picks up, you can watch the truck on the home map.',
          ),
        ],
      ),
    );
  }
}

class _SheetPageSchedule extends StatelessWidget {
  const _SheetPageSchedule({
    required this.surface,
    required this.outline,
    required this.onSheet,
    required this.onSheetDim,
    required this.brand,
  });
  final Color surface;
  final Color outline;
  final Color onSheet;
  final Color onSheetDim;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    final slots = const [
      ('Morning', '9:30 AM – 11:30 AM'),
      ('Afternoon', '2:00 PM – 4:00 PM'),
      ('Evening', '9:00 PM – 11:00 PM'),
    ];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Three batches a day · Mon–Fri',
            style: AppTypography.caption.copyWith(color: onSheetDim),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final s in slots) ...[
            Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: 12,
              ),
              decoration: BoxDecoration(
                color: surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: outline, width: 1),
              ),
              child: Row(
                children: [
                  Container(
                    width: 4,
                    height: 22,
                    decoration: BoxDecoration(
                      color: brand,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Text(
                      s.$1,
                      style: AppTypography.body.copyWith(
                        color: onSheet,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  Text(
                    s.$2,
                    style: AppTypography.caption.copyWith(
                      color: onSheetDim,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 6),
          ],
        ],
      ),
    );
  }
}

class _SheetPagePriority extends StatelessWidget {
  const _SheetPagePriority({
    required this.surface,
    required this.onSheet,
    required this.onSheetDim,
    required this.brand,
  });
  final Color surface;
  final Color onSheet;
  final Color onSheetDim;
  final Color brand;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: brand,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                HugeIcon(
                  icon: HugeIcons.strokeRoundedFlash,
                  color: const Color(0xFF111111),
                  size: 26,
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Priority drop · ₱50',
                        style: AppTypography.bodyLarge.copyWith(
                          color: const Color(0xFF111111),
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Front of the line within your slot.',
                        style: AppTypography.caption.copyWith(
                          color: const Color(0xFF111111).withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          _SheetBullet(
            brand: brand,
            onSheet: onSheet,
            text: 'Same window — your order is unloaded first.',
          ),
          const SizedBox(height: 6),
          _SheetBullet(
            brand: brand,
            onSheet: onSheet,
            text: 'Toggle priority on the slot picker before paying.',
          ),
          const SizedBox(height: 6),
          _SheetBullet(
            brand: brand,
            onSheet: onSheet,
            text: 'Capacity is shared — even priority waits if a slot is full.',
          ),
        ],
      ),
    );
  }
}

class _SheetStep extends StatelessWidget {
  const _SheetStep({
    required this.brand,
    required this.onSheet,
    required this.onSheetDim,
    required this.index,
    required this.title,
    required this.body,
  });
  final Color brand;
  final Color onSheet;
  final Color onSheetDim;
  final String index;
  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 30,
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
                  color: onSheet,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                body,
                style: AppTypography.caption.copyWith(
                  color: onSheetDim,
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

class _SheetBullet extends StatelessWidget {
  const _SheetBullet({
    required this.brand,
    required this.onSheet,
    required this.text,
  });
  final Color brand;
  final Color onSheet;
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
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Text(
            text,
            style: AppTypography.caption.copyWith(
              color: onSheet,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }
}

