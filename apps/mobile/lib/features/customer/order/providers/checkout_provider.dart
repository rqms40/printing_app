import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/features/customer/cart/models/cart_item.dart';
import 'package:printing_app/features/customer/order/models/checkout_state.dart';
import 'package:printing_app/features/customer/order/models/delivery_speed_tier.dart';
import 'package:printing_app/features/customer/order/models/destination_group.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/models/enums.dart';

class CheckoutNotifier extends StateNotifier<CheckoutState> {
  CheckoutNotifier() : super(const CheckoutState());

  void addItem(CartItem item) {
    state = state.copyWith(items: [...state.items, item]);
  }

  void removeItem(String id) {
    state = state.copyWith(
      items: state.items.where((i) => i.id != id).toList(),
    );
  }

  void setQuantity(String id, int quantity) {
    state = state.copyWith(
      items: state.items
          .map((i) => i.id == id ? i.copyWith(quantity: quantity) : i)
          .toList(),
    );
  }

  void replaceItem(CartItem replacement) {
    state = state.copyWith(
      items: state.items
          .map((i) => i.id == replacement.id ? replacement : i)
          .toList(),
    );
  }

  void setMode(DeliveryMode mode) => state = state.copyWith(mode: mode);
  void setSingleAddress(Address address) =>
      state = state.copyWith(singleAddress: address);
  void setDrops(List<DestinationGroup> drops) =>
      state = state.copyWith(drops: drops);
  void setSpeedTier(DeliverySpeedTier tier) =>
      state = state.copyWith(speedTier: tier);

  void setScheduledSlot(ScheduledSlot slot) {
    state = state.copyWith(
      scheduledSlot: slot,
      speedTier: DeliverySpeedTier.scheduled,
    );
  }

  void setPaymentMethod(PaymentMethod method) =>
      state = state.copyWith(paymentMethod: method);
  void setLeaveAtDoor(bool value) =>
      state = state.copyWith(leaveAtDoor: value);
  void setRiderNote(String note) => state = state.copyWith(riderNote: note);
  void reset() => state = const CheckoutState();
}

final checkoutProvider =
    StateNotifierProvider<CheckoutNotifier, CheckoutState>(
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

const _kBaseDeliveryFee = 60.0;
const _kSaverDeliveryFee = 35.0;
const _kPriorityFee = 50.0;
const _kExtraDropFee = 30.0;
const _kServiceFee = 4.0;

double _deliveryFeeForTier(DeliverySpeedTier tier) {
  switch (tier) {
    case DeliverySpeedTier.saver:
      return _kSaverDeliveryFee;
    case DeliverySpeedTier.priority:
    case DeliverySpeedTier.standard:
    case DeliverySpeedTier.scheduled:
      return _kBaseDeliveryFee;
  }
}

final checkoutFeesProvider = Provider<CheckoutFees>((ref) {
  final state = ref.watch(checkoutProvider);
  final extraDrops = state.drops.length > 1 ? state.drops.length - 1 : 0;
  return CheckoutFees(
    subtotal: state.subtotal,
    deliveryFee: _deliveryFeeForTier(state.speedTier),
    priorityFee: state.speedTier == DeliverySpeedTier.priority
        ? _kPriorityFee
        : 0,
    extraDropFee: extraDrops * _kExtraDropFee,
    serviceFee: _kServiceFee,
  );
});
