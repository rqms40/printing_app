import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/home/widgets/map_tracking_tile.dart';
import 'package:printing_app/features/customer/home/widgets/next_batch_dialog.dart';
import 'package:printing_app/features/customer/order/providers/delivery_slot_provider.dart';
import 'package:printing_app/features/customer/orders/providers/orders_provider.dart';
import 'package:printing_app/shared/models/enums.dart';

/// Session-level flag — true once the NextBatchDialog has been shown for the
/// current logged-in session. Reset on logout (handled by auth provider).
final nextBatchShownThisSessionProvider = StateProvider<bool>((_) => false);

/// Drop-in widget that triggers [NextBatchDialog] the first time
/// [nextBatchInfoProvider] emits a non-null value during a session, regardless
/// of which customer-shell tab the user is on.
///
/// Wrap any persistent customer surface (e.g. the shell builder) with this so
/// the reminder fires reliably on first login, even if the user lands on Orders
/// / Notifications / Profile instead of Home.
class NextBatchSessionTrigger extends ConsumerStatefulWidget {
  const NextBatchSessionTrigger({super.key, required this.child});
  final Widget child;

  @override
  ConsumerState<NextBatchSessionTrigger> createState() =>
      _NextBatchSessionTriggerState();
}

class _NextBatchSessionTriggerState
    extends ConsumerState<NextBatchSessionTrigger> {
  @override
  void initState() {
    super.initState();
    // Kick off slot fetches for today + tomorrow on the first build so the
    // provider has data to evaluate on. Idempotent — refresh() safely re-fetches.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final now = DateTime.now();
      final today = _iso(now);
      final tomorrow = _iso(now.add(const Duration(days: 1)));
      ref.read(deliverySlotProvider(today).notifier).refresh();
      ref.read(deliverySlotProvider(tomorrow).notifier).refresh();
    });
  }

  String _iso(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  /// True when the customer already has a batch to watch — a booked slot on
  /// an active order, or a delivery currently on the road. The reminder is
  /// about placing an order; interrupting someone who already placed one is
  /// noise.
  bool _hasBatchInFlight() {
    if (ref.read(bookedDeliverySlotProvider) != null) return true;
    return ref
        .read(activeOrdersProvider)
        .any(
          (o) =>
              o.orderStatus == OrderStatus.onTheWay ||
              o.orderStatus == OrderStatus.arrivedAtDestination,
        );
  }

  Future<void> _maybeShow() async {
    if (!mounted) return;
    if (ref.read(nextBatchShownThisSessionProvider)) return;
    // Hold off until the first orders fetch lands — whether the customer has
    // a batch in flight is unknowable before that.
    if (!ref.read(ordersInitialLoadCompleteProvider)) return;
    if (_hasBatchInFlight()) return;
    final info = ref.read(nextBatchInfoProvider);
    if (info == null) return;
    ref.read(nextBatchShownThisSessionProvider.notifier).state = true;
    await NextBatchDialog.show(context, info);
  }

  @override
  Widget build(BuildContext context) {
    ref.listen<NextBatchInfo?>(nextBatchInfoProvider, (prev, next) {
      if (next == null) return;
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
    });
    // Re-evaluate once the first orders fetch completes — slots often resolve
    // before orders, and the decision needs both.
    ref.listen<bool>(ordersInitialLoadCompleteProvider, (prev, next) {
      if (!next) return;
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
    });
    // Cover the case where the provider already had a value at first build.
    final immediate = ref.watch(nextBatchInfoProvider);
    if (immediate != null &&
        !ref.read(nextBatchShownThisSessionProvider)) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeShow());
    }
    return widget.child;
  }
}
