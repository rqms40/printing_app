import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

class RiderProfileState {
  const RiderProfileState({
    this.fullName,
    this.email,
    this.phoneNumber,
    this.vehicleType,
    this.plateNumber,
    this.licenseNumber,
    this.isAvailable = false,
    this.isLoading = true,
  });

  final String? fullName;
  final String? email;
  final String? phoneNumber;
  final String? vehicleType;
  final String? plateNumber;
  final String? licenseNumber;
  final bool isAvailable;
  final bool isLoading;

  RiderProfileState copyWith({
    String? fullName,
    String? email,
    String? phoneNumber,
    String? vehicleType,
    String? plateNumber,
    String? licenseNumber,
    bool? isAvailable,
    bool? isLoading,
  }) {
    return RiderProfileState(
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      vehicleType: vehicleType ?? this.vehicleType,
      plateNumber: plateNumber ?? this.plateNumber,
      licenseNumber: licenseNumber ?? this.licenseNumber,
      isAvailable: isAvailable ?? this.isAvailable,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class RiderProfileNotifier extends StateNotifier<RiderProfileState> {
  RiderProfileNotifier() : super(const RiderProfileState()) {
    _load();
  }

  Future<void> _load() async {
    try {
      final response = await ApiClient.instance.get('/riders/profile');
      if (!mounted) return;
      final json = response.data as Map<String, dynamic>;
      final user = json['user'] as Map<String, dynamic>?;
      state = RiderProfileState(
        fullName: user?['fullName'] as String? ?? user?['full_name'] as String?,
        email: user?['email'] as String?,
        phoneNumber:
            user?['phoneNumber'] as String? ?? user?['phone_number'] as String?,
        vehicleType:
            json['vehicleType'] as String? ?? json['vehicle_type'] as String?,
        plateNumber:
            json['plateNumber'] as String? ?? json['plate_number'] as String?,
        licenseNumber:
            json['licenseNumber'] as String? ??
            json['license_number'] as String?,
        isAvailable:
            json['isAvailable'] as bool? ??
            json['is_available'] as bool? ??
            false,
        isLoading: false,
      );
    } catch (_) {
      if (!mounted) return;
      final mock = MockData.riderProfileJuan;
      final user = MockData.riderJuan;
      state = RiderProfileState(
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        vehicleType: mock.vehicleType.displayName,
        plateNumber: mock.plateNumber,
        licenseNumber: mock.licenseNumber,
        isAvailable: mock.isAvailable,
        isLoading: false,
      );
    }
  }

  Future<void> setAvailability(bool value) async {
    state = state.copyWith(isAvailable: value);
    try {
      await ApiClient.instance.patch(
        '/riders/availability',
        data: {'isAvailable': value},
      );
    } catch (_) {}
  }

  Future<bool> updateVehicle({
    required String vehicleType,
    required String plateNumber,
  }) async {
    if (!mounted) return false;
    try {
      await ApiClient.instance.patch(
        '/riders/profile',
        data: {'vehicleType': vehicleType, 'plateNumber': plateNumber},
      );
      if (!mounted) return false;
      state = state.copyWith(
        vehicleType: vehicleType,
        plateNumber: plateNumber,
      );
      return true;
    } catch (_) {
      if (!mounted) return false;
      return false;
    }
  }

  Future<bool> updatePersonalInfo({
    required String fullName,
    required String phoneNumber,
  }) async {
    if (!mounted) return false;
    try {
      await ApiClient.instance.put(
        '/users/profile',
        data: {'fullName': fullName, 'phoneNumber': phoneNumber},
      );
      if (!mounted) return false;
      state = state.copyWith(
        fullName: fullName,
        phoneNumber: phoneNumber,
      );
      return true;
    } catch (_) {
      if (!mounted) return false;
      return false;
    }
  }

  Future<void> refresh() => _load();
}

final riderProfileProvider =
    StateNotifierProvider.autoDispose<RiderProfileNotifier, RiderProfileState>(
      (ref) => RiderProfileNotifier(),
    );
