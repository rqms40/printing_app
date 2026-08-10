import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:uuid/uuid.dart';

class CheckoutNotifier extends StateNotifier<CheckoutState> {
  CheckoutNotifier() : super(const CheckoutState());

  // ── Item-level mutations ────────────────────────────────────────────────

  void addItem(CartItem item) {
    final newItems = [...state.items, item];
    state = state.copyWith(
      items: newItems,
      unitAssignments: _reconcileAssignments(
        items: newItems,
        drops: state.drops,
        existing: state.unitAssignments,
      ),
    );
  }

  void removeItem(String id) {
    final newItems = state.items.where((i) => i.id != id).toList();
    final newAssignments = Map<String, List<String?>>.from(
      state.unitAssignments,
    )..remove(id);
    state = state.copyWith(items: newItems, unitAssignments: newAssignments);
  }

  /// Removes only the items captured by a completed submission. This avoids
  /// discarding work added while the request was in flight.
  void removeSubmittedItems(Set<String> submittedItemIds) {
    final remaining = state.items
        .where((item) => !submittedItemIds.contains(item.id))
        .toList();
    if (remaining.isEmpty) {
      reset();
      return;
    }
    final assignments = Map<String, List<String?>>.from(state.unitAssignments)
      ..removeWhere((itemId, _) => submittedItemIds.contains(itemId));
    state = state.copyWith(items: remaining, unitAssignments: assignments);
  }

  void setQuantity(String id, int quantity) {
    final newItems = state.items
        .map((i) => i.id == id ? i.copyWith(quantity: quantity) : i)
        .toList();
    state = state.copyWith(
      items: newItems,
      unitAssignments: _reconcileAssignments(
        items: newItems,
        drops: state.drops,
        existing: state.unitAssignments,
      ),
    );
  }

  void replaceItem(CartItem replacement) {
    final newItems = state.items
        .map((i) => i.id == replacement.id ? replacement : i)
        .toList();
    state = state.copyWith(
      items: newItems,
      unitAssignments: _reconcileAssignments(
        items: newItems,
        drops: state.drops,
        existing: state.unitAssignments,
      ),
    );
  }

  // ── Mode + addresses + drops ───────────────────────────────────────────

  void setMode(DeliveryMode mode) {
    if (mode == DeliveryMode.multidrop) {
      // Ensure at least one drop exists so newly-assigned units have a target.
      final drops = state.drops.isEmpty
          ? [
              DestinationGroup(
                id: const Uuid().v4(),
                label: 'Drop 1',
                itemIds: const [],
              ),
            ]
          : state.drops;
      state = state.copyWith(
        mode: mode,
        drops: drops,
        unitAssignments: _reconcileAssignments(
          items: state.items,
          drops: drops,
          existing: state.unitAssignments,
        ),
      );
    } else {
      state = state.copyWith(mode: mode);
    }
  }

  void setSingleAddress(Address address) => state = state.copyWith(
    singleAddress: address,
    clearTemporaryAddress: true,
  );

  void setTemporaryAddress(TemporaryCheckoutAddress address) =>
      state = state.copyWith(temporaryAddress: address);

  void setDrops(List<DestinationGroup> drops) {
    state = state.copyWith(
      drops: drops,
      unitAssignments: _reconcileAssignments(
        items: state.items,
        drops: drops,
        existing: state.unitAssignments,
      ),
    );
  }

  /// Assigns the [copyIndex]-th copy of [itemId] to [dropId].
  void assignUnit(String itemId, int copyIndex, String dropId) {
    final current = state.unitAssignments[itemId];
    if (current == null || copyIndex < 0 || copyIndex >= current.length) return;
    final next = [...current];
    next[copyIndex] = dropId;
    state = state.copyWith(
      unitAssignments: {...state.unitAssignments, itemId: next},
    );
  }

  // ── Speed / payment / misc ─────────────────────────────────────────────

  void setSpeedTier(DeliverySpeedTier tier) => state = state.copyWith(
    speedTier: tier,
    clearScheduledSlot: tier != DeliverySpeedTier.scheduled,
  );

  void setScheduledSlot(ScheduledSlot slot) {
    state = state.copyWith(
      scheduledSlot: slot,
      speedTier: DeliverySpeedTier.scheduled,
    );
  }

  void setPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(paymentMethod: method);
  void clearPaymentMethod() => state = state.copyWith(clearPaymentMethod: true);
  void setLeaveAtDoor(bool value) => state = state.copyWith(leaveAtDoor: value);
  void setRiderNote(String note) => state = state.copyWith(riderNote: note);
  void reset() => state = const CheckoutState();

  // ── Internals ──────────────────────────────────────────────────────────

  /// Re-aligns [unitAssignments] with the current items + drops:
  /// - Pads/truncates each item's list to `item.quantity`.
  /// - New copies inherit `drops.first.id` (auto-assign to Drop 1).
  /// - Copies pointing at a removed drop fall back to `drops.first.id`.
  /// - Removes entries for items that no longer exist.
  static Map<String, List<String?>> _reconcileAssignments({
    required List<CartItem> items,
    required List<DestinationGroup> drops,
    required Map<String, List<String?>> existing,
  }) {
    final fallback = drops.isEmpty ? null : drops.first.id;
    final validDropIds = drops.map((d) => d.id).toSet();
    final next = <String, List<String?>>{};
    for (final item in items) {
      final prev = existing[item.id] ?? const <String?>[];
      final list = <String?>[];
      for (var i = 0; i < item.quantity; i++) {
        final dropId = i < prev.length ? prev[i] : fallback;
        list.add(
          dropId != null && validDropIds.contains(dropId) ? dropId : fallback,
        );
      }
      next[item.id] = list;
    }
    return next;
  }
}

final checkoutProvider = StateNotifierProvider<CheckoutNotifier, CheckoutState>(
  (ref) => CheckoutNotifier(),
);

class CheckoutFees {
  const CheckoutFees({
    required this.subtotal,
    required this.deliveryFee,
    required this.priorityFee,
    required this.extraDropFee,
    required this.serviceFee,
  });
  final double subtotal;
  final double deliveryFee;
  final double priorityFee;
  final double extraDropFee;
  final double serviceFee;
  double get total =>
      subtotal + deliveryFee + priorityFee + extraDropFee + serviceFee;
}

const _kStandardDeliveryFee = 25.0;
const _kPriorityFee = 50.0;
const _kExtraDropFee = 30.0;
const _kServiceFee = 2.0;

double _deliveryFeeForTier(DeliverySpeedTier tier) {
  switch (tier) {
    case DeliverySpeedTier.priority:
    case DeliverySpeedTier.standard:
    case DeliverySpeedTier.scheduled:
      return _kStandardDeliveryFee;
    case DeliverySpeedTier.saver:
      // Retired tier — fall back to standard fee if any old state slips in.
      return _kStandardDeliveryFee;
  }
}

final checkoutFeesProvider = Provider<CheckoutFees>((ref) {
  final state = ref.watch(checkoutProvider);
  final extraDrops = state.drops.length > 1 ? state.drops.length - 1 : 0;
  final isPickup = state.mode == DeliveryMode.pickup;
  return CheckoutFees(
    subtotal: state.subtotal ?? 0,
    deliveryFee: isPickup ? 0 : _deliveryFeeForTier(state.speedTier),
    priorityFee: !isPickup && state.speedTier == DeliverySpeedTier.priority
        ? _kPriorityFee
        : 0,
    extraDropFee: isPickup ? 0 : extraDrops * _kExtraDropFee,
    serviceFee: _kServiceFee,
  );
});
