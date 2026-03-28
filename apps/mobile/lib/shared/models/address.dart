class Address {
  const Address({
    required this.id,
    required this.userId,
    required this.label,
    required this.fullAddress,
    this.barangay,
    required this.city,
    this.province,
    this.zipCode,
    this.landmark,
    required this.latitude,
    required this.longitude,
    required this.isDefault,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String userId;
  final String label;
  final String fullAddress;
  final String? barangay;
  final String city;
  final String? province;
  final String? zipCode;
  final String? landmark;
  final double latitude;
  final double longitude;
  final bool isDefault;
  final DateTime createdAt;
  final DateTime updatedAt;

  Address copyWith({
    String? id,
    String? userId,
    String? label,
    String? fullAddress,
    String? barangay,
    String? city,
    String? province,
    String? zipCode,
    String? landmark,
    double? latitude,
    double? longitude,
    bool? isDefault,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return Address(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      label: label ?? this.label,
      fullAddress: fullAddress ?? this.fullAddress,
      barangay: barangay ?? this.barangay,
      city: city ?? this.city,
      province: province ?? this.province,
      zipCode: zipCode ?? this.zipCode,
      landmark: landmark ?? this.landmark,
      latitude: latitude ?? this.latitude,
      longitude: longitude ?? this.longitude,
      isDefault: isDefault ?? this.isDefault,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  @override
  String toString() => 'Address($label, $city)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) || other is Address && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
