import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/rider_profile.dart';
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

RiderProfile _parseRider(Map<String, dynamic> json) {
  return RiderProfile(
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

/// State holding rider list and assignment results.
class RidersState {
  const RidersState({required this.riders});

  final List<RiderProfile> riders;

  RidersState copyWith({List<RiderProfile>? riders}) {
    return RidersState(riders: riders ?? this.riders);
  }

  /// Online riders only.
  List<RiderProfile> get availableRiders =>
      riders.where((d) => d.isAvailable).toList();
}

/// StateNotifier managing rider list and assignment.
class RidersNotifier extends StateNotifier<RidersState> {
  RidersNotifier() : super(const RidersState(riders: [])) {
    _fetchRiders();
  }

  Future<void> _fetchRiders() async {
    try {
      final response = await ApiClient.instance.get('/admin/riders');
      final data = response.data as List<dynamic>;
      final riders = data
          .map((json) => _parseRider(json as Map<String, dynamic>))
          .toList();
      state = state.copyWith(riders: riders);
    } catch (_) {
      // Offline fallback
      state = state.copyWith(
        riders: List<RiderProfile>.from(MockData.riderProfiles),
      );
    }
  }

  Future<void> refreshRiders() async => _fetchRiders();

  /// Assign a rider to an order.
  Future<void> assignRider(String orderId, String riderId) async {
    try {
      await ApiClient.instance.post(
        '/admin/orders/$orderId/assign',
        data: {'riderId': riderId},
      );
    } catch (_) {}
    // Update local state: mark the rider as busy
    final updated = state.riders.map((d) {
      if (d.id == riderId) {
        return d.copyWith(isAvailable: false);
      }
      return d;
    }).toList();

    state = state.copyWith(riders: updated);
  }
}

/// Provider for the riders state.
final ridersProvider = StateNotifierProvider<RidersNotifier, RidersState>((
  ref,
) {
  return RidersNotifier();
});
