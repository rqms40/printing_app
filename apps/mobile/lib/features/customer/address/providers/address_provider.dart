import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

class AddressNotifier extends StateNotifier<List<Address>> {
  AddressNotifier() : super(List.from(MockData.addresses));

  static const int maxAddresses = 5;

  bool get canAddMore => state.length < maxAddresses;

  void addAddress(Address address) {
    if (!canAddMore) return;

    // If new address is default, unset others
    if (address.isDefault) {
      state = [
        for (final a in state) a.copyWith(isDefault: false),
        address,
      ];
    } else {
      state = [...state, address];
    }
  }

  void updateAddress(Address address) {
    state = [
      for (final a in state)
        if (a.id == address.id) address else a,
    ];
  }

  void deleteAddress(String id) {
    state = state.where((a) => a.id != id).toList();
  }

  void setDefault(String id) {
    state = [
      for (final a in state)
        a.copyWith(isDefault: a.id == id),
    ];
  }
}

final addressProvider =
    StateNotifierProvider<AddressNotifier, List<Address>>(
  (ref) => AddressNotifier(),
);
