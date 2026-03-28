import 'enums.dart';

class DriverProfile {
  const DriverProfile({
    required this.id,
    required this.userId,
    required this.vehicleType,
    this.plateNumber,
    this.licenseNumber,
    required this.isAvailable,
    this.lastLatitude,
    this.lastLongitude,
    this.lastLocationUpdate,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final VehicleType vehicleType;
  final String? plateNumber;
  final String? licenseNumber;
  final bool isAvailable;
  final double? lastLatitude;
  final double? lastLongitude;
  final DateTime? lastLocationUpdate;
  final DateTime createdAt;
  final DateTime updatedAt;

  DriverProfile copyWith({
    String? id,
    String? userId,
    VehicleType? vehicleType,
    String? plateNumber,
    String? licenseNumber,
    bool? isAvailable,
    double? lastLatitude,
    double? lastLongitude,
    DateTime? lastLocationUpdate,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return DriverProfile(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      vehicleType: vehicleType ?? this.vehicleType,
      plateNumber: plateNumber ?? this.plateNumber,
      licenseNumber: licenseNumber ?? this.licenseNumber,
      isAvailable: isAvailable ?? this.isAvailable,
      lastLatitude: lastLatitude ?? this.lastLatitude,
      lastLongitude: lastLongitude ?? this.lastLongitude,
      lastLocationUpdate: lastLocationUpdate ?? this.lastLocationUpdate,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() =>
      'DriverProfile(userId: $userId, ${vehicleType.displayName})';
}
