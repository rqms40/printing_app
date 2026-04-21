import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

Address _parseAddress(Map<String, dynamic> json) {
  return Address(
    id: json['id'] as String? ?? json['_id'] as String? ?? '',
    userId: json['userId'] as String? ?? '',
    label: json['label'] as String? ?? '',
    fullAddress: json['fullAddress'] as String? ?? '',
    barangay: json['barangay'] as String?,
    city: json['city'] as String? ?? '',
    province: json['province'] as String?,
    zipCode: json['zipCode'] as String?,
    landmark: json['landmark'] as String?,
    latitude: (json['latitude'] as num?)?.toDouble() ?? 0,
    longitude: (json['longitude'] as num?)?.toDouble() ?? 0,
    isDefault: json['isDefault'] as bool? ?? false,
    createdAt: json['createdAt'] is String
        ? DateTime.parse(json['createdAt'] as String)
        : DateTime.now(),
    updatedAt: json['updatedAt'] is String
        ? DateTime.parse(json['updatedAt'] as String)
        : DateTime.now(),
  );
}

class AddressNotifier extends StateNotifier<List<Address>> {
  AddressNotifier({
    List<Address> initialState = const [],
    bool skipBootstrap = false,
  }) : super(initialState) {
    if (!skipBootstrap) _fetchAddresses();
  }

  static const int maxAddresses = 5;

  bool get canAddMore => state.length < maxAddresses;

  Future<void> _fetchAddresses() async {
    try {
      final response = await ApiClient.instance.get('/addresses');
      final data = response.data as List<dynamic>;
      state = data.map((json) => _parseAddress(json as Map<String, dynamic>)).toList();
    } catch (_) {
      // Offline fallback
      state = List.from(MockData.addresses);
    }
  }

  Future<void> refreshAddresses() async => _fetchAddresses();

  Future<void> addAddress(Address address) async {
    if (!canAddMore) return;

    try {
      final response = await ApiClient.instance.post('/addresses', data: {
        'label': address.label,
        'fullAddress': address.fullAddress,
        'barangay': address.barangay,
        'city': address.city,
        'province': address.province,
        'zipCode': address.zipCode,
        'landmark': address.landmark,
        'latitude': address.latitude,
        'longitude': address.longitude,
        'isDefault': address.isDefault,
      });
      final newAddr = _parseAddress(response.data as Map<String, dynamic>);

      // If new address is default, unset others
      if (newAddr.isDefault) {
        state = [
          for (final a in state) a.copyWith(isDefault: false),
          newAddr,
        ];
      } else {
        state = [...state, newAddr];
      }
    } catch (_) {
      // Offline: add locally
      if (address.isDefault) {
        state = [
          for (final a in state) a.copyWith(isDefault: false),
          address,
        ];
      } else {
        state = [...state, address];
      }
    }
  }

  Future<void> updateAddress(Address address) async {
    try {
      await ApiClient.instance.put('/addresses/${address.id}', data: {
        'label': address.label,
        'fullAddress': address.fullAddress,
        'barangay': address.barangay,
        'city': address.city,
        'province': address.province,
        'zipCode': address.zipCode,
        'landmark': address.landmark,
        'latitude': address.latitude,
        'longitude': address.longitude,
        'isDefault': address.isDefault,
      });
    } catch (_) {}
    // Update local state regardless
    state = [
      for (final a in state)
        if (a.id == address.id) address else a,
    ];
  }

  Future<void> deleteAddress(String id) async {
    try {
      await ApiClient.instance.delete('/addresses/$id');
    } catch (_) {}
    // Update local state regardless
    state = state.where((a) => a.id != id).toList();
  }

  Future<void> setDefault(String id) async {
    try {
      await ApiClient.instance.patch('/addresses/$id/default');
    } catch (_) {}
    // Update local state regardless
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
