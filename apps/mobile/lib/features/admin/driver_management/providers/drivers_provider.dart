import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:printing_app/shared/models/driver_profile.dart';
import 'package:printing_app/shared/providers/mock_data.dart';

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
      : super(DriversState(
            drivers: List<DriverProfile>.from(MockData.driverProfiles)));

  /// Mock assignment of a driver to an order.
  void assignDriver(String orderId, String driverId) {
    // In production this would call a backend API.
    // For now we just mark the driver as busy.
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
