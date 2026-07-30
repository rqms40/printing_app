import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/config/constants/app_constants.dart';
import 'package:printing_app/shared/models/address.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

Address _parseAddress(Map<String, dynamic> json) {
  return Address(
    id: (json['id'] ?? json['_id'])?.toString() ?? '',
    userId: (json['userId'] ?? json['user_id'])?.toString() ?? '',
    label: json['label']?.toString() ?? '',
    fullAddress:
        (json['fullAddress'] ?? json['full_address'])?.toString() ?? '',
    barangay: json['barangay'] as String?,
    city: json['city']?.toString() ?? '',
    province: json['province'] as String?,
    zipCode: (json['zipCode'] ?? json['zip_code'])?.toString(),
    landmark: json['landmark'] as String?,
    latitude: _readDouble(json['latitude'], 0),
    longitude: _readDouble(json['longitude'], 0),
    isDefault: (json['isDefault'] ?? json['is_default']) as bool? ?? false,
    createdAt: (json['createdAt'] ?? json['created_at']) is String
        ? DateTime.parse((json['createdAt'] ?? json['created_at']) as String)
        : DateTime.now(),
    updatedAt: (json['updatedAt'] ?? json['updated_at']) is String
        ? DateTime.parse((json['updatedAt'] ?? json['updated_at']) as String)
        : DateTime.now(),
  );
}

double _readDouble(dynamic value, double fallback) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

class AddressNotifier extends StateNotifier<List<Address>> {
  AddressNotifier({
    List<Address> initialState = const [],
    bool skipBootstrap = false,
    bool? realFlow,
  }) : realFlow = realFlow ?? AppConstants.realFlow,
       super(initialState) {
    if (!skipBootstrap) _fetchAddresses();
  }

  static const int maxAddresses = 5;
  final bool realFlow;
  String? errorMessage;
  int _sessionGeneration = 0;
  int _fetchGeneration = 0;

  bool get canAddMore => state.length < maxAddresses;

  Future<void> _fetchAddresses() async {
    final sessionGeneration = _sessionGeneration;
    final fetchGeneration = ++_fetchGeneration;
    try {
      final response = await ApiClient.instance.get('/addresses');
      if (!_isCurrent(sessionGeneration) ||
          fetchGeneration != _fetchGeneration) {
        return;
      }
      final data = response.data as List<dynamic>;
      state = data
          .map((json) => _parseAddress(json as Map<String, dynamic>))
          .toList();
      errorMessage = null;
    } catch (_) {
      if (!_isCurrent(sessionGeneration) ||
          fetchGeneration != _fetchGeneration) {
        return;
      }
      if (!realFlow) {
        state = List.from(MockData.addresses);
        errorMessage = 'Showing offline demo addresses';
      } else {
        _setError('Unable to load saved addresses');
      }
    }
  }

  Future<bool> refreshAddresses() async {
    await _fetchAddresses();
    return errorMessage == null;
  }

  void clear() {
    _sessionGeneration += 1;
    _fetchGeneration += 1;
    errorMessage = null;
    state = const [];
  }

  bool _isCurrent(int generation) =>
      mounted && generation == _sessionGeneration;

  @override
  void dispose() {
    _sessionGeneration += 1;
    _fetchGeneration += 1;
    super.dispose();
  }

  Future<Address?> addAddress(
    Address address, {
    bool addLocallyOnFailure = true,
  }) async {
    if (!canAddMore) return null;
    final sessionGeneration = _sessionGeneration;

    try {
      final response = await ApiClient.instance.post(
        '/addresses',
        data: {
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
        },
      );
      if (!_isCurrent(sessionGeneration)) return null;
      final newAddr = _parseAddress(response.data as Map<String, dynamic>);

      // If new address is default, unset others
      if (newAddr.isDefault) {
        state = [for (final a in state) a.copyWith(isDefault: false), newAddr];
      } else {
        state = [...state, newAddr];
      }
      errorMessage = null;
      return newAddr;
    } catch (_) {
      if (!_isCurrent(sessionGeneration)) return null;
      if (!addLocallyOnFailure || realFlow) {
        _setError('Address was not saved');
        return null;
      }
      // Offline: add locally
      if (address.isDefault) {
        state = [for (final a in state) a.copyWith(isDefault: false), address];
      } else {
        state = [...state, address];
      }
      errorMessage = 'Address is available only on this device';
      return null;
    }
  }

  Future<bool> updateAddress(Address address) async {
    final sessionGeneration = _sessionGeneration;
    try {
      await ApiClient.instance.put(
        '/addresses/${address.id}',
        data: {
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
        },
      );
    } catch (_) {
      if (!_isCurrent(sessionGeneration)) return false;
      if (realFlow) {
        _setError('Unable to update this address');
        return false;
      }
    }
    if (!_isCurrent(sessionGeneration)) return false;
    // Update local state regardless
    state = [
      for (final a in state)
        if (a.id == address.id) address else a,
    ];
    errorMessage = null;
    return true;
  }

  Future<bool> deleteAddress(String id) async {
    final sessionGeneration = _sessionGeneration;
    try {
      await ApiClient.instance.delete('/addresses/$id');
    } catch (_) {
      if (!_isCurrent(sessionGeneration)) return false;
      if (realFlow) {
        _setError('Unable to delete this address');
        return false;
      }
    }
    if (!_isCurrent(sessionGeneration)) return false;
    // Update local state regardless
    state = state.where((a) => a.id != id).toList();
    errorMessage = null;
    return true;
  }

  Future<bool> setDefault(String id) async {
    final sessionGeneration = _sessionGeneration;
    try {
      await ApiClient.instance.patch('/addresses/$id/default');
    } catch (_) {
      if (!_isCurrent(sessionGeneration)) return false;
      if (realFlow) {
        _setError('Unable to set the default address');
        return false;
      }
    }
    if (!_isCurrent(sessionGeneration)) return false;
    // Update local state regardless
    state = [for (final a in state) a.copyWith(isDefault: a.id == id)];
    errorMessage = null;
    return true;
  }

  void _setError(String message) {
    errorMessage = message;
    state = [...state];
  }
}

final addressProvider = StateNotifierProvider<AddressNotifier, List<Address>>(
  (ref) => AddressNotifier(),
);
