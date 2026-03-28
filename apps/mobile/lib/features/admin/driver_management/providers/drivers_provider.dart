import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/driver_profile.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

VehicleType _parseVehicleType(String value) {
  return VehicleType.values.firstWhere(
    (e) => e.name == value,
    orElse: () => VehicleType.motorcycle,
  );
}

DriverProfile _parseDriver(Map<String, dynamic> json) {
  return DriverProfile(
    id: json['id'] as String? ?? json['_id'] as String? ?? '',
    userId: json['userId'] as String? ?? '',
    vehicleType: _parseVehicleType(json['vehicleType'] as String? ?? 'motorcycle'),
    plateNumber: json['plateNumber'] as String?,
    licenseNumber: json['licenseNumber'] as String?,
    isAvailable: json['isAvailable'] as bool? ?? false,
    lastLatitude: (json['lastLatitude'] as num?)?.toDouble(),
    lastLongitude: (json['lastLongitude'] as num?)?.toDouble(),
    lastLocationUpdate: json['lastLocationUpdate'] is String
        ? DateTime.parse(json['lastLocationUpdate'] as String)
        : null,
    createdAt: json['createdAt'] is String
        ? DateTime.parse(json['createdAt'] as String)
        : DateTime.now(),
    updatedAt: json['updatedAt'] is String
        ? DateTime.parse(json['updatedAt'] as String)
        : DateTime.now(),
  );
}

/// State holding driver list and assignment results.
class DriversState {
  const DriversState({
    required this.drivers,
  });

  final List<DriverProfile> drivers;

  DriversState copyWith({List<DriverProfile>? drivers}) {
    return DriversState(drivers: drivers ?? this.drivers);
  }

  /// Online drivers only.
  List<DriverProfile> get availableDrivers =>
      drivers.where((d) => d.isAvailable).toList();
}

/// StateNotifier managing driver list and assignment.
class DriversNotifier extends StateNotifier<DriversState> {
  DriversNotifier()
      : super(const DriversState(drivers: [])) {
    _fetchDrivers();
  }

  Future<void> _fetchDrivers() async {
    try {
      final response = await ApiClient.instance.get('/admin/drivers');
      final data = response.data as List<dynamic>;
      final drivers = data
          .map((json) => _parseDriver(json as Map<String, dynamic>))
          .toList();
      state = state.copyWith(drivers: drivers);
    } catch (_) {
      // Offline fallback
      state = state.copyWith(
        drivers: List<DriverProfile>.from(MockData.driverProfiles),
      );
    }
  }

  Future<void> refreshDrivers() async => _fetchDrivers();

  /// Assign a driver to an order.
  Future<void> assignDriver(String orderId, String driverId) async {
    try {
      await ApiClient.instance.post('/admin/orders/$orderId/assign', data: {
        'driverId': driverId,
      });
    } catch (_) {}
    // Update local state: mark the driver as busy
    final updated = state.drivers.map((d) {
      if (d.id == driverId) {
        return d.copyWith(isAvailable: false);
      }
      return d;
    }).toList();

    state = state.copyWith(drivers: updated);
  }
}

/// Provider for the drivers state.
final driversProvider =
    StateNotifierProvider<DriversNotifier, DriversState>((ref) {
  return DriversNotifier();
});
