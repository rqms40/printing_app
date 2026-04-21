import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/driver_profile.dart';
import 'package:printing_app/shared/models/enums.dart';
import 'package:printing_app/shared/providers/mock_data.dart';
import 'package:printing_app/shared/services/api_client.dart';

VehicleType _parseVehicleType(String value) {
  final camelCase = value.replaceAllMapped(
    RegExp(r'_([a-z])'),
    (m) => m.group(1)!.toUpperCase(),
  );
  return VehicleType.values.firstWhere(
    (e) => e.name == camelCase,
    orElse: () => VehicleType.motorcycle,
  );
}

dynamic _readJsonValue(
  Map<String, dynamic> json,
  String camelKey, [
  String? snakeKey,
]) {
  return json[camelKey] ?? (snakeKey != null ? json[snakeKey] : null);
}

DriverProfile _parseDriver(Map<String, dynamic> json) {
  return DriverProfile(
    id: _readJsonValue(json, 'id', '_id')?.toString() ?? '',
    userId: _readJsonValue(json, 'userId', 'user_id')?.toString() ?? '',
    vehicleType: _parseVehicleType(
      _readJsonValue(json, 'vehicleType', 'vehicle_type')?.toString() ??
          'motorcycle',
    ),
    plateNumber: _readJsonValue(
      json,
      'plateNumber',
      'plate_number',
    )?.toString(),
    licenseNumber: _readJsonValue(
      json,
      'licenseNumber',
      'license_number',
    )?.toString(),
    isAvailable:
        _readJsonValue(json, 'isAvailable', 'is_available') as bool? ?? false,
    lastLatitude:
        (_readJsonValue(json, 'lastLatitude', 'last_latitude') as num?)
            ?.toDouble(),
    lastLongitude:
        (_readJsonValue(json, 'lastLongitude', 'last_longitude') as num?)
            ?.toDouble(),
    lastLocationUpdate:
        _readJsonValue(json, 'lastLocationUpdate', 'last_location_update')
            is String
        ? DateTime.parse(
            _readJsonValue(json, 'lastLocationUpdate', 'last_location_update')
                as String,
          )
        : null,
    createdAt: _readJsonValue(json, 'createdAt', 'created_at') is String
        ? DateTime.parse(
            _readJsonValue(json, 'createdAt', 'created_at') as String,
          )
        : DateTime.now(),
    updatedAt: _readJsonValue(json, 'updatedAt', 'updated_at') is String
        ? DateTime.parse(
            _readJsonValue(json, 'updatedAt', 'updated_at') as String,
          )
        : DateTime.now(),
  );
}

/// State holding driver list and assignment results.
class DriversState {
  const DriversState({required this.drivers});

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
  DriversNotifier() : super(const DriversState(drivers: [])) {
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
      await ApiClient.instance.post(
        '/admin/orders/$orderId/assign',
        data: {'driverId': driverId},
      );
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
final driversProvider = StateNotifierProvider<DriversNotifier, DriversState>((
  ref,
) {
  return DriversNotifier();
});
