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
