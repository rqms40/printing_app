class LocationUpdate {
  const LocationUpdate({
    required this.id,
    required this.deliveryAssignmentId,
    required this.latitude,
    required this.longitude,
    this.speed,
    this.heading,
    required this.timestamp,
  });

  final String id;
  final String deliveryAssignmentId;
  final double latitude;
  final double longitude;
  final double? speed;
  final double? heading;
  final DateTime timestamp;

  LocationUpdate copyWith({
    String? id,
    String? deliveryAssignmentId,
    double? latitude,
    double? longitude,
    double? speed,
    double? heading,
    DateTime? timestamp,
  }) {
    return LocationUpdate(
      id: id ?? this.id,
      deliveryAssignmentId: deliveryAssignmentId ?? this.deliveryAssignmentId,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      speed: speed ?? this.speed,
      heading: heading ?? this.heading,
      timestamp: timestamp ?? this.timestamp,
    );
  }

  @override
  String toString() =>
      'LocationUpdate($latitude, $longitude @ $timestamp)';
}
